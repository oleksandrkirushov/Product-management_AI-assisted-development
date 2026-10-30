namespace ProductCatalog.Application.Users;

/// <summary>
/// The reset token is unknown, expired, already used, or belongs to an inactive/deleted user.
/// One message for all cases, so the response does not reveal which one it was.
/// </summary>
public sealed class InvalidPasswordResetTokenException()
    : Exception("Reset link is invalid or has expired.");

/// <summary>The new password violates <see cref="PasswordPolicy"/>.</summary>
public sealed class InvalidPasswordException()
    : Exception(PasswordPolicy.TooShortMessage);
