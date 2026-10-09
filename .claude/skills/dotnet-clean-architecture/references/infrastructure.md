# Infrastructure layer

## AppDbContext — `Persistence/AppDbContext.cs`

Primary constructor, сам DbContext реалізує `IUnitOfWork` напряму (DbContext уже має `SaveChangesAsync`, не потрібен окремий wrapper-клас):

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

- Fluent API конфігурація прямо в `OnModelCreating`, без окремих `IEntityTypeConfiguration<T>` файлів — поки проєкт малий, тримайся цього стилю. Якщо сутностей стане багато (3+), можна запропонувати користувачу винести конфігурації в окремі класи, але не роби це самостійно без згоди.
- Схема БД керується EF Core Migrations (`Persistence/Migrations/`); `Program.cs` на старті викликає
  `dbContext.Database.MigrateAsync()` (retry-loop на підключення), `EnsureCreatedAsync()` не використовується.
  Якщо задача вимагає зміни схеми (нова властивість/сутність, Fluent API в `OnModelCreating`) — обов'язково
  додай нову міграцію в тому ж diff: `dotnet ef migrations add <Name> --project src/ProductCatalog.Infrastructure
  --startup-project src/ProductCatalog.Api -o Persistence/Migrations` (з `BE/`; `dotnet-ef` — локальний tool,
  `dotnet tool run dotnet-ef`). Перевір, що міграція застосовується без помилок на вже існуючій БД, а не лише
  на щойно створеній.

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

## Правила

- `internal sealed class` — реалізація репозиторію не публічна поза Infrastructure; інший шар бачить лише інтерфейс з `Application/Abstractions/`.
- Read-методи — `.AsNoTracking()` (дані повертаються назовні для мапінгу в DTO, а не для подальшої мутації в тому ж unit of work).
- `Update(product)` — синхронний, без `SaveChangesAsync` всередині репозиторію. Збереження (`SaveChangesAsync`) викликає сервіс в Application через `IUnitOfWork`, не репозиторій. Не додавай `SaveChanges` у репозиторій.
- `AddAsync` додає сутність у DbContext, але не комітить — так само чекає на `IUnitOfWork.SaveChangesAsync()` з сервісу.
- `DependencyInjection.cs` (`Infrastructure/DependencyInjection.cs`) — єдине місце реєстрації `AddDbContext`, репозиторіїв і `IUnitOfWork`:

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

Новий репозиторій для нового агрегату додається тим самим способом у цьому ж файлі (`services.AddScoped<IUserRepository, UserRepository>();`) — не створюй другий `DependencyInjection.cs` в Infrastructure.
