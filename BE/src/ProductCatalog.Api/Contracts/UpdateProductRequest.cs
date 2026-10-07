using System.ComponentModel.DataAnnotations;

namespace ProductCatalog.Api.Contracts;

public sealed record UpdateProductRequest(
    [Required, StringLength(200)] string Name,
    [Range(0.01, 9999999999999999.99)] decimal Price);
