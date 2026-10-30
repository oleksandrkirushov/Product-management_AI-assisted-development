# Application layer

## Abstractions (ports) — `Application/Abstractions/`

Repository and Unit of Work interfaces live in Application, not in Domain — Domain stays free of persistence concepts.

```csharp
// Abstractions/IProductRepository.cs
namespace ProductCatalog.Application.Abstractions;

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Product>> GetAllAsync(CancellationToken cancellationToken = default);
    Task AddAsync(Product product, CancellationToken cancellationToken = default);
    void Update(Product product);
}
```

```csharp
// Abstractions/IUnitOfWork.cs
namespace ProductCatalog.Application.Abstractions;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
```

`IUnitOfWork` stays minimal — only `SaveChangesAsync`. Don't extend it with transaction methods without a clear need.

## Commands and DTOs — `Application/<Aggregate>/`

Commands and DTOs live next to the service, in a folder named after the aggregate (`Products/`), not in a separate shared `Commands/` or `Dtos/` folder.

```csharp
// Products/CreateProductCommand.cs
namespace ProductCatalog.Application.Products;

public sealed class CreateProductCommand
{
    public string Name { get; }
    public decimal Price { get; }

    public CreateProductCommand(string name, decimal price)
    {
        Name = name;
        Price = price;
    }
}
```

```csharp
// Products/ProductDto.cs
namespace ProductCatalog.Application.Products;

public sealed class ProductDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public DateTime CreatedAtUtc { get; init; }
}
```

These are plain `sealed class`es with get-only/`init` properties — **not** `record`s, even though semantically they resemble records. Stick to this style for consistency unless explicitly asked to migrate to records.

## Service — `Application/<Aggregate>/<Aggregate>Service.cs`

Primary constructor DI, all public methods async with `CancellationToken` as the last parameter, Entity→DTO mapping via a private static `Map`:

```csharp
namespace ProductCatalog.Application.Products;

public sealed class ProductService(IProductRepository repository, IUnitOfWork unitOfWork)
{
    public async Task<ProductDto> CreateAsync(CreateProductCommand command, CancellationToken cancellationToken = default)
    {
        var product = new Product(command.Name, command.Price);
        await repository.AddAsync(product, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(product);
    }

    public async Task<ProductDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var product = await repository.GetByIdAsync(id, cancellationToken);
        return product is null ? null : Map(product);
    }

    public async Task<ProductDto?> UpdateAsync(UpdateProductCommand command, CancellationToken cancellationToken = default)
    {
        var product = await repository.GetByIdAsync(command.Id, cancellationToken);
        if (product is null) return null;

        product.Update(command.Name, command.Price);
        repository.Update(product);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(product);
    }

    public async Task<IReadOnlyList<ProductDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var products = await repository.GetAllAsync(cancellationToken);
        return products.Select(Map).ToList();
    }

    private static ProductDto Map(Product product) => new()
    {
        Id = product.Id,
        Name = product.Name,
        Price = product.Price,
        CreatedAtUtc = product.CreatedAtUtc,
    };
}
```

## Rules

- `sealed class`, **primary constructor** for dependency injection — not fields + a constructor in the class body.
- The service doesn't throw HTTP-specific errors (`NotFound()` etc.) — it returns `null`/throws domain exceptions; the controller decides the HTTP status.
- A `null` result from the repository (entity not found) is propagated as `null` from the service, not as an exception.
- Entity→DTO mapping is a private static `Map` method in the service itself. Don't move it into a separate mapper/AutoMapper without an explicit request — the project has none.
- Each new aggregate gets its own `Application/<Aggregate>/` folder with the service, commands and DTOs together, and a registration line in the existing `Application/DependencyInjection.cs` (`services.AddScoped<XService>();`).
- If an aggregate needs a repository — a new interface in `Application/Abstractions/`, not in Domain or directly in Infrastructure.
