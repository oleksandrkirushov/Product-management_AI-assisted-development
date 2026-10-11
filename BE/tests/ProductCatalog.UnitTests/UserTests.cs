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
}
