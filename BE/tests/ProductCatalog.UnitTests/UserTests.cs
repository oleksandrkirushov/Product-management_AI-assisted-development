using ProductCatalog.Domain.Entities;

namespace ProductCatalog.UnitTests;

public sealed class UserTests
{
    [Fact]
    public void Constructor_WithValidData_CreatesUser()
    {
        var roleId = Guid.NewGuid();

        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "hashed-password", roleId);

        Assert.NotEqual(Guid.Empty, user.Id);
        Assert.Equal("jdoe", user.Username);
        Assert.Equal("jdoe@example.com", user.Email);
        Assert.Equal("John", user.FirstName);
        Assert.Equal("Doe", user.LastName);
        Assert.Equal("hashed-password", user.PasswordHash);
        Assert.Equal(roleId, user.RoleId);
        Assert.NotEqual(default, user.CreatedAtUtc);
        Assert.Equal(user.CreatedAtUtc, user.UpdatedAtUtc);
        Assert.True(user.IsActive);
        Assert.False(string.IsNullOrWhiteSpace(user.SecurityStamp));
    }

    [Fact]
    public void Constructor_GeneratesDistinctSecurityStampPerUser()
    {
        var first = new User("jdoe", "jdoe@example.com", "John", "Doe", "hash", Guid.NewGuid());
        var second = new User("jane", "jane@example.com", "Jane", "Doe", "hash", Guid.NewGuid());

        Assert.NotEqual(first.SecurityStamp, second.SecurityStamp);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_WithInvalidUsername_Throws(string username) =>
        Assert.Throws<ArgumentException>(
            () => new User(username, "jdoe@example.com", "John", "Doe", "hash", Guid.NewGuid()));

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("missing-domain@")]
    [InlineData("@missing-local.com")]
    [InlineData("a@b@c.com")]
    public void Constructor_WithInvalidEmail_Throws(string email) =>
        Assert.Throws<ArgumentException>(
            () => new User("jdoe", email, "John", "Doe", "hash", Guid.NewGuid()));

    [Fact]
    public void Constructor_WithEmptyRoleId_Throws() =>
        Assert.Throws<ArgumentException>(
            () => new User("jdoe", "jdoe@example.com", "John", "Doe", "hash", Guid.Empty));

    [Fact]
    public void Deactivate_WhenActive_MarksInactiveAndUpdatesTimestamp()
    {
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "hash", Guid.NewGuid());
        var updatedBefore = user.UpdatedAtUtc;

        user.Deactivate();

        Assert.False(user.IsActive);
        Assert.True(user.UpdatedAtUtc >= updatedBefore);
    }

    [Fact]
    public void Activate_WhenInactive_MarksActive()
    {
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "hash", Guid.NewGuid());
        user.Deactivate();

        user.Activate();

        Assert.True(user.IsActive);
    }

    [Fact]
    public void Activate_WhenAlreadyActive_IsNoOpAndKeepsTimestamp()
    {
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "hash", Guid.NewGuid());
        var updatedBefore = user.UpdatedAtUtc;

        user.Activate();

        Assert.True(user.IsActive);
        Assert.Equal(updatedBefore, user.UpdatedAtUtc);
    }

    [Fact]
    public void Deactivate_WhenAlreadyInactive_IsNoOpAndKeepsTimestamp()
    {
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "hash", Guid.NewGuid());
        user.Deactivate();
        var updatedBefore = user.UpdatedAtUtc;

        user.Deactivate();

        Assert.False(user.IsActive);
        Assert.Equal(updatedBefore, user.UpdatedAtUtc);
    }

    [Fact]
    public void ChangePasswordHash_WithValidHash_UpdatesHashStampAndTimestamp()
    {
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "old-hash", Guid.NewGuid());
        var stampBefore = user.SecurityStamp;
        var updatedBefore = user.UpdatedAtUtc;

        user.ChangePasswordHash("new-hash");

        Assert.Equal("new-hash", user.PasswordHash);
        Assert.False(string.IsNullOrWhiteSpace(user.SecurityStamp));
        Assert.NotEqual(stampBefore, user.SecurityStamp);
        Assert.True(user.UpdatedAtUtc >= updatedBefore);
    }

    [Fact]
    public void ChangePasswordHash_WithSameHashAgain_StillRotatesStamp()
    {
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "hash", Guid.NewGuid());
        var stampBefore = user.SecurityStamp;

        user.ChangePasswordHash("hash");

        Assert.NotEqual(stampBefore, user.SecurityStamp);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ChangePasswordHash_WithEmptyHash_ThrowsAndKeepsState(string newHash)
    {
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "old-hash", Guid.NewGuid());
        var stampBefore = user.SecurityStamp;

        Assert.Throws<ArgumentException>(() => user.ChangePasswordHash(newHash));
        Assert.Equal("old-hash", user.PasswordHash);
        Assert.Equal(stampBefore, user.SecurityStamp);
    }
}
