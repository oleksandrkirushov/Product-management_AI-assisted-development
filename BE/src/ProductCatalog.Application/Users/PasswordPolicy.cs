namespace ProductCatalog.Application.Users;

/// <summary>Password rules shared by every flow that sets a password (registration, reset).</summary>
public static class PasswordPolicy
{
    public const int MinimumLength = 8;

    public static readonly string TooShortMessage = $"Password must be at least {MinimumLength} characters long.";

    public static bool IsSatisfiedBy(string? password) =>
        !string.IsNullOrWhiteSpace(password) && password.Length >= MinimumLength;
}
