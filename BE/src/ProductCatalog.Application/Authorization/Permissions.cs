namespace ProductCatalog.Application.Authorization;

/// <summary>
/// Well-known permission names (<c>"&lt;resource&gt;:&lt;action&gt;"</c>) used in authorization policies.
/// </summary>
public static class Permissions
{
    public const string UsersRead = "users:read";
    public const string UsersManage = "users:manage";
}
