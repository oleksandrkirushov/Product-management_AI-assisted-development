using System.ComponentModel.DataAnnotations;

namespace ProductCatalog.Api.Contracts;

public sealed record LoginRequest([Required] string Username, [Required] string Password);
