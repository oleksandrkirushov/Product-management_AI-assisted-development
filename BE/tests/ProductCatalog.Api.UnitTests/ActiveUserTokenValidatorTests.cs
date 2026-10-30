using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using ProductCatalog.Api.Authentication;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;
using JsonWebTokenHandler = Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler;

namespace ProductCatalog.Api.UnitTests;

// AC23: a deactivated or deleted user loses access immediately, even with a still-valid token.
// Password reset: a password change revokes every token issued before it (security stamp, "sst").
public sealed class ActiveUserTokenValidatorTests
{
    private sealed class InMemoryUserRepository : IUserRepository
    {
        public List<User> Items { get; } = [];
        public List<Guid> RequestedIds { get; } = [];
        public List<string> RequestedUsernames { get; } = [];
        public CancellationToken LastCancellationToken { get; private set; }

        public Task<User?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            RequestedIds.Add(id);
            LastCancellationToken = cancellationToken;
            return Task.FromResult(Items.FirstOrDefault(x => x.Id == id));
        }

        public Task<User?> FindByUsernameAsync(string username, CancellationToken cancellationToken = default)
        {
            RequestedUsernames.Add(username);
            return Task.FromResult(Items.FirstOrDefault(x => x.Username == username));
        }

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

        public void Update(User user) { }

        public void Remove(User user) => Items.Remove(user);
    }

    private static User CreateUser(string username = "jdoe") =>
        new(username, $"{username}@example.com", "John", "Doe", "hashed:Secret123", Guid.NewGuid());

    private static ClaimsPrincipal PrincipalWith(params Claim[] claims) =>
        new(new ClaimsIdentity(claims, authenticationType: "Test"));

    private static ClaimsPrincipal PrincipalWith(string userId, string username, string securityStamp) =>
        PrincipalWith(
            new Claim(ActiveUserTokenValidator.UserIdClaimType, userId),
            new Claim(ClaimTypes.Name, username),
            new Claim(ActiveUserTokenValidator.SecurityStampClaimType, securityStamp));

    // The principal a token issued to this user at login would produce.
    private static ClaimsPrincipal PrincipalFor(User user) =>
        PrincipalWith(user.Id.ToString(), user.Username, user.SecurityStamp);

    [Fact]
    public async Task IsAllowedAsync_ActiveUser_ReturnsTrue()
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };

        var result = await ActiveUserTokenValidator.IsAllowedAsync(PrincipalFor(user), repository);

        Assert.True(result);
        Assert.Equal([user.Id], repository.RequestedIds);
        // The user is resolved by Id only: a lookup by name is exactly what made the token revivable.
        Assert.Empty(repository.RequestedUsernames);
    }

    [Fact]
    public async Task IsAllowedAsync_DeactivatedUser_ReturnsFalse()
    {
        var user = CreateUser();
        user.Deactivate();
        var repository = new InMemoryUserRepository { Items = { user } };

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(PrincipalFor(user), repository));
    }

    [Fact]
    public async Task IsAllowedAsync_ReactivatedUser_ReturnsTrue()
    {
        var user = CreateUser();
        user.Deactivate();
        user.Activate();
        var repository = new InMemoryUserRepository { Items = { user } };

        Assert.True(await ActiveUserTokenValidator.IsAllowedAsync(PrincipalFor(user), repository));
    }

    [Fact]
    public async Task IsAllowedAsync_DeletedUser_ReturnsFalse()
    {
        var deleted = CreateUser();
        var repository = new InMemoryUserRepository { Items = { CreateUser("someone-else") } };

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(PrincipalFor(deleted), repository));
    }

    // Regression: a deleted admin's token must not come back to life when the freed username is
    // registered again (the new account has the same name but a different Id).
    [Fact]
    public async Task IsAllowedAsync_DeletedUserReRegisteredWithSameUsername_ReturnsFalse()
    {
        var deletedAdmin = CreateUser("bob");
        var oldTokenPrincipal = PrincipalFor(deletedAdmin);
        var reRegistered = CreateUser("bob");
        var repository = new InMemoryUserRepository { Items = { reRegistered } };

        Assert.NotEqual(deletedAdmin.Id, reRegistered.Id);
        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(oldTokenPrincipal, repository));
        Assert.True(await ActiveUserTokenValidator.IsAllowedAsync(PrincipalFor(reRegistered), repository));
    }

    [Fact]
    public async Task IsAllowedAsync_UserIdOfAnotherActiveUserWithForeignName_ReturnsFalse()
    {
        var alice = CreateUser("alice");
        var bob = CreateUser("bob");
        var repository = new InMemoryUserRepository { Items = { alice, bob } };

        var principal = PrincipalWith(alice.Id.ToString(), bob.Username, alice.SecurityStamp);

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(principal, repository));
    }

    [Fact]
    public async Task IsAllowedAsync_NameDiffersOnlyByCase_ReturnsFalse()
    {
        var user = CreateUser("jdoe");
        var repository = new InMemoryUserRepository { Items = { user } };

        var principal = PrincipalWith(user.Id.ToString(), "JDoe", user.SecurityStamp);

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(principal, repository));
    }

    [Fact]
    public async Task IsAllowedAsync_NullPrincipal_ReturnsFalseWithoutQueryingRepository()
    {
        var repository = new InMemoryUserRepository { Items = { CreateUser() } };

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(principal: null, repository));
        Assert.Empty(repository.RequestedIds);
    }

    // A token issued before the uid claim existed (name only) is rejected.
    [Fact]
    public async Task IsAllowedAsync_TokenWithoutUserIdClaim_ReturnsFalseWithoutQueryingRepository()
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };
        var principal = PrincipalWith(
            new Claim(JwtRegisteredClaimNames.Sub, user.Username),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, "Admin"));

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(principal, repository));
        Assert.Empty(repository.RequestedIds);
        Assert.Empty(repository.RequestedUsernames);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("jdoe")]
    [InlineData("12345")]
    [InlineData("not-a-guid")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public async Task IsAllowedAsync_UserIdClaimIsNotAUsableGuid_ReturnsFalseWithoutQueryingRepository(string userId)
    {
        var repository = new InMemoryUserRepository { Items = { CreateUser() } };

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(
            PrincipalWith(userId, "jdoe", "some-stamp"), repository));
        Assert.Empty(repository.RequestedIds);
    }

    [Fact]
    public async Task IsAllowedAsync_PrincipalWithoutNameClaim_ReturnsFalseWithoutQueryingRepository()
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };
        var principal = PrincipalWith(
            new Claim(ActiveUserTokenValidator.UserIdClaimType, user.Id.ToString()),
            new Claim(ClaimTypes.Email, "jdoe@example.com"),
            new Claim(ClaimTypes.Role, "Admin"));

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(principal, repository));
        Assert.Empty(repository.RequestedIds);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task IsAllowedAsync_EmptyOrWhitespaceName_ReturnsFalseWithoutQueryingRepository(string username)
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(
            PrincipalWith(user.Id.ToString(), username, user.SecurityStamp), repository));
        Assert.Empty(repository.RequestedIds);
    }

    [Fact]
    public async Task IsAllowedAsync_PassesCancellationTokenToRepository()
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };
        using var cancellation = new CancellationTokenSource();

        await ActiveUserTokenValidator.IsAllowedAsync(PrincipalFor(user), repository, cancellation.Token);

        Assert.Equal(cancellation.Token, repository.LastCancellationToken);
    }

    // The claim must survive the real issue -> validate round trip under the name the validator reads.
    // Tokens are written the way AuthController does and read by JsonWebTokenHandler with
    // MapInboundClaims = true, i.e. the handler and setting JwtBearer uses by default (Program.cs does
    // not override either). Inbound mapping only renames well-known short names, so "uid" is untouched.
    [Fact]
    public async Task UserIdClaim_SurvivesJwtRoundTripWithInboundClaimMapping()
    {
        var user = CreateUser();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("unit-test-signing-key-at-least-32-bytes!"));
        var jwt = new JwtSecurityToken(
            "test-issuer",
            "test-audience",
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Username),
                new Claim(ActiveUserTokenValidator.UserIdClaimType, user.Id.ToString()),
                new Claim(ActiveUserTokenValidator.SecurityStampClaimType, user.SecurityStamp),
                new Claim(ClaimTypes.Name, user.Username)
            ],
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        var encoded = new JwtSecurityTokenHandler().WriteToken(jwt);

        var validation = await new JsonWebTokenHandler { MapInboundClaims = true }.ValidateTokenAsync(
            encoded,
            new TokenValidationParameters
            {
                ValidIssuer = "test-issuer",
                ValidAudience = "test-audience",
                IssuerSigningKey = key
            });

        Assert.True(validation.IsValid);
        Assert.False(JsonWebTokenHandler.DefaultInboundClaimTypeMap.ContainsKey(ActiveUserTokenValidator.UserIdClaimType));
        Assert.False(JsonWebTokenHandler.DefaultInboundClaimTypeMap.ContainsKey(ActiveUserTokenValidator.SecurityStampClaimType));
        var principal = new ClaimsPrincipal(validation.ClaimsIdentity);
        Assert.Equal(user.Id.ToString(), principal.FindFirstValue(ActiveUserTokenValidator.UserIdClaimType));
        Assert.Equal(user.Username, principal.FindFirstValue(ClaimTypes.Name));
        Assert.Equal(user.SecurityStamp, principal.FindFirstValue(ActiveUserTokenValidator.SecurityStampClaimType));

        var repository = new InMemoryUserRepository { Items = { user } };
        Assert.True(await ActiveUserTokenValidator.IsAllowedAsync(principal, repository));
    }

    // A token issued before the security stamp existed (no "sst") is rejected: users have to log in again.
    [Fact]
    public async Task IsAllowedAsync_TokenWithoutSecurityStampClaim_ReturnsFalseWithoutQueryingRepository()
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };
        var principal = PrincipalWith(
            new Claim(ActiveUserTokenValidator.UserIdClaimType, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username));

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(principal, repository));
        Assert.Empty(repository.RequestedIds);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task IsAllowedAsync_EmptyOrWhitespaceSecurityStamp_ReturnsFalseWithoutQueryingRepository(string stamp)
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(
            PrincipalWith(user.Id.ToString(), user.Username, stamp), repository));
        Assert.Empty(repository.RequestedIds);
    }

    [Fact]
    public async Task IsAllowedAsync_DifferentSecurityStamp_ReturnsFalse()
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(
            PrincipalWith(user.Id.ToString(), user.Username, "another-stamp"), repository));
    }

    [Fact]
    public async Task IsAllowedAsync_SecurityStampDiffersOnlyByCase_ReturnsFalse()
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(
            PrincipalWith(user.Id.ToString(), user.Username, user.SecurityStamp.ToUpperInvariant()), repository));
    }

    [Fact]
    public async Task IsAllowedAsync_MatchingSecurityStamp_ReturnsTrue()
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };

        Assert.True(await ActiveUserTokenValidator.IsAllowedAsync(
            PrincipalWith(user.Id.ToString(), user.Username, user.SecurityStamp), repository));
    }

    [Fact]
    public async Task IsAllowedAsync_TokenIssuedBeforePasswordChange_ReturnsFalse()
    {
        var user = CreateUser();
        var repository = new InMemoryUserRepository { Items = { user } };
        var issuedBeforeChange = PrincipalFor(user);

        user.ChangePasswordHash("hashed:NewSecret123");

        Assert.False(await ActiveUserTokenValidator.IsAllowedAsync(issuedBeforeChange, repository));
        Assert.True(await ActiveUserTokenValidator.IsAllowedAsync(PrincipalFor(user), repository));
    }
}
