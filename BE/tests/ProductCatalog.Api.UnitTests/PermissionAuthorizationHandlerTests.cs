using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using ProductCatalog.Api.Authorization;
using ProductCatalog.Application.Authorization;

namespace ProductCatalog.Api.UnitTests;

public sealed class PermissionAuthorizationHandlerTests
{
    private static async Task<bool> EvaluateAsync(string requiredPermission, params Claim[] claims)
    {
        var requirement = new PermissionRequirement(requiredPermission);
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType: "Test"));
        var context = new AuthorizationHandlerContext([requirement], user, resource: null);

        await new PermissionAuthorizationHandler().HandleAsync(context);

        return context.HasSucceeded;
    }

    private static Claim PermissionsClaim(string json) =>
        new(PermissionAuthorizationHandler.PermissionsClaimType, json);

    [Fact]
    public async Task HandleAsync_WithoutPermissionsClaim_DoesNotSucceed() =>
        Assert.False(await EvaluateAsync(Permissions.UsersRead, new Claim(ClaimTypes.Name, "alice")));

    [Theory]
    [InlineData("not-json")]
    [InlineData("[\"users:read\"")]
    [InlineData("\"users:read\"")]
    [InlineData("{\"permission\":\"users:read\"}")]
    [InlineData("[1, 2]")]
    [InlineData("null")]
    [InlineData("")]
    public async Task HandleAsync_WithMalformedPermissionsClaim_DoesNotSucceedAndDoesNotThrow(string json) =>
        Assert.False(await EvaluateAsync(Permissions.UsersRead, PermissionsClaim(json)));

    [Theory]
    [InlineData("[\"users:read\"]")]
    [InlineData("[\"users:*\"]")]
    [InlineData("[\"*\"]")]
    public async Task HandleAsync_WithGrantingPermission_Succeeds(string json) =>
        Assert.True(await EvaluateAsync(Permissions.UsersRead, PermissionsClaim(json)));

    [Fact]
    public async Task HandleAsync_WithEmptyPermissionsArray_DoesNotSucceed() =>
        Assert.False(await EvaluateAsync(Permissions.UsersRead, PermissionsClaim("[]")));

    [Fact]
    public async Task HandleAsync_WithMalformedAndGrantingPermissionsClaims_Succeeds() =>
        Assert.True(await EvaluateAsync(
            Permissions.UsersRead,
            PermissionsClaim("not-json"),
            PermissionsClaim("[\"users:read\"]")));

    // AC19: authorization is decided by the permissions claim, not by the role claim.
    [Fact]
    public async Task HandleAsync_AdminRoleWithoutUsersReadPermission_DoesNotSucceed() =>
        Assert.False(await EvaluateAsync(
            Permissions.UsersRead,
            new Claim(ClaimTypes.Role, "Admin"),
            PermissionsClaim("[\"products:read\"]")));

    [Fact]
    public async Task HandleAsync_NonAdminRoleWithUsersReadPermission_Succeeds() =>
        Assert.True(await EvaluateAsync(
            Permissions.UsersRead,
            new Claim(ClaimTypes.Role, "User"),
            PermissionsClaim("[\"users:read\"]")));
}
