# Solution structure

The tree below is a **minimal example** of the layer and folder layout using the `Product` aggregate, not a complete list of files. The full up-to-date structure (Users/Roles, Authentication, migrations, all tests) is in [`BE/PROJECT_STRUCTURE.md`](../../../../BE/PROJECT_STRUCTURE.md).

```
BE/
├── ProductCatalog.sln
├── Dockerfile
├── compose.yaml
├── src/
│   ├── ProductCatalog.Domain/          # Microsoft.NET.Sdk, zero dependencies
│   │   └── Entities/
│   │       └── Product.cs
│   ├── ProductCatalog.Application/     # Microsoft.NET.Sdk, → Domain
│   │   ├── DependencyInjection.cs
│   │   ├── Abstractions/
│   │   │   ├── IProductRepository.cs
│   │   │   └── IUnitOfWork.cs
│   │   ├── Authorization/              # pure permission logic (no ASP.NET)
│   │   │   ├── PermissionMatcher.cs
│   │   │   └── Permissions.cs          # permission name constants (resource:action)
│   │   └── Products/
│   │       ├── ProductService.cs
│   │       ├── ProductDto.cs
│   │       ├── CreateProductCommand.cs
│   │       └── UpdateProductCommand.cs
│   ├── ProductCatalog.Infrastructure/  # Microsoft.NET.Sdk, → Application, Domain
│   │   ├── DependencyInjection.cs
│   │   └── Persistence/
│   │       ├── AppDbContext.cs
│   │       └── ProductRepository.cs
│   └── ProductCatalog.Api/             # Microsoft.NET.Sdk.Web, → Application, Infrastructure
│       ├── Program.cs
│       ├── appsettings.json
│       ├── appsettings.Development.json
│       ├── Authentication/             # ActiveUserTokenValidator: JWT check in OnTokenValidated (uid claim → IsActive)
│       ├── Authorization/              # requirement, handler, policy provider (ASP.NET-specific)
│       ├── Controllers/
│       │   ├── ProductsController.cs
│       │   └── AuthController.cs
│       ├── Contracts/
│       │   ├── CreateProductRequest.cs
│       │   ├── UpdateProductRequest.cs
│       │   └── LoginRequest.cs
│       └── Options/
│           └── JwtOptions.cs
└── tests/
    ├── ProductCatalog.UnitTests/       # xUnit, → Application, Domain (NOT Infrastructure/Api)
    │   └── ProductTests.cs
    └── ProductCatalog.Api.UnitTests/   # xUnit, → Api (Api components without HTTP/DB)
        └── PermissionAuthorizationHandlerTests.cs
```

## Project dependencies (one direction)

| Project | ProjectReference | NuGet (key) |
|---|---|---|
| `Domain` | — | — |
| `Application` | `Domain` | `Microsoft.Extensions.DependencyInjection.Abstractions` |
| `Infrastructure` | `Application`, `Domain` | `Microsoft.EntityFrameworkCore.SqlServer`, `Microsoft.Extensions.Configuration.Abstractions` |
| `Api` | `Application`, `Infrastructure` | `Microsoft.AspNetCore.Authentication.JwtBearer`, `Microsoft.OpenApi`, `Swashbuckle.AspNetCore` |
| `UnitTests` | `Application`, `Domain` | `xunit`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `coverlet.collector` |
| `Api.UnitTests` | `Api` | the same as `UnitTests` (same versions) |

**Rule:** dependencies go in one direction only, along the arrows above. `Domain` may not reference anything. `Application` doesn't see EF Core, HTTP or Api contracts. If you suddenly need a type from Infrastructure/Api in Application or Domain — that's a sign something is designed wrong (most often a port interface should have been in Application/Abstractions rather than in Infrastructure).

## Namespace and file conventions

- Namespace = `ProductCatalog.<Layer>[.<SubFolder>]`, e.g. `ProductCatalog.Domain.Entities`, `ProductCatalog.Application.Products`, `ProductCatalog.Application.Abstractions`, `ProductCatalog.Infrastructure.Persistence`, `ProductCatalog.Api.Controllers`, `ProductCatalog.Api.Contracts`, `ProductCatalog.Api.Options`.
- File-scoped namespaces everywhere: `namespace ProductCatalog.Domain.Entities;` (not the block `{ }` style).
- All `.csproj` files: `<TargetFramework>net10.0</TargetFramework>`, `<Nullable>enable</Nullable>`, `<ImplicitUsings>enable</ImplicitUsings>`.
- There is no committed `.editorconfig` and no committed `GlobalUsings.cs` — don't add them without an explicit request, stick to what already exists.
- One public type per file, file name = type name.

## DependencyInjection.cs — a convention for each layer

Each layer (except Domain and Api) has exactly one `DependencyInjection.cs` file at its root with a static `DependencyInjection` class and a single `Add<ProjectLayer>` extension method:

```csharp
// Application/DependencyInjection.cs
namespace ProductCatalog.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ProductService>();
        return services;
    }
}
```

```csharp
// Infrastructure/DependencyInjection.cs
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

`Program.cs` calls both in a chain: `builder.Services.AddApplication().AddInfrastructure(builder.Configuration);`

When you add a new entity/aggregate — register the new service/repository in the corresponding existing `DependencyInjection.cs`, don't create a second file in the same layer.
