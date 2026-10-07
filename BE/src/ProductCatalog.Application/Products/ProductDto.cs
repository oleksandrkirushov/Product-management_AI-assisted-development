namespace ProductCatalog.Application.Products;

// public sealed record ProductDto(Guid Id, string Name, decimal Price, DateTime CreatedAtUtc);

public sealed class ProductDto
{
    public ProductDto(
        Guid id,
        string name,
        decimal price,
        DateTime createdAtUtc)
    {
        Id = id;
        Name = name;
        Price = price;
        CreatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; init; }
    public string Name { get; init; }
    public decimal Price { get; init; }
    public DateTime CreatedAtUtc { get; init; }
}
