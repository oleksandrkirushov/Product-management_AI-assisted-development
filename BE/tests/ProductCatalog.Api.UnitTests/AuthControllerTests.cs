using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using ProductCatalog.Api.Authentication;
using ProductCatalog.Api.Authorization;
using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Controllers;
using ProductCatalog.Api.Options;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Application.Auth;
using ProductCatalog.Application.Users;
using ProductCatalog.Domain.Entities;
using JsonWebTokenHandler = Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace ProductCatalog.Api.UnitTests;

// Login is the only place that issues tokens, and ActiveUserTokenValidator rejects every token without
// the "uid" claim: these tests pin the contract between the two, so dropping a claim at issue time fails
// here instead of turning every freshly issued token into a 401.
public sealed class AuthControllerTests
{
    private sealed class InMemoryUserRepository : IUserRepository
    {
        public List<User> Items { get; } = [];

        public Task<User?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Id == id));

        public Task<User?> FindByUsernameAsync(string username, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Username == username));

        public Task<User?> FindByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Email == email));

        public Task<IReadOnlyList<User>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<User>>(Items);

        public Task<int> CountActiveByRoleIdsAsync(
            IReadOnlyCollection<Guid> roleIds,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.Count(x => x.IsActive && roleIds.Contains(x.RoleId)));

        public Task AddAsync(User user, CancellationToken cancellationToken = default)
        {
            Items.Add(user);
            return Task.CompletedTask;
        }

        public void Update(User user)
        {
        }

        public void Remove(User user) => Items.Remove(user);
    }

    private sealed class InMemoryRoleRepository : IRoleRepository
    {
        public List<Role> Items { get; } = [];

        public Task<Role?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Id == id));

        public Task<Role?> FindByNameAsync(string name, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Name == name));

        public Task<IReadOnlyList<Role>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Role>>(Items);
    }

    private sealed class NoOpUnitOfWork : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }

    private sealed class FakePasswordHasher : IPasswordHasher
    {
        public string Hash(string password) => $"hashed:{password}";

        public bool Verify(string password, string passwordHash) => passwordHash == Hash(password);
    }

    private const string Password = "Secret123";

    private static readonly JwtOptions Jwt = new()
    {
        Issuer = "test-issuer",
        Audience = "test-audience",
        Key = "unit-test-signing-key-at-least-32-bytes!",
        ExpirationMinutes = 5
    };

    private readonly Role _role = new("User", ["products:read", "users:read"]);
    private readonly InMemoryUserRepository _users = new();
    private readonly InMemoryRoleRepository _roles = new();
    private readonly FakePasswordHasher _passwordHasher = new();
    private readonly User _user;

    public AuthControllerTests()
    {
        _roles.Items.Add(_role);
        _user = new User("jdoe", "jdoe@example.com", "John", "Doe", _passwordHasher.Hash(Password), _role.Id);
        _users.Items.Add(_user);
    }

    private AuthController CreateController() =>
        new(
            new AuthService(_users, _roles, _passwordHasher),
            new RegisterUserService(_users, _roles, _passwordHasher, new NoOpUnitOfWork()),
            MsOptions.Create(Jwt));

    private Task<IActionResult> Login(string username, string password) =>
        CreateController().Login(new LoginRequest(username, password), CancellationToken.None);

    // The response body is an anonymous type, so it is read the way a client sees it: as JSON.
    private static JsonDocument BodyOf(ObjectResult result) =>
        JsonDocument.Parse(JsonSerializer.Serialize(result.Value));

    private async Task<string> LoginAndGetAccessToken()
    {
        var ok = Assert.IsType<OkObjectResult>(await Login(_user.Username, Password));
        using var body = BodyOf(ok);
        Assert.Equal("Bearer", body.RootElement.GetProperty("tokenType").GetString());

        var accessToken = body.RootElement.GetProperty("accessToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(accessToken));
        return accessToken!;
    }

    // Reads the token the way JwtBearer does: JsonWebTokenHandler with MapInboundClaims = true and the
    // issuer/audience/key from JwtOptions (same approach as the round-trip test in
    // ActiveUserTokenValidatorTests, but for a token really issued by Login).
    private static async Task<ClaimsPrincipal> ValidateAsync(string accessToken)
    {
        var validation = await new JsonWebTokenHandler { MapInboundClaims = true }.ValidateTokenAsync(
            accessToken,
            new TokenValidationParameters
            {
                ValidIssuer = Jwt.Issuer,
                ValidAudience = Jwt.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Jwt.Key))
            });

        Assert.True(validation.IsValid, validation.Exception?.Message);
        return new ClaimsPrincipal(validation.ClaimsIdentity);
    }

    private static async Task AssertUnauthorizedWithoutToken(Task<IActionResult> login)
    {
        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(await login);
        using var body = BodyOf(unauthorized);
        Assert.False(body.RootElement.TryGetProperty("accessToken", out _));
        Assert.Equal("Invalid username or password.", body.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsOkWithTokenCarryingUserIdNameAndPermissions()
    {
        var principal = await ValidateAsync(await LoginAndGetAccessToken());

        Assert.Equal(_user.Id.ToString(), principal.FindFirstValue(ActiveUserTokenValidator.UserIdClaimType));
        Assert.Equal(_user.Username, principal.FindFirstValue(ClaimTypes.Name));

        var permissionsClaim = Assert.Single(
            principal.FindAll(PermissionAuthorizationHandler.PermissionsClaimType));
        Assert.Equal(_role.Permissions, JsonSerializer.Deserialize<string[]>(permissionsClaim.Value));
    }

    [Fact]
    public async Task Login_IssuedToken_PassesActiveUserTokenValidatorUntilUserIsDeactivated()
    {
        var principal = await ValidateAsync(await LoginAndGetAccessToken());

        Assert.True(await ActiveUserTokenValidator.IsAllowedAsync(principal, _users));

        // Same token, same principal: only the account state changed.
        _user.Deactivate();
        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(principal, _users));
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorizedWithoutToken()
    {
        await AssertUnauthorizedWithoutToken(Login(_user.Username, "WrongPassword"));
    }

    [Fact]
    public async Task Login_WithDeactivatedUser_ReturnsUnauthorizedWithoutToken()
    {
        _user.Deactivate();

        await AssertUnauthorizedWithoutToken(Login(_user.Username, Password));
    }
}
