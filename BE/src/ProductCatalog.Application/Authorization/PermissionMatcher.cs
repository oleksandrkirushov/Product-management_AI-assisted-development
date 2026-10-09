namespace ProductCatalog.Application.Authorization;

/// <summary>
/// Pure permission-matching logic. Semantics mirror FE <c>AuthService.hasPermission</c>:
/// <c>"*"</c> grants everything; otherwise an exact match or <c>"&lt;resource&gt;:*"</c>,
/// where resource is the part of the required permission before the first <c>':'</c>.
/// </summary>
public static class PermissionMatcher
{
    public const string Wildcard = "*";

    public static bool IsGranted(IEnumerable<string> granted, string required)
    {
        ArgumentNullException.ThrowIfNull(granted);
        if (string.IsNullOrWhiteSpace(required))
            return false;

        var grantedSet = granted.ToHashSet(StringComparer.Ordinal);
        if (grantedSet.Contains(Wildcard))
            return true;

        var resource = required.Split(':', 2)[0];
        return grantedSet.Contains(required) || grantedSet.Contains($"{resource}:{Wildcard}");
    }
}
