using System.Reflection;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;
using ProductCatalog.Api.Authentication;
using ProductCatalog.Api.Authorization;
using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Controllers;
using ProductCatalog.Api.Options;
using ProductCatalog.Api.RateLimiting;
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
// The forgot/reset-password endpoints are covered against the contract the front end is built on.
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

    private sealed class InMemoryPasswordResetTokenRepository : IPasswordResetTokenRepository
    {
        public List<PasswordResetToken> Items { get; } = [];

        public Task AddAsync(PasswordResetToken token, CancellationToken cancellationToken = default)
        {
            Items.Add(token);
            return Task.CompletedTask;
        }

        public Task<PasswordResetToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.TokenHash == tokenHash));

        public Task<IReadOnlyList<PasswordResetToken>> GetActiveByUserIdAsync(
            Guid userId,
            DateTime nowUtc,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<PasswordResetToken>>(
                Items.Where(x => x.UserId == userId && x.UsedAtUtc is null && x.ExpiresAtUtc > nowUtc).ToList());

        public void Update(PasswordResetToken token)
        {
        }
    }

    private sealed class FakeTokenGenerator : IPasswordResetTokenGenerator
    {
        public string GenerateToken() => "generated-token";

        public string HashToken(string token) => $"hash:{token}";
    }

    private sealed class RecordingEmailSender : IEmailSender
    {
        public List<string> Recipients { get; } = [];

        // When set, SendAsync fails like an unreachable SMTP server (or a cancelled operation).
        public Exception? FailWith { get; set; }

        public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
        {
            if (FailWith is not null)
                throw FailWith;

            Recipients.Add(to);
            return Task.CompletedTask;
        }
    }

    private const string Password = "Secret123";
    private const string NewPassword = "NewPass123";

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
    private readonly InMemoryPasswordResetTokenRepository _resetTokens = new();
    private readonly RecordingEmailSender _emailSender = new();
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
            new PasswordResetService(
                _users,
                _resetTokens,
                new FakeTokenGenerator(),
                _passwordHasher,
                _emailSender,
                new NoOpUnitOfWork(),
                TimeProvider.System,
                new PasswordResetOptions { ResetUrl = "http://localhost:4200/reset-password", TokenLifetimeMinutes = 30 }),
            MsOptions.Create(Jwt),
            NullLogger<AuthController>.Instance);

    private PasswordResetToken AddResetToken(string rawToken, DateTime expiresAtUtc)
    {
        var token = new PasswordResetToken(_user.Id, $"hash:{rawToken}", expiresAtUtc.AddMinutes(-30), expiresAtUtc);
        _resetTokens.Items.Add(token);
        return token;
    }

    private static void AssertMessage(ObjectResult result, string expected)
    {
        using var body = BodyOf(result);
        Assert.Equal(expected, body.RootElement.GetProperty("message").GetString());
    }

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
        Assert.Equal(_user.SecurityStamp, principal.FindFirstValue(ActiveUserTokenValidator.SecurityStampClaimType));

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

    [Fact]
    public async Task Login_IssuedToken_IsRejectedAfterPasswordReset()
    {
        var principal = await ValidateAsync(await LoginAndGetAccessToken());
        AddResetToken("valid", DateTime.UtcNow.AddMinutes(30));

        Assert.IsType<NoContentResult>(await CreateController().ResetPassword(
            new ResetPasswordRequest("valid", NewPassword), CancellationToken.None));

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(principal, _users));
        await AssertUnauthorizedWithoutToken(Login(_user.Username, Password));
        var newPrincipal = await ValidateAsync(await LoginWithNewPasswordAndGetAccessToken());
        Assert.True(await ActiveUserTokenValidator.IsAllowedAsync(newPrincipal, _users));
    }

    private async Task<string> LoginWithNewPasswordAndGetAccessToken()
    {
        var ok = Assert.IsType<OkObjectResult>(await Login(_user.Username, NewPassword));
        using var body = BodyOf(ok);
        return body.RootElement.GetProperty("accessToken").GetString()!;
    }

    [Theory]
    [InlineData("jdoe@example.com")]
    [InlineData("nobody@example.com")]
    public async Task ForgotPassword_AnyEmail_ReturnsAcceptedWithSameMessage(string email)
    {
        var result = await CreateController().ForgotPassword(new ForgotPasswordRequest(email), CancellationToken.None);

        var accepted = Assert.IsType<AcceptedResult>(result);
        Assert.Equal(StatusCodes.Status202Accepted, accepted.StatusCode);
        AssertMessage(accepted, "If an account with this email exists, a reset link has been sent.");
    }

    [Fact]
    public async Task ForgotPassword_KnownEmail_SendsEmailOnlyToThatUser()
    {
        await CreateController().ForgotPassword(new ForgotPasswordRequest(_user.Email), CancellationToken.None);
        await CreateController().ForgotPassword(new ForgotPasswordRequest("nobody@example.com"), CancellationToken.None);

        Assert.Equal([_user.Email], _emailSender.Recipients);
    }

    // A 500 only for existing accounts would turn an SMTP outage into an account-enumeration oracle.
    [Fact]
    public async Task ForgotPassword_EmailSendingFails_StillReturnsAcceptedWithSameMessage()
    {
        _emailSender.FailWith = new InvalidOperationException("SMTP server unreachable.");

        var result = await CreateController().ForgotPassword(
            new ForgotPasswordRequest(_user.Email), CancellationToken.None);

        var accepted = Assert.IsType<AcceptedResult>(result);
        AssertMessage(accepted, "If an account with this email exists, a reset link has been sent.");
    }

    [Fact]
    public async Task ForgotPassword_OperationCancelled_IsNotSwallowed()
    {
        _emailSender.FailWith = new OperationCanceledException();

        await Assert.ThrowsAsync<OperationCanceledException>(() => CreateController().ForgotPassword(
            new ForgotPasswordRequest(_user.Email), CancellationToken.None));
    }

    [Fact]
    public async Task ResetPassword_ValidToken_ReturnsNoContentAndChangesPassword()
    {
        AddResetToken("valid", DateTime.UtcNow.AddMinutes(30));

        var result = await CreateController().ResetPassword(
            new ResetPasswordRequest("valid", NewPassword), CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(_passwordHasher.Hash(NewPassword), _user.PasswordHash);
    }

    [Fact]
    public async Task ResetPassword_UnknownToken_ReturnsBadRequestWithInvalidLinkMessage()
    {
        var result = await CreateController().ResetPassword(
            new ResetPasswordRequest("unknown", NewPassword), CancellationToken.None);

        AssertMessage(Assert.IsType<BadRequestObjectResult>(result), "Reset link is invalid or has expired.");
    }

    [Fact]
    public async Task ResetPassword_ExpiredToken_ReturnsBadRequestWithInvalidLinkMessage()
    {
        AddResetToken("expired", DateTime.UtcNow.AddMinutes(-1));

        var result = await CreateController().ResetPassword(
            new ResetPasswordRequest("expired", NewPassword), CancellationToken.None);

        AssertMessage(Assert.IsType<BadRequestObjectResult>(result), "Reset link is invalid or has expired.");
    }

    [Fact]
    public async Task ResetPassword_TokenUsedTwice_SecondAttemptReturnsBadRequest()
    {
        AddResetToken("once", DateTime.UtcNow.AddMinutes(30));
        await CreateController().ResetPassword(new ResetPasswordRequest("once", NewPassword), CancellationToken.None);

        var result = await CreateController().ResetPassword(
            new ResetPasswordRequest("once", "AnotherPass123"), CancellationToken.None);

        AssertMessage(Assert.IsType<BadRequestObjectResult>(result), "Reset link is invalid or has expired.");
    }

    [Fact]
    public async Task ResetPassword_ShortPassword_ReturnsBadRequestWithPasswordMessage()
    {
        AddResetToken("valid", DateTime.UtcNow.AddMinutes(30));

        var result = await CreateController().ResetPassword(
            new ResetPasswordRequest("valid", "short"), CancellationToken.None);

        AssertMessage(
            Assert.IsType<BadRequestObjectResult>(result), "Password must be at least 8 characters long.");
        Assert.Equal(_passwordHasher.Hash(Password), _user.PasswordHash);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task ResetPassword_MissingOrEmptyPassword_ReturnsBadRequestWithPasswordMessage(string? newPassword)
    {
        AddResetToken("valid", DateTime.UtcNow.AddMinutes(30));

        var result = await CreateController().ResetPassword(
            new ResetPasswordRequest("valid", newPassword), CancellationToken.None);

        AssertMessage(
            Assert.IsType<BadRequestObjectResult>(result), "Password must be at least 8 characters long.");
    }

    [Theory]
    [InlineData(nameof(AuthController.ForgotPassword), "forgot-password")]
    [InlineData(nameof(AuthController.ResetPassword), "reset-password")]
    public void PasswordResetEndpoints_AreAnonymousRateLimitedPosts(string actionName, string template)
    {
        var action = typeof(AuthController).GetMethod(actionName)!;

        Assert.NotNull(action.GetCustomAttribute<AllowAnonymousAttribute>());
        Assert.Equal(template, action.GetCustomAttribute<HttpPostAttribute>()?.Template);
        Assert.Equal(
            RateLimitingPolicies.PasswordReset,
            action.GetCustomAttribute<EnableRateLimitingAttribute>()?.PolicyName);
        Assert.Contains(
            action.GetCustomAttributes<ProducesResponseTypeAttribute>(),
            attribute => attribute.StatusCode == StatusCodes.Status429TooManyRequests);
    }
}
