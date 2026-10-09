namespace ProductCatalog.Application.Users;

public sealed class UserProfileResponse
{
    public UserProfileResponse(
        Guid id,
        string username,
        string email,
        string firstName,
        string lastName,
        IReadOnlyList<string> roles,
        IReadOnlyList<string> permissions,
        DateTime createdAtUtc)
    {
        Id = id;
        Username = username;
        Email = email;
        FirstName = firstName;
        LastName = lastName;
        Roles = roles;
        Permissions = permissions;
        CreatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; init; }
    public string Username { get; init; }
    public string Email { get; init; }
    public string FirstName { get; init; }
    public string LastName { get; init; }
    public IReadOnlyList<string> Roles { get; init; }
    public IReadOnlyList<string> Permissions { get; init; }
    public DateTime CreatedAtUtc { get; init; }
}
