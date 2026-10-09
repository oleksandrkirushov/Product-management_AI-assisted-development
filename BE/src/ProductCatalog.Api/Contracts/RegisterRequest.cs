using System.ComponentModel.DataAnnotations;

namespace ProductCatalog.Api.Contracts;

public sealed record RegisterRequest(
    [Required] string Username,
    [Required, EmailAddress] string Email,
    [Required] string FirstName,
    [Required] string LastName,
    [Required] string Password);
