using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Application.Products;

public sealed class ProductService(
    IProductRepository repository,
    IUnitOfWork unitOfWork
    )
{
    public async Task<ProductDto> CreateAsync(
        CreateProductCommand command,
        CancellationToken cancellationToken = default
        )
    {
        var product = new Product(command.Name, command.Price);
        await repository.AddAsync(product, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(product);
    }

    public async Task<ProductDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default
        )
    {
        var product = await repository.GetByIdAsync(id, cancellationToken);
        return product is null ? null : Map(product);
    }

    public async Task<ProductDto?> UpdateAsync(
        UpdateProductCommand command,
        CancellationToken cancellationToken = default
        )
    {
        var product = await repository.GetByIdAsync(command.Id, cancellationToken);

        if (product is null)
            return null;


        product.Update(command.Name, command.Price);
        repository.Update(product);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(product);
    }


    private static ProductDto Map(Product product) => new(product.Id, product.Name, product.Price, product.CreatedAtUtc);
}
