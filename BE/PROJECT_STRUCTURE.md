# Структура та зв’язки проєкту

## Напрямок залежностей

```text
Api ───────────────► Application ─────────► Domain
 │                       ▲
 └──► Infrastructure ────┘───────────────► Domain
```

`Domain` не залежить від інших шарів. `Application` знає Domain і оголошує абстракції. `Infrastructure` реалізує ці абстракції. `Api` є composition root: реєструє всі реалізації, конфігурацію, authentication middleware та HTTP endpoints.

## Файли

```text
ProductCatalog.sln
├── src/
│   ├── ProductCatalog.Domain/
│   │   └── Entities/Product.cs
│   ├── ProductCatalog.Application/
│   │   ├── Abstractions/IProductRepository.cs
│   │   ├── Abstractions/IUnitOfWork.cs
│   │   ├── Products/CreateProductCommand.cs
│   │   ├── Products/ProductDto.cs
│   │   ├── Products/ProductService.cs
│   │   └── DependencyInjection.cs
│   ├── ProductCatalog.Infrastructure/
│   │   ├── Persistence/AppDbContext.cs
│   │   ├── Persistence/ProductRepository.cs
│   │   └── DependencyInjection.cs
│   └── ProductCatalog.Api/
│       ├── Contracts/*.cs
│       ├── Controllers/AuthController.cs
│       ├── Controllers/ProductsController.cs
│       ├── Options/JwtOptions.cs
│       ├── Program.cs
│       └── appsettings.json
├── tests/ProductCatalog.UnitTests/ProductTests.cs
├── Dockerfile
├── compose.yaml
└── .vscode/{launch.json,tasks.json}
```

- `Product` — сутність з інваріантами: непорожня назва, максимальна довжина та додатна ціна.
- `IProductRepository`/`IUnitOfWork` — порти Application, які ізолюють бізнес-сценарій від EF Core.
- `ProductService` — use cases створення та отримання; працює лише з абстракціями.
- `AppDbContext` — EF Core mapping і Unit of Work; `ProductRepository` — SQL Server реалізація репозиторію.
- `ProductsController` — захищені HTTP endpoints. `POST` вимагає роль `Admin`; `GET` — будь-який валідний JWT.
- `AuthController` — перевіряє демонстраційні credentials і видає JWT з роллю `Admin`.
- `Program.cs` — composition root та порядок middleware: Swagger → Authentication → Authorization → Controllers.
- `Dockerfile` — multi-stage build: SDK компілює, менший ASP.NET runtime запускає.
- `compose.yaml` — API + SQL Server, healthcheck, мережа, volume для збереження даних і environment overrides.

## Потік запиту

`POST /api/products` → JWT authentication → role authorization → `ProductsController` → `ProductService` → `Product` → `IProductRepository`/`IUnitOfWork` → `ProductRepository`/`AppDbContext` → SQL Server.

`GET /api/products/{id}` проходить той самий шлях, але repository читає сутність з `AsNoTracking`, а service повертає DTO, не exposing EF entity напряму.
