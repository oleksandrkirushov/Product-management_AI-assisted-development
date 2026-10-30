using ProductCatalog.Domain.Entities;

namespace ProductCatalog.UnitTests;

public sealed class PasswordResetTokenTests
{
    private static readonly DateTime CreatedAt = new(2026, 10, 30, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime ExpiresAt = CreatedAt.AddMinutes(30);

    private static PasswordResetToken CreateToken() => new(Guid.NewGuid(), "token-hash", CreatedAt, ExpiresAt);

    [Fact]
    public void Constructor_WithValidData_CreatesUnusedToken()
    {
        var userId = Guid.NewGuid();

        var token = new PasswordResetToken(userId, "token-hash", CreatedAt, ExpiresAt);

        Assert.NotEqual(Guid.Empty, token.Id);
        Assert.Equal(userId, token.UserId);
        Assert.Equal("token-hash", token.TokenHash);
        Assert.Equal(CreatedAt, token.CreatedAtUtc);
        Assert.Equal(ExpiresAt, token.ExpiresAtUtc);
        Assert.Null(token.UsedAtUtc);
    }

    [Fact]
    public void Constructor_WithEmptyUserId_Throws() =>
        Assert.Throws<ArgumentException>(() => new PasswordResetToken(Guid.Empty, "token-hash", CreatedAt, ExpiresAt));

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_WithEmptyTokenHash_Throws(string tokenHash) =>
        Assert.Throws<ArgumentException>(() => new PasswordResetToken(Guid.NewGuid(), tokenHash, CreatedAt, ExpiresAt));

    [Fact]
    public void Constructor_WithTooLongTokenHash_Throws() =>
        Assert.Throws<ArgumentException>(() => new PasswordResetToken(
            Guid.NewGuid(), new string('a', PasswordResetToken.TokenHashMaxLength + 1), CreatedAt, ExpiresAt));

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Constructor_WithExpirationNotAfterCreation_Throws(int lifetimeMinutes) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => new PasswordResetToken(
            Guid.NewGuid(), "token-hash", CreatedAt, CreatedAt.AddMinutes(lifetimeMinutes)));

    [Fact]
    public void IsUsable_BeforeExpiration_ReturnsTrue() =>
        Assert.True(CreateToken().IsUsable(ExpiresAt.AddTicks(-1)));

    [Fact]
    public void IsUsable_AtOrAfterExpiration_ReturnsFalse()
    {
        var token = CreateToken();

        Assert.False(token.IsUsable(ExpiresAt));
        Assert.False(token.IsUsable(ExpiresAt.AddMinutes(1)));
    }

    [Fact]
    public void MarkUsed_SetsUsedAtAndMakesTokenUnusable()
    {
        var token = CreateToken();
        var usedAt = CreatedAt.AddMinutes(5);

        token.MarkUsed(usedAt);

        Assert.Equal(usedAt, token.UsedAtUtc);
        Assert.False(token.IsUsable(usedAt));
    }

    [Fact]
    public void MarkUsed_WhenAlreadyUsed_ThrowsAndKeepsFirstUsage()
    {
        var token = CreateToken();
        var firstUse = CreatedAt.AddMinutes(5);
        token.MarkUsed(firstUse);

        Assert.Throws<InvalidOperationException>(() => token.MarkUsed(CreatedAt.AddMinutes(6)));
        Assert.Equal(firstUse, token.UsedAtUtc);
    }
}
