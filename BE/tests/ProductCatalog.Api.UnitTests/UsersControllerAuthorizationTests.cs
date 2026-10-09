using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using ProductCatalog.Api.Controllers;
using ProductCatalog.Application.Authorization;

namespace ProductCatalog.Api.UnitTests;

public sealed class UsersControllerAuthorizationTests
{
    private static IReadOnlyList<AuthorizeAttribute> MethodAuthorizeAttributes(string methodName) =>
        typeof(UsersController).GetMethod(methodName, BindingFlags.Public | BindingFlags.Instance)!
            .GetCustomAttributes<AuthorizeAttribute>(inherit: true)
            .ToList();

    private static IReadOnlyList<AuthorizeAttribute> ClassAuthorizeAttributes() =>
        typeof(UsersController).GetCustomAttributes<AuthorizeAttribute>(inherit: true).ToList();

    [Fact]
    public void Class_HasPlainAuthorizeWithoutPolicyOrRoles()
    {
        var attribute = Assert.Single(ClassAuthorizeAttributes());

        Assert.Null(attribute.Policy);
        Assert.Null(attribute.Roles);
    }

    [Theory]
    [InlineData(nameof(UsersController.GetAll))]
    [InlineData(nameof(UsersController.GetById))]
    public void ReadMethod_RequiresUsersReadPolicyWithoutRoles(string methodName)
    {
        var attribute = Assert.Single(MethodAuthorizeAttributes(methodName));

        Assert.Equal(Permissions.UsersRead, attribute.Policy);
        Assert.Null(attribute.Roles);
    }

    [Fact]
    public void Me_HasNoMethodLevelAuthorize() =>
        Assert.Empty(MethodAuthorizeAttributes(nameof(UsersController.Me)));
}
