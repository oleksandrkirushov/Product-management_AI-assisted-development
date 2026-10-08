# Структура solution

```
BE/
├── ProductCatalog.sln
├── Dockerfile
├── compose.yaml
├── src/
│   ├── ProductCatalog.Domain/          # Microsoft.NET.Sdk, нуль залежностей
│   │   └── Entities/
│   │       └── Product.cs
│   ├── ProductCatalog.Application/     # Microsoft.NET.Sdk, → Domain
│   │   ├── DependencyInjection.cs
│   │   ├── Abstractions/
│   │   │   ├── IProductRepository.cs
│   │   │   └── IUnitOfWork.cs
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
    └── ProductCatalog.UnitTests/       # xUnit, → Application, Domain (НЕ Infrastructure/Api)
        └── ProductTests.cs
```

## Залежності між проєктами (один напрямок)

| Проєкт | ProjectReference | NuGet (ключові) |
|---|---|---|
| `Domain` | — | — |
| `Application` | `Domain` | `Microsoft.Extensions.DependencyInjection.Abstractions` |
| `Infrastructure` | `Application`, `Domain` | `Microsoft.EntityFrameworkCore.SqlServer`, `Microsoft.Extensions.Configuration.Abstractions` |
| `Api` | `Application`, `Infrastructure` | `Microsoft.AspNetCore.Authentication.JwtBearer`, `Microsoft.OpenApi`, `Swashbuckle.AspNetCore` |
| `UnitTests` | `Application`, `Domain` | `xunit`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `coverlet.collector` |

**Правило:** залежність лише в один бік, по стрілках вище. `Domain` не має права посилатись ні на що. `Application` не бачить EF Core, HTTP, Api-контракти. Якщо тобі в Application чи Domain раптом потрібен тип з Infrastructure/Api — це ознака, що щось спроєктовано неправильно (найчастіше — порт-інтерфейс мав би бути в Application/Abstractions, а не лежати в Infrastructure).

## Namespace і файлова конвенція

- Namespace = `ProductCatalog.<Layer>[.<SubFolder>]`, напр. `ProductCatalog.Domain.Entities`, `ProductCatalog.Application.Products`, `ProductCatalog.Application.Abstractions`, `ProductCatalog.Infrastructure.Persistence`, `ProductCatalog.Api.Controllers`, `ProductCatalog.Api.Contracts`, `ProductCatalog.Api.Options`.
- File-scoped namespaces скрізь: `namespace ProductCatalog.Domain.Entities;` (не блочний `{ }` стиль).
- Усі `.csproj`: `<TargetFramework>net10.0</TargetFramework>`, `<Nullable>enable</Nullable>`, `<ImplicitUsings>enable</ImplicitUsings>`.
- Немає committed `.editorconfig` і немає committed `GlobalUsings.cs` — не додавай їх без явного запиту, дотримуйся того, що вже є.
- Один публічний тип на файл, ім'я файлу = ім'я типу.

## DependencyInjection.cs — конвенція на кожен шар

Кожен шар (крім Domain і Api) має рівно один файл `DependencyInjection.cs` у своєму корені зі статичним класом `DependencyInjection` і одним extension-методом `Add<ШарПроєкту>`:

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

`Program.cs` викликає обидва ланцюжком: `builder.Services.AddApplication().AddInfrastructure(builder.Configuration);`

Коли додаєш нову сутність/агрегат — реєструй новий сервіс/репозиторій у відповідному наявному `DependencyInjection.cs`, не створюй другий файл у тому ж шарі.
