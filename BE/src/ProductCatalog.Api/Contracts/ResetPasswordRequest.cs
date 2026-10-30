using System.ComponentModel.DataAnnotations;

namespace ProductCatalog.Api.Contracts;

// NewPassword is nullable and has no [Required]/[MinLength] on purpose: the password rule (PasswordPolicy)
// is enforced by the service, so a missing, empty or short password gets the contract's 400 { message }
// instead of a validation problem details body. [MaxLength] only caps the payload size.
public sealed record ResetPasswordRequest(
    [Required, MaxLength(128)] string Token,
    [MaxLength(256)] string? NewPassword);
