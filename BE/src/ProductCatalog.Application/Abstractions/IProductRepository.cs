using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Application.Abstractions;

public interface IProductRepository
{
    Task AddAsync(Product product, CancellationToken cancellationToken = default);
    Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
   void Update(Product product);
}
