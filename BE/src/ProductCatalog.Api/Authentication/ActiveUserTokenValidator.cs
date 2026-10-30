using System.Security.Claims;
using ProductCatalog.Application.Abstractions;

namespace ProductCatalog.Api.Authentication;

/// <summary>
/// Decides whether an already signature-valid JWT still belongs to a user that may use the API.
/// A JWT is stateless, so without this check a token issued before the user was deactivated or
/// deleted, or before the password was changed, would keep working until it expires.
/// </summary>
public static class ActiveUserTokenValidator
{
    /// <summary>
    /// JWT claim carrying the user's Id. The token is bound to the Id rather than to the username,
    /// because a username becomes free again once its owner is deleted: a token identified by name
    /// alone would come back to life (with its old claims) as soon as someone re-registers that name.
    /// </summary>
    public const string UserIdClaimType = "uid";

    /// <summary>
    /// JWT claim carrying the user's security stamp at login. The stamp is regenerated on every password
    /// change, so all tokens issued before the change stop matching and are rejected.
    /// </summary>
    public const string SecurityStampClaimType = "sst";

    public const string FailureMessage = "User account is inactive, no longer exists, or the session was revoked.";

    public static async Task<bool> IsAllowedAsync(
        ClaimsPrincipal? principal,
        IUserRepository users,
        CancellationToken cancellationToken = default)
    {
        if (principal is null)
            return false;

        if (!Guid.TryParse(principal.FindFirstValue(UserIdClaimType), out var userId) || userId == Guid.Empty)
            return false;

        var username = principal.FindFirstValue(ClaimTypes.Name);
        if (string.IsNullOrWhiteSpace(username))
            return false;

        // Tokens issued before the stamp existed carry no "sst" and are rejected (users log in again).
        var securityStamp = principal.FindFirstValue(SecurityStampClaimType);
        if (string.IsNullOrWhiteSpace(securityStamp))
            return false;

        var user = await users.FindByIdAsync(userId, cancellationToken);

        // Ordinal: the name and the stamp in the token are copied verbatim from the stored user at login,
        // so any difference means the token no longer describes this account.
        return user is { IsActive: true }
            && string.Equals(user.Username, username, StringComparison.Ordinal)
            && string.Equals(user.SecurityStamp, securityStamp, StringComparison.Ordinal);
    }
}
