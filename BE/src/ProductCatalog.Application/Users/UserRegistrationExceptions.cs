namespace ProductCatalog.Application.Users;

public sealed class DuplicateUsernameException(string username)
    : Exception($"Username '{username}' is already taken.");

public sealed class DuplicateEmailException(string email)
    : Exception($"Email '{email}' is already registered.");
