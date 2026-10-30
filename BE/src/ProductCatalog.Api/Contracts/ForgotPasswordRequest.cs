using System.ComponentModel.DataAnnotations;

namespace ProductCatalog.Api.Contracts;

public sealed record ForgotPasswordRequest([Required, EmailAddress, MaxLength(256)] string Email);
