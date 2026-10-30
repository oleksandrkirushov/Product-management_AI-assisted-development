# Api layer

## Controllers — `Controllers/<Aggregate>sController.cs`

Primary constructor with an Application service, authorization at the controller level and separately on write operations:

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

### Controller rules

- `[ApiController] [Authorize] [Route("api/<plural-aggregate>")]` on the class; `[AllowAnonymous]` explicitly on public endpoints (e.g. login, register).
- Protected actions use `[Authorize(Policy = Permissions.X)]` (constants in `Application/Authorization/Permissions.cs`,
  e.g. `Permissions.UsersRead`, `Permissions.UsersManage`), not `[Authorize(Roles = "Admin")]`: the role in the token
  can diverge from its permissions, so authorization must check the permission itself. Add a new permission name
  as a constant in `Permissions` (format `resource:action`); there's no need to register the policy separately — it's built by
  `PermissionPolicyProvider` for any name containing `:`. Don't mix `Roles` and `Policy` in one controller.
  The example above with `Roles = "Admin"` in `ProductsController` is legacy, not yet migrated to permissions.
- `[ProducesResponseType<T>(StatusCodes.Status200OK)]` — **generic** syntax for the successful response; each possible error status gets a separate non-generic `[ProducesResponseType(StatusCodes.StatusXxx)]`.
- `[HttpGet("{id:guid}")]` — the `:guid` route constraint, not just `{id}`.
- `Create` → `CreatedAtAction(nameof(GetById), new { id = ... }, dto)` (201 + `Location` header), not just `Ok()`.
- The controller returns the Application DTO directly (`ProductDto`) — it does **not** map it to a separate Api-level response type. The Api layer defines only **input** contracts (`*Request`).
- The controller contains no business logic — only the service call and translating `null`/the result into an `IActionResult`.

## Request contracts — `Contracts/<Action><Aggregate>Request.cs`

```csharp
namespace ProductCatalog.Api.Contracts;

public sealed record CreateProductRequest(
    [Required, StringLength(200)] string Name,
    [Required, Range(0.01, 9999999999999999.99)] decimal Price
);
```

- `sealed record` (positional), DataAnnotations (`[Required]`, `[StringLength]`, `[Range]`) — request format validation at the Api boundary. Domain validation (business rules) stays in the Domain constructor/methods — don't duplicate business logic in DataAnnotations beyond format.
- One file — one contract, in `Api/Contracts/`.

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

A `const string SectionName` on the class is the standard way to bind an Options class to an `appsettings.json` section during registration (`services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName))`).

## Program.cs — this project's conventions

- Top-level statements, minimal code outside `builder`/`app`.
- Order: `AddControllers()` → `AddApplication()` → `AddInfrastructure(configuration)` → CORS policy → manual reading and **validation** of `JwtOptions` (fail-fast before `builder.Build()` if the key is too short) → `AddAuthentication().AddJwtBearer(...)` → `AddAuthorization()` → `AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>()` + `AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>()` → Swagger (`AddEndpointsApiExplorer`, `AddSwaggerGen` with a Bearer security scheme).
- Pipeline: `UseSwagger → UseSwaggerUI → UseCors → UseAuthentication → UseAuthorization → MapControllers`.
- `JwtBearerEvents.OnTokenValidated` calls `Authentication/ActiveUserTokenValidator.IsAllowedAsync` (takes
  `IUserRepository` from the request scope): the user is looked up by the Id from the `uid` claim (added by `AuthController.Login`),
  must be `IsActive` and have the same `Username`, otherwise `context.Fail(...)` → 401 on any `[Authorize]` endpoint.
  Don't duplicate the user activity check in services/controllers and don't make it an authorization requirement
  (an endpoint with an explicit policy would bypass it). Keep the logic in a static class in `Authentication/` so it can be tested without HTTP.
- `/health` endpoint with `AllowAnonymous()`.
- The local function `ApplyMigrationsAsync` with a retry loop (10 attempts, delay) calls `dbContext.Database.MigrateAsync()` before `RunAsync()` — the DB schema is managed by EF Core migrations, `EnsureCreatedAsync()` is not used.
- `public partial class Program;` at the end of the file — kept for future `WebApplicationFactory` integration in tests (there are no integration tests yet).
- CORS: policy `"AllowFrontend"` → `http://localhost:4200`, `AllowAnyMethod()/AllowAnyHeader()/AllowCredentials()`. If the FE gets another origin (prod) — add it via configuration, don't hard-code a second policy line.

## Authorization and JWT claims

- `AuthController.Login` → `AuthService.AuthenticateAsync`: the user is looked up in the DB (`IUserRepository.FindByUsernameAsync`), the password is verified via the `IPasswordHasher` port (implementation — `Infrastructure/Security/BCryptPasswordHasher`, BCrypt.Net-Next), the role and its permissions are read from the DB (`IRoleRepository`). Passwords are stored only as a BCrypt hash; comparing the password directly or against configuration is not allowed.
- Unknown username, wrong password and a deactivated user (`!IsActive`, checked **after** password verification so as not to differ in timing) → `AuthService` returns `null` → 401 with the same body `{ "message": "Invalid username or password." }`, so as not to reveal the account state.
- The JWT is generated manually via `JwtSecurityTokenHandler` (HmacSha256, `Jwt:Key`, lifetime `Jwt:ExpirationMinutes`). Claims:
  - `Sub` — username;
  - `Jti` — a new Guid for each token;
  - `uid` (`ActiveUserTokenValidator.UserIdClaimType`) — `User.Id`, used by `OnTokenValidated` to check that the user exists and is active;
  - `ClaimTypes.Name` — the username **as it is stored in the DB** (not as it was entered at login — the validator compares Ordinal);
  - `ClaimTypes.Email` — email;
  - `ClaimTypes.Role` — the role name from the DB;
  - `permissions` (`PermissionAuthorizationHandler.PermissionsClaimType`) — a JSON array of the role's permission strings; permission-based authorization works on it.
- Add a new claim that authorization depends on in `Login` and cover it with a round-trip test (`ActiveUserTokenValidatorTests.UserIdClaim_SurvivesJwtRoundTripWithInboundClaimMapping` is an example), because JwtBearer renames some inbound claims by default.
