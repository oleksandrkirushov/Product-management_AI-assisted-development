using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Infrastructure;
using ProductCatalog.Api.Authorization;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace ProductCatalog.Api.UnitTests;

public sealed class PermissionPolicyProviderTests
{
    private static PermissionPolicyProvider CreateProvider(Action<AuthorizationOptions>? configure = null)
    {
        var options = new AuthorizationOptions();
        configure?.Invoke(options);
        return new PermissionPolicyProvider(MsOptions.Create(options));
    }

    [Theory]
    [InlineData("users:read")]
    [InlineData("users:*")]
    public async Task GetPolicyAsync_WithPermissionName_ReturnsPolicyWithPermissionRequirement(string policyName)
    {
        var policy = await CreateProvider().GetPolicyAsync(policyName);

        Assert.NotNull(policy);
        var requirement = Assert.Single(policy.Requirements.OfType<PermissionRequirement>());
        Assert.Equal(policyName, requirement.Permission);
        Assert.Contains(policy.Requirements, r => r is DenyAnonymousAuthorizationRequirement);
    }

    [Fact]
    public async Task GetPolicyAsync_WithRegisteredPolicyName_DelegatesToDefaultProvider()
    {
        var registered = new AuthorizationPolicyBuilder().RequireRole("Admin").Build();
        var provider = CreateProvider(o => o.AddPolicy("users:read", registered));

        var policy = await provider.GetPolicyAsync("users:read");

        Assert.Same(registered, policy);
    }

    [Theory]
    [InlineData("SomeUnknownPolicy")]
    [InlineData("*")]
    [InlineData("")]
    public async Task GetPolicyAsync_WithUnknownNonPermissionName_ReturnsNull(string policyName) =>
        Assert.Null(await CreateProvider().GetPolicyAsync(policyName));

    [Fact]
    public async Task GetDefaultPolicyAsync_DelegatesToDefaultProvider()
    {
        var options = new AuthorizationOptions();
        var provider = new PermissionPolicyProvider(MsOptions.Create(options));

        var policy = await provider.GetDefaultPolicyAsync();

        Assert.Same(options.DefaultPolicy, policy);
    }

    [Fact]
    public async Task GetFallbackPolicyAsync_DelegatesToDefaultProvider() =>
        Assert.Null(await CreateProvider().GetFallbackPolicyAsync());
}
