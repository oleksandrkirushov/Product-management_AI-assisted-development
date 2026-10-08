# Api layer

## Controllers — `Controllers/<Aggregate>sController.cs`

Primary constructor з Application-сервісом, авторизація на рівні контролера й окремо на write-операціях:

```csharp
namespace ProductCatalog.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/products")]
public sealed class ProductsController(ProductService productService) : ControllerBase
{
    [HttpGet("{id:guid}")]
    [ProducesResponseType<ProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var product = await productService.GetByIdAsync(id, cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpGet]
    [ProducesResponseType<IReadOnlyList<ProductDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var products = await productService.GetAllAsync(cancellationToken);
        return Ok(products);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType<ProductDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await productService.CreateAsync(new CreateProductCommand(request.Name, request.Price), cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType<ProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await productService.UpdateAsync(new UpdateProductCommand(id, request.Name, request.Price), cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }
}
```

### Правила контролерів

- `[ApiController] [Authorize] [Route("api/<plural-aggregate>")]` на класі; `[AllowAnonymous]` явно на публічних endpoint (напр. login, register).
- Write-операції (`POST`/`PUT`/`DELETE`) додатково `[Authorize(Roles = "Admin")]`, якщо дія адмінська.
- `[ProducesResponseType<T>(StatusCodes.Status200OK)]` — **generic**-синтаксис для успішної відповіді; кожен можливий error-статус — окремий `[ProducesResponseType(StatusCodes.StatusXxx)]` без generic.
- `[HttpGet("{id:guid}")]` — route constraint `:guid`, не просто `{id}`.
- `Create` → `CreatedAtAction(nameof(GetById), new { id = ... }, dto)` (201 + `Location` header), не просто `Ok()`.
- Контролер повертає DTO з Application напряму (`ProductDto`) — **не** мапить у окремий Api-рівневий response-тип. Api-шар визначає лише **вхідні** контракти (`*Request`).
- Контролер не містить бізнес-логіки — лише виклик сервісу й переклад `null`/результату в `IActionResult`.

## Request-контракти — `Contracts/<Action><Aggregate>Request.cs`

```csharp
namespace ProductCatalog.Api.Contracts;

public sealed record CreateProductRequest(
    [Required, StringLength(200)] string Name,
    [Required, Range(0.01, 9999999999999999.99)] decimal Price
);
```

- `sealed record` (positional), DataAnnotations (`[Required]`, `[StringLength]`, `[Range]`) — валідація формату запиту на межі Api. Доменна валідація (бізнес-правила) лишається в Domain-конструкторі/методах — не дублюй бізнес-логіку в DataAnnotations понад формат.
- Один файл — один контракт, в `Api/Contracts/`.

## Options — `Options/<Name>Options.cs`

```csharp
namespace ProductCatalog.Api.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; init; } = string.Empty;
    public string Audience { get; init; } = string.Empty;
    public string Key { get; init; } = string.Empty;
    public int ExpirationMinutes { get; init; } = 60;
}
```

`const string SectionName` на класі — стандартний спосіб зв'язати Options-клас із секцією `appsettings.json` при реєстрації (`services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName))`).

## Program.cs — конвенції цього проєкту

- Top-level statements, мінімум коду поза `builder`/`app`.
- Порядок: `AddControllers()` → `AddApplication()` → `AddInfrastructure(configuration)` → CORS policy → ручне зчитування і **валідація** `JwtOptions` (fail-fast ще до `builder.Build()`, якщо ключ закороткий) → `AddAuthentication().AddJwtBearer(...)` → `AddAuthorization()` → Swagger (`AddEndpointsApiExplorer`, `AddSwaggerGen` з Bearer security scheme).
- Pipeline: `UseSwagger → UseSwaggerUI → UseCors → UseAuthentication → UseAuthorization → MapControllers`.
- `/health` endpoint з `AllowAnonymous()`.
- Локальна функція `EnsureDatabaseCreatedAsync` з retry-loop (10 спроб, затримка) викликає `EnsureCreatedAsync()` перед `RunAsync()` — немає EF Core migrations.
- `public partial class Program;` наприкінці файлу — залишено для майбутньої інтеграції `WebApplicationFactory` в тестах (інтеграційних тестів ще немає).
- CORS: policy `"AllowFrontend"` → `http://localhost:4200`, `AllowAnyMethod()/AllowAnyHeader()/AllowCredentials()`. Якщо FE отримає інший origin (прод) — додай його через конфігурацію, не хардкодь другий рядок policy.

## Авторизація та claims у JWT

- `AuthController.Login` зараз демо-рівня: порівнює `username`/`password` напряму з `DemoUser` секцією конфігурації (**без хешування**), генерує JWT вручну через `JwtSecurityTokenHandler`.
- Claims у токені: `Sub` (user id), `Jti`, `ClaimTypes.Name` (username), `ClaimTypes.Role` (хардкод `"Admin"` для демо-юзера).
- Якщо додаєш реальну автентифікацію (User entity, реєстрація) — зберігай пароль як хеш (`BCrypt`/`Rfc2898DeriveBytes`, явно уточни з користувачем вибір бібліотеки, бо її ще немає в проєкті), і формуй claims з реальної ролі користувача, а не хардкодженого `"Admin"`.
