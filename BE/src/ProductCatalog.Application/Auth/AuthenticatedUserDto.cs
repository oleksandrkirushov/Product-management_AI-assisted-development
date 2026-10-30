namespace ProductCatalog.Application.Auth;

public sealed class AuthenticatedUserDto
{
    public AuthenticatedUserDto(
        Guid id,
        string username,
        string email,
        string roleName,
        IReadOnlyList<string> permissions,
        string securityStamp)
    {
        Id = id;
        Username = username;
        Email = email;
        RoleName = roleName;
        Permissions = permissions;
        SecurityStamp = securityStamp;
    }

    public Guid Id { get; init; }
    public string Username { get; init; }
    public string Email { get; init; }
    public string RoleName { get; init; }
    public IReadOnlyList<string> Permissions { get; init; }
    public string SecurityStamp { get; init; }
}
