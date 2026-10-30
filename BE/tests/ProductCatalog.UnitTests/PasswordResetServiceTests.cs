using ProductCatalog.Application.Abstractions;
using ProductCatalog.Application.Users;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.UnitTests;

public sealed class PasswordResetServiceTests
{
    private sealed class InMemoryUserRepository : IUserRepository
    {
        public List<User> Items { get; } = [];
        public List<User> Updated { get; } = [];

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

        public void Update(User user) => Updated.Add(user);

        public void Remove(User user) => Items.Remove(user);
    }

    private sealed class InMemoryPasswordResetTokenRepository : IPasswordResetTokenRepository
    {
        public List<PasswordResetToken> Items { get; } = [];
        public List<PasswordResetToken> Updated { get; } = [];

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

        public void Update(PasswordResetToken token) => Updated.Add(token);
    }

    // Deterministic tokens ("token-1", "token-2", ...) and a recognisable, non-identity hash.
    private sealed class FakeTokenGenerator : IPasswordResetTokenGenerator
    {
        private int _counter;

        public string GenerateToken() => $"token-{++_counter}";

        public string HashToken(string token) => $"hash:{token}";
    }

    private sealed class FakePasswordHasher : IPasswordHasher
    {
        public string Hash(string password) => $"hashed:{password}";

        public bool Verify(string password, string passwordHash) => passwordHash == Hash(password);
    }

    private sealed record SentEmail(string To, string Subject, string Body, CancellationToken CancellationToken);

    private sealed class RecordingEmailSender : IEmailSender
    {
        public List<SentEmail> Sent { get; } = [];

        public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
        {
            Sent.Add(new SentEmail(to, subject, body, cancellationToken));
            return Task.CompletedTask;
        }
    }

    private sealed class CountingUnitOfWork : IUnitOfWork
    {
        public int SaveCount { get; private set; }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SaveCount++;
            return Task.FromResult(1);
        }
    }

    private sealed class ManualTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public DateTimeOffset UtcNow { get; set; } = utcNow;

        public override DateTimeOffset GetUtcNow() => UtcNow;
    }

    private const string NewPassword = "NewPass123";

    private static readonly DateTimeOffset Now = new(2026, 10, 30, 12, 0, 0, TimeSpan.Zero);

    private static readonly PasswordResetOptions Options = new()
    {
        ResetUrl = "http://localhost:4200/reset-password",
        TokenLifetimeMinutes = 30
    };

    private readonly InMemoryUserRepository _users = new();
    private readonly InMemoryPasswordResetTokenRepository _tokens = new();
    private readonly RecordingEmailSender _emailSender = new();
    private readonly CountingUnitOfWork _unitOfWork = new();
    private readonly ManualTimeProvider _time = new(Now);
    private readonly User _user = new("jdoe", "jdoe@example.com", "John", "Doe", "hashed:OldPass123", Guid.NewGuid());

    public PasswordResetServiceTests() => _users.Items.Add(_user);

    private PasswordResetService CreateService() =>
        new(
            _users,
            _tokens,
            new FakeTokenGenerator(),
            new FakePasswordHasher(),
            _emailSender,
            _unitOfWork,
            _time,
            Options);

    private PasswordResetToken AddToken(string rawToken, DateTime? expiresAtUtc = null, User? user = null)
    {
        var token = new PasswordResetToken(
            (user ?? _user).Id,
            $"hash:{rawToken}",
            Now.UtcDateTime.AddMinutes(-1),
            expiresAtUtc ?? Now.UtcDateTime.AddMinutes(29));
        _tokens.Items.Add(token);
        return token;
    }

    [Fact]
    public async Task RequestResetAsync_UnknownEmail_DoesNothingAndDoesNotThrow()
    {
        await CreateService().RequestResetAsync("nobody@example.com");

        Assert.Empty(_tokens.Items);
        Assert.Empty(_emailSender.Sent);
        Assert.Equal(0, _unitOfWork.SaveCount);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task RequestResetAsync_BlankEmail_DoesNothing(string email)
    {
        await CreateService().RequestResetAsync(email);

        Assert.Empty(_tokens.Items);
        Assert.Empty(_emailSender.Sent);
    }

    [Fact]
    public async Task RequestResetAsync_InactiveUser_DoesNothingAndDoesNotThrow()
    {
        _user.Deactivate();

        await CreateService().RequestResetAsync(_user.Email);

        Assert.Empty(_tokens.Items);
        Assert.Empty(_emailSender.Sent);
        Assert.Equal(0, _unitOfWork.SaveCount);
    }

    [Fact]
    public async Task RequestResetAsync_ActiveUser_StoresOnlyTokenHashAndEmailsLink()
    {
        await CreateService().RequestResetAsync(_user.Email);

        var stored = Assert.Single(_tokens.Items);
        Assert.Equal(_user.Id, stored.UserId);
        Assert.Equal("hash:token-1", stored.TokenHash);
        Assert.Equal(Now.UtcDateTime, stored.CreatedAtUtc);
        Assert.Equal(Now.UtcDateTime.AddMinutes(Options.TokenLifetimeMinutes), stored.ExpiresAtUtc);
        Assert.Null(stored.UsedAtUtc);
        Assert.Equal(1, _unitOfWork.SaveCount);

        var email = Assert.Single(_emailSender.Sent);
        Assert.Equal(_user.Email, email.To);
        Assert.False(string.IsNullOrWhiteSpace(email.Subject));
        Assert.Contains("http://localhost:4200/reset-password?token=token-1", email.Body);
        Assert.DoesNotContain(stored.TokenHash, email.Body);
    }

    [Fact]
    public async Task RequestResetAsync_EmailWithSurroundingWhitespace_FindsUser()
    {
        await CreateService().RequestResetAsync($"  {_user.Email}  ");

        Assert.Single(_tokens.Items);
        Assert.Single(_emailSender.Sent);
    }

    [Fact]
    public async Task RequestResetAsync_WithOutstandingTokens_InvalidatesThemAndIssuesNewOne()
    {
        var previous = AddToken("previous");
        var otherUser = new User("jane", "jane@example.com", "Jane", "Doe", "hash", Guid.NewGuid());
        _users.Items.Add(otherUser);
        var otherUsersToken = AddToken("other", user: otherUser);

        await CreateService().RequestResetAsync(_user.Email);

        Assert.Equal(Now.UtcDateTime, previous.UsedAtUtc);
        Assert.Contains(previous, _tokens.Updated);
        Assert.Null(otherUsersToken.UsedAtUtc);
        Assert.DoesNotContain(otherUsersToken, _tokens.Updated);

        var issued = Assert.Single(_tokens.Items, x => x.TokenHash == "hash:token-1");
        Assert.True(issued.IsUsable(Now.UtcDateTime));
        Assert.Equal(1, _unitOfWork.SaveCount);
    }

    [Fact]
    public async Task RequestResetAsync_ThenResetWithPreviousLink_Throws()
    {
        AddToken("previous");
        var service = CreateService();
        await service.RequestResetAsync(_user.Email);

        await Assert.ThrowsAsync<InvalidPasswordResetTokenException>(
            () => service.ResetAsync(new ResetPasswordCommand("previous", NewPassword)));
    }

    [Fact]
    public async Task ResetAsync_ValidToken_ChangesPasswordRotatesStampAndConsumesTokenInOneSave()
    {
        var token = AddToken("valid");
        var stampBefore = _user.SecurityStamp;

        await CreateService().ResetAsync(new ResetPasswordCommand("valid", NewPassword));

        Assert.Equal($"hashed:{NewPassword}", _user.PasswordHash);
        Assert.NotEqual(stampBefore, _user.SecurityStamp);
        Assert.Contains(_user, _users.Updated);
        Assert.Equal(Now.UtcDateTime, token.UsedAtUtc);
        Assert.Contains(token, _tokens.Updated);
        Assert.Equal(1, _unitOfWork.SaveCount);
    }

    [Fact]
    public async Task ResetAsync_ExpiredToken_ThrowsAndKeepsPassword()
    {
        var token = AddToken("expired");
        _time.UtcNow = Now.AddMinutes(30);

        await Assert.ThrowsAsync<InvalidPasswordResetTokenException>(
            () => CreateService().ResetAsync(new ResetPasswordCommand("expired", NewPassword)));

        Assert.Equal("hashed:OldPass123", _user.PasswordHash);
        Assert.Null(token.UsedAtUtc);
        Assert.Equal(0, _unitOfWork.SaveCount);
    }

    [Fact]
    public async Task ResetAsync_AlreadyUsedToken_Throws()
    {
        AddToken("once");
        var service = CreateService();
        await service.ResetAsync(new ResetPasswordCommand("once", NewPassword));

        await Assert.ThrowsAsync<InvalidPasswordResetTokenException>(
            () => service.ResetAsync(new ResetPasswordCommand("once", "AnotherPass123")));

        Assert.Equal($"hashed:{NewPassword}", _user.PasswordHash);
        Assert.Equal(1, _unitOfWork.SaveCount);
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ResetAsync_UnknownOrBlankToken_Throws(string rawToken)
    {
        AddToken("valid");

        var exception = await Assert.ThrowsAsync<InvalidPasswordResetTokenException>(
            () => CreateService().ResetAsync(new ResetPasswordCommand(rawToken, NewPassword)));

        Assert.Equal("Reset link is invalid or has expired.", exception.Message);
        Assert.Equal(0, _unitOfWork.SaveCount);
    }

    [Fact]
    public async Task ResetAsync_RawTokenEqualToStoredHash_Throws()
    {
        // The lookup goes through the hash: knowing the stored value (e.g. from a DB leak) is not enough.
        AddToken("valid");

        await Assert.ThrowsAsync<InvalidPasswordResetTokenException>(
            () => CreateService().ResetAsync(new ResetPasswordCommand("hash:valid", NewPassword)));
    }

    [Fact]
    public async Task ResetAsync_InactiveUser_ThrowsAndKeepsToken()
    {
        var token = AddToken("valid");
        _user.Deactivate();

        await Assert.ThrowsAsync<InvalidPasswordResetTokenException>(
            () => CreateService().ResetAsync(new ResetPasswordCommand("valid", NewPassword)));

        Assert.Equal("hashed:OldPass123", _user.PasswordHash);
        Assert.Null(token.UsedAtUtc);
    }

    [Fact]
    public async Task ResetAsync_DeletedUser_Throws()
    {
        AddToken("valid");
        _users.Items.Remove(_user);

        await Assert.ThrowsAsync<InvalidPasswordResetTokenException>(
            () => CreateService().ResetAsync(new ResetPasswordCommand("valid", NewPassword)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("        ")]
    [InlineData("Short1!")]
    public async Task ResetAsync_PasswordTooShort_ThrowsInvalidPasswordExceptionAndKeepsToken(string password)
    {
        var token = AddToken("valid");

        var exception = await Assert.ThrowsAsync<InvalidPasswordException>(
            () => CreateService().ResetAsync(new ResetPasswordCommand("valid", password)));

        Assert.Equal("Password must be at least 8 characters long.", exception.Message);
        Assert.Null(token.UsedAtUtc);
        Assert.Equal("hashed:OldPass123", _user.PasswordHash);
        Assert.Equal(0, _unitOfWork.SaveCount);
    }

    [Fact]
    public async Task ResetAsync_NullPassword_ThrowsInvalidPasswordException()
    {
        AddToken("valid");

        await Assert.ThrowsAsync<InvalidPasswordException>(
            () => CreateService().ResetAsync(new ResetPasswordCommand("valid", null!)));
    }

    [Fact]
    public async Task RequestResetAsync_SendsEmailWithoutRequestCancellationToken()
    {
        // After the commit the e-mail must go out even if the caller's request is cancelled meanwhile.
        using var cancellation = new CancellationTokenSource();

        await CreateService().RequestResetAsync(_user.Email, cancellation.Token);

        var email = Assert.Single(_emailSender.Sent);
        Assert.Equal(CancellationToken.None, email.CancellationToken);
    }

    [Fact]
    public async Task ResetAsync_PasswordOfMinimumLength_Succeeds()
    {
        AddToken("valid");
        var password = new string('a', PasswordPolicy.MinimumLength);

        await CreateService().ResetAsync(new ResetPasswordCommand("valid", password));

        Assert.Equal($"hashed:{password}", _user.PasswordHash);
    }
}
