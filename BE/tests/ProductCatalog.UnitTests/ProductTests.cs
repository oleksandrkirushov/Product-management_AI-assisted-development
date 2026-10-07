using ProductCatalog.Domain.Entities;

namespace ProductCatalog.UnitTests;

public sealed class ProductTests
{
    [Fact]
    public void Constructor_WithValidData_CreatesProduct()
    {
        var product = new Product("MacBook Stand", 49.99m);
        Assert.NotEqual(Guid.Empty, product.Id);
        Assert.Equal("MacBook Stand", product.Name);
        Assert.Equal(49.99m, product.Price);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Constructor_WithNonPositivePrice_Throws(decimal price) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => new Product("Product", price));
}
