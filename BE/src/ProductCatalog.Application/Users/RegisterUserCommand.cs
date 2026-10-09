namespace ProductCatalog.Application.Users;

public sealed class RegisterUserCommand
{
    public RegisterUserCommand(
        string username,
        string email,
        string firstName,
        string lastName,
        string password)
    {
        Username = username;
        Email = email;
        FirstName = firstName;
        LastName = lastName;
        Password = password;
    }

    public string Username { get; }
    public string Email { get; }
    public string FirstName { get; }
    public string LastName { get; }
    public string Password { get; }
}
