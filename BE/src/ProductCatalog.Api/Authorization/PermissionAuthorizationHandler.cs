using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using ProductCatalog.Application.Authorization;

namespace ProductCatalog.Api.Authorization;

/// <summary>
/// Satisfies <see cref="PermissionRequirement"/> based solely on the <c>"permissions"</c> claim
/// (a JSON-serialized string array issued by <c>AuthController.Login</c>). The role claim is ignored.
/// </summary>
public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    public const string PermissionsClaimType = "permissions";

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        var granted = ReadPermissions(context.User);
        if (PermissionMatcher.IsGranted(granted, requirement.Permission))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }

    private static List<string> ReadPermissions(ClaimsPrincipal user)
    {
        var permissions = new List<string>();
        foreach (var claim in user.FindAll(PermissionsClaimType))
        {
            try
            {
                var values = JsonSerializer.Deserialize<string?[]>(claim.Value);
                if (values is null)
                    continue;

                permissions.AddRange(values.OfType<string>());
            }
            catch (JsonException)
            {
                // Malformed claim grants nothing.
            }
        }

        return permissions;
    }
}
