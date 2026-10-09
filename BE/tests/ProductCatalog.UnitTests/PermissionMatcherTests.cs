using ProductCatalog.Application.Authorization;

namespace ProductCatalog.UnitTests;

public sealed class PermissionMatcherTests
{
    [Theory]
    [InlineData(new[] { "*" }, "users:read")]
    [InlineData(new[] { "users:read" }, "users:read")]
    [InlineData(new[] { "users:*" }, "users:read")]
    [InlineData(new[] { "users:*" }, "users:manage")]
    [InlineData(new[] { "users:*" }, "users:read:extra")]
    [InlineData(new[] { "products:read", "users:read" }, "users:read")]
    public void IsGranted_WithMatchingPermission_ReturnsTrue(string[] granted, string required) =>
        Assert.True(PermissionMatcher.IsGranted(granted, required));

    [Theory]
    [InlineData(new[] { "products:read" }, "users:read")]
    [InlineData(new[] { "products:*" }, "users:read")]
    [InlineData(new[] { "users:read" }, "users:manage")]
    [InlineData(new[] { "Users:Read" }, "users:read")]
    [InlineData(new[] { "*:read" }, "users:read")]
    [InlineData(new[] { " users:read" }, "users:read")]
    [InlineData(new string[0], "users:read")]
    public void IsGranted_WithoutMatchingPermission_ReturnsFalse(string[] granted, string required) =>
        Assert.False(PermissionMatcher.IsGranted(granted, required));

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void IsGranted_WithEmptyRequired_ReturnsFalse(string required) =>
        Assert.False(PermissionMatcher.IsGranted(["*"], required));
}
