namespace ProductCatalog.Application.Auth;

public sealed class AuthenticatedUserDto
{
    public AuthenticatedUserDto(
        Guid id,
        string username,
        string email,
        string roleName,
        IReadOnlyList<string> permissions)
    {
        Id = id;
        Username = username;
        Email = email;
        RoleName = roleName;
        Permissions = permissions;
    }

    public Guid Id { get; init; }
    public string Username { get; init; }
    public string Email { get; init; }
    public string RoleName { get; init; }
    public IReadOnlyList<string> Permissions { get; init; }
}
