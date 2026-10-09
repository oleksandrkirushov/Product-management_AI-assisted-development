namespace ProductCatalog.Application.Users;

public sealed class CreateUserResponse
{
    public CreateUserResponse(
        Guid id,
        string username,
        string email,
        string firstName,
        string lastName,
        DateTime createdAtUtc)
    {
        Id = id;
        Username = username;
        Email = email;
        FirstName = firstName;
        LastName = lastName;
        CreatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; init; }
    public string Username { get; init; }
    public string Email { get; init; }
    public string FirstName { get; init; }
    public string LastName { get; init; }
    public DateTime CreatedAtUtc { get; init; }
}
