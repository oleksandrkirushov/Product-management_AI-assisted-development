using Microsoft.EntityFrameworkCore;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IUnitOfWork
{
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var product = modelBuilder.Entity<Product>();
        product.ToTable("Products");
        product.HasKey(x => x.Id);
        product.Property(x => x.Name).HasMaxLength(200).IsRequired();
        product.Property(x => x.Price).HasPrecision(18, 2).IsRequired();
        product.Property(x => x.CreatedAtUtc).IsRequired();
    }
}
