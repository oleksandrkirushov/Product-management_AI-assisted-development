namespace ProductCatalog.Application.Products;

// public sealed record CreateProductCommand(string Name, decimal Price);

public sealed class CreateProductCommand
{
    public CreateProductCommand(
        string name,
        decimal price)
    {
        Name = name;
        Price = price;
    }

    public string Name { get; }
    public decimal Price { get; }
}