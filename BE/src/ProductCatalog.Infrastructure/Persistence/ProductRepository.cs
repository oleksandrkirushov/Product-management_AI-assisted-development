using Microsoft.EntityFrameworkCore;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Infrastructure.Persistence;

internal sealed class ProductRepository(AppDbContext dbContext) : IProductRepository
{
    public async Task AddAsync(Product product, CancellationToken cancellationToken = default) =>
        await dbContext.Products.AddAsync(product, cancellationToken);

    public Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Products.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

    public void Update(Product product) =>
        dbContext.Products.Update(product);

}
