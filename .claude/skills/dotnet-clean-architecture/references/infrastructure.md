# Infrastructure layer

## AppDbContext — `Persistence/AppDbContext.cs`

Primary constructor; the DbContext itself implements `IUnitOfWork` directly (DbContext already has `SaveChangesAsync`, no separate wrapper class needed):

```csharp
namespace ProductCatalog.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : DbContext(options), IUnitOfWork
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
```

- Fluent API configuration directly in `OnModelCreating`, without separate `IEntityTypeConfiguration<T>` files — while the project is small, stick to this style. If there get to be many entities (3+), you may suggest to the user extracting configurations into separate classes, but don't do it on your own without agreement.
- The DB schema is managed by EF Core Migrations (`Persistence/Migrations/`); `Program.cs` calls
  `dbContext.Database.MigrateAsync()` on startup (with a connection retry loop), `EnsureCreatedAsync()` is not used.
  If the task requires a schema change (a new property/entity, Fluent API in `OnModelCreating`) — you must
  add a new migration in the same diff: `dotnet ef migrations add <Name> --project src/ProductCatalog.Infrastructure
  --startup-project src/ProductCatalog.Api -o Persistence/Migrations` (from `BE/`; `dotnet-ef` is a local tool,
  `dotnet tool run dotnet-ef`). Verify that the migration applies without errors to an already existing DB, not only
  to a freshly created one.

## Repository — `Persistence/<Aggregate>Repository.cs`

```csharp
namespace ProductCatalog.Infrastructure.Persistence;

internal sealed class ProductRepository(AppDbContext dbContext) : IProductRepository
{
    public async Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        await dbContext.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Product>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Products.AsNoTracking().ToListAsync(cancellationToken);

    public async Task AddAsync(Product product, CancellationToken cancellationToken = default) =>
        await dbContext.Products.AddAsync(product, cancellationToken);

    public void Update(Product product) => dbContext.Products.Update(product);
}
```

## Rules

- `internal sealed class` — the repository implementation isn't public outside Infrastructure; other layers see only the interface from `Application/Abstractions/`.
- Read methods use `.AsNoTracking()` (data is returned outward for mapping to DTOs, not for further mutation in the same unit of work).
- `Update(product)` is synchronous, with no `SaveChangesAsync` inside the repository. Saving (`SaveChangesAsync`) is called by the service in Application via `IUnitOfWork`, not by the repository. Don't add `SaveChanges` to the repository.
- `AddAsync` adds the entity to the DbContext but doesn't commit — it likewise waits for `IUnitOfWork.SaveChangesAsync()` from the service.
- `DependencyInjection.cs` (`Infrastructure/DependencyInjection.cs`) is the single place for registering `AddDbContext`, repositories and `IUnitOfWork`:

```csharp
namespace ProductCatalog.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

        services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IUnitOfWork>(provider => provider.GetRequiredService<AppDbContext>());

        return services;
    }
}
```

A new repository for a new aggregate is added the same way in this same file (`services.AddScoped<IUserRepository, UserRepository>();`) — don't create a second `DependencyInjection.cs` in Infrastructure.
