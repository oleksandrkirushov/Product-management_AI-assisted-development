namespace ProductCatalog.Domain.Entities;

public sealed class Product
{
    private Product() { }

    public Product(string name, decimal price)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Product name is required.", nameof(name));
        if (name.Trim().Length > 200)
            throw new ArgumentException("Product name cannot exceed 200 characters.", nameof(name));
        if (price <= 0)
            throw new ArgumentOutOfRangeException(nameof(price), "Product price must be greater than zero.");

        Name = name.Trim();
        Price = price;
    }

    public void Update(string name, decimal price)
{
    if (string.IsNullOrWhiteSpace(name))
        throw new ArgumentException(
            "Product name is required.",
            nameof(name));

    if (name.Trim().Length > 200)
        throw new ArgumentException(
            "Product name cannot exceed 200 characters.",
            nameof(name));

    if (price <= 0)
        throw new ArgumentOutOfRangeException(
            nameof(price),
            "Product price must be greater than zero.");

    Name = name.Trim();
    Price = price;
}

    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
    public DateTime CreatedAtUtc { get; private set; } = DateTime.UtcNow;
}
