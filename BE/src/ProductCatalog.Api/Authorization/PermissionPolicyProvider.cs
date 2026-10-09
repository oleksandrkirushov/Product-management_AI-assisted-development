using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace ProductCatalog.Api.Authorization;

/// <summary>
/// Resolves <c>[Authorize(Policy = "resource:action")]</c> on the fly into a policy with
/// <see cref="PermissionRequirement"/>. Explicitly registered policies, the default policy
/// (plain <c>[Authorize]</c>) and role-based checks are delegated to <see cref="DefaultAuthorizationPolicyProvider"/>.
/// A policy name is treated as a permission only if it contains <c>':'</c>.
/// </summary>
public sealed class PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : IAuthorizationPolicyProvider
{
    private readonly DefaultAuthorizationPolicyProvider fallbackProvider = new(options);

    public async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        var registeredPolicy = await fallbackProvider.GetPolicyAsync(policyName);
        if (registeredPolicy is not null || !IsPermissionPolicyName(policyName))
            return registeredPolicy;

        return new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddRequirements(new PermissionRequirement(policyName))
            .Build();
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => fallbackProvider.GetDefaultPolicyAsync();

    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => fallbackProvider.GetFallbackPolicyAsync();

    private static bool IsPermissionPolicyName(string policyName) =>
        !string.IsNullOrWhiteSpace(policyName) && policyName.Contains(':');
}
