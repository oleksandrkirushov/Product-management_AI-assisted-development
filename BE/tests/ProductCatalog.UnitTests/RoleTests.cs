using ProductCatalog.Domain.Entities;

namespace ProductCatalog.UnitTests;

public sealed class RoleTests
{
    [Fact]
    public void Constructor_WithValidData_CreatesRole()
    {
        var role = new Role("Admin", ["*"]);

        Assert.NotEqual(Guid.Empty, role.Id);
        Assert.Equal("Admin", role.Name);
        Assert.Equal(["*"], role.Permissions);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_WithInvalidName_Throws(string name) =>
        Assert.Throws<ArgumentException>(() => new Role(name, ["products:read"]));

    [Fact]
    public void Constructor_WithEmptyPermissions_Throws() =>
        Assert.Throws<ArgumentException>(() => new Role("User", []));
}
