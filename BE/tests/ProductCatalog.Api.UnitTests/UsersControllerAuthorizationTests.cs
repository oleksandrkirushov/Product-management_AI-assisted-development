using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Routing;
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

    [Theory]
    [InlineData(nameof(UsersController.Activate))]
    [InlineData(nameof(UsersController.Deactivate))]
    [InlineData(nameof(UsersController.Delete))]
    public void ManageMethod_RequiresUsersManagePolicyWithoutRoles(string methodName)
    {
        var attribute = Assert.Single(MethodAuthorizeAttributes(methodName));

        Assert.Equal(Permissions.UsersManage, attribute.Policy);
        Assert.Null(attribute.Roles);
    }

    [Theory]
    [InlineData(nameof(UsersController.Activate), "PATCH", "{id:guid}/activate")]
    [InlineData(nameof(UsersController.Deactivate), "PATCH", "{id:guid}/deactivate")]
    [InlineData(nameof(UsersController.Delete), "DELETE", "{id:guid}")]
    public void ManageMethod_HasHttpMethodAndRouteTemplateFromContract(
        string methodName, string expectedHttpMethod, string expectedTemplate)
    {
        var attribute = Assert.Single(
            typeof(UsersController).GetMethod(methodName, BindingFlags.Public | BindingFlags.Instance)!
                .GetCustomAttributes<HttpMethodAttribute>(inherit: true));

        Assert.Equal(expectedHttpMethod, Assert.Single(attribute.HttpMethods));
        Assert.Equal(expectedTemplate, attribute.Template);
    }
}
