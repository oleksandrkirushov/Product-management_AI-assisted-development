---
name: dotnet-clean-architecture
description: Clean Architecture conventions of this backend project (ASP.NET Core 10, BE/). Domain/Application/Infrastructure/Api layers, primary constructors for DI, Commands/DTOs, EF Core, JWT auth, controllers. Use every time you write, change or review C# code in BE/.
---

# .NET Clean Architecture (this project)

## Before you start
1. Check `BE/ProductCatalog.sln` and the structure of `BE/src/` — four layer projects + `BE/tests/ProductCatalog.UnitTests` and `BE/tests/ProductCatalog.Api.UnitTests`.
2. Look at the code already written in the relevant layer (`Product.cs`, `ProductService.cs`, `ProductsController.cs`, `AppDbContext.cs`) — **a new entity follows these same patterns**; these are not general recommendations but how things are concretely done here.
3. Don't install new NuGet packages without an explicit request.

## Layers and dependencies → [references/project-structure.md](references/project-structure.md)
```
Domain  ←  Application  ←  Infrastructure  ←  Api
              ↑___________________|
```
- `Domain` — zero dependencies (neither on other projects nor on NuGet).
- `Application` → `Domain`.
- `Infrastructure` → `Application`, `Domain`.
- `Api` → `Application`, `Infrastructure`.
- `tests/ProductCatalog.UnitTests` → `Application`, `Domain` (no Infrastructure/Api — unit tests of logic, not integration tests).
- `tests/ProductCatalog.Api.UnitTests` → `Api` — unit tests of Api components without HTTP/DB (authorization handlers, policy providers, checking controller attributes via reflection).
- Dependencies go in one direction only. Domain and Application know nothing about EF Core, HTTP or Api contracts.

## Domain → [references/domain.md](references/domain.md)
- `sealed class`, private parameterless constructor (for EF Core), public constructor with domain validation (guard clauses → `ArgumentException`/`ArgumentOutOfRangeException`).
- `{ get; private set; }` properties — mutation only through explicit methods (`Update(...)`) that repeat the same validation.
- No references from Domain to Application/Infrastructure/EF Core/ASP.NET.

## Application → [references/application.md](references/application.md)
- A service = a `sealed class` with **primary constructor** DI: `public sealed class XService(IXRepository repository, IUnitOfWork unitOfWork)`.
- Ports (`IXRepository`, `IUnitOfWork`) are declared in `Application/Abstractions/`, not in Domain.
- Commands (`CreateXCommand`, `UpdateXCommand`) and DTOs (`XDto`) — in `Application/<Aggregate>/`, not in Api.
- Every public async method has `CancellationToken cancellationToken = default` as the last parameter.
- `DependencyInjection.cs` in each layer: a static class with a single `Add<Layer>(...)` method that registers services in DI.

## Infrastructure → [references/infrastructure.md](references/infrastructure.md)
- `AppDbContext` implements `IUnitOfWork` directly (it already has `SaveChangesAsync`).
- Fluent API configuration in `OnModelCreating`, without separate `IEntityTypeConfiguration` files (while there is one entity — stick to the existing style, don't introduce a new abstraction without need).
- Repository implementations are `internal sealed class` (an implementation detail, inaccessible outside Infrastructure); read methods use `.AsNoTracking()`.
- **The DB schema is managed only through EF Core Migrations; `EnsureCreatedAsync()` is not used and must not come back.**
  Any change to the `Domain` model (a new entity, a new/changed column, a relationship, a change to `OnModelCreating`) that
  affects the DB schema **must** be accompanied by a new migration in the same diff:
  `dotnet ef migrations add <Name> --project src/ProductCatalog.Infrastructure --startup-project src/ProductCatalog.Api -o Persistence/Migrations`
  (run from `BE/`; `dotnet-ef` is installed as a local tool — `dotnet tool run dotnet-ef`, if
  `dotnet ef` isn't available globally). Schema initialization at startup is only `dbContext.Database.MigrateAsync()`
  (`Program.cs`). Before finishing a task, verify that the new/changed migration applies without errors to an already
  **existing** DB (not just a freshly created one) — otherwise the incident repeats where a new model was added in code
  but never made it into the real DB.

## Api → [references/api.md](references/api.md)
- A controller = a primary constructor with an Application service, `[ApiController] [Authorize] [Route("api/...")]`.
- Each action: `[ProducesResponseType<T>(StatusCodes.Status200OK)]` (generic syntax) + a separate non-generic attribute for each possible error status.
- Access to protected actions is **by permission, not by role**: `[Authorize(Policy = Permissions.X)]`
  (constants in `Application/Authorization/Permissions.cs`; the check is done by `PermissionAuthorizationHandler`
  using the `permissions` claim with wildcard logic). Don't use `Roles = "..."` for new endpoints and don't mix it
  with `Policy` in one controller. The old `[Authorize(Roles = "Admin")]` in `ProductsController` is legacy, not yet migrated.
- Request contracts (`*Request`, `sealed record` with DataAnnotations) — in `Api/Contracts/`. The response returns the Application DTO directly — **without** a separate Api response type.
- `Program.cs` — top-level statements, configuration is read and validated (fail-fast) before `builder.Build()`.

## Testing → [references/testing.md](references/testing.md)
- xUnit in `BE/tests/ProductCatalog.UnitTests`, referencing only `Application`+`Domain` — Domain validation, Application services and pure logic.
- Api components (authorization handlers, policy providers, controller attributes) — in `BE/tests/ProductCatalog.Api.UnitTests` (references `Api`), without the HTTP pipeline or DB. Don't add a reference to Api in `ProductCatalog.UnitTests`.
- One test class per file.
- `[Fact]` for a single case, `[Theory]`+`[InlineData]` for a set of values.
- Unit tests for Domain validation and Application services (with a mock repository). There are currently no integration tests or WebApplicationFactory.

## Configuration and Docker → [references/configuration-docker.md](references/configuration-docker.md)
- `appsettings.json` sections map to env vars via `__` (double underscore): `Jwt__Key`, `AdminSeed__Password`.
- `compose.yaml`: `api` + `sqlserver` services, `depends_on.sqlserver.condition: service_healthy`.

## Checklist before finishing a task
- [ ] `dotnet build` from the `BE/` root passes with no errors and no new warnings.
- [ ] Layer dependencies are not violated (Domain imports nothing; Application doesn't reference Infrastructure/Api).
- [ ] A new entity/service follows existing patterns (sealed, primary constructors, CancellationToken, guard clauses) rather than inventing new ones.
- [ ] DTOs/Commands — in Application, Request contracts — in Api/Contracts, port interfaces — in Application/Abstractions.
- [ ] Unit tests for new domain logic and Application services are written (xUnit, `BE/tests/ProductCatalog.UnitTests`); for new Api components without HTTP/DB — in `BE/tests/ProductCatalog.Api.UnitTests`.
- [ ] `dotnet test` from the `BE/` root passes.
- [ ] Passwords/secrets are not hard-coded — only via configuration with a fallback for local development.
- [ ] If the diff changes `Domain/Entities/*.cs` or `OnModelCreating` in `AppDbContext.cs` — the same diff contains
  a corresponding EF Core migration that applies without errors to an already existing DB (not just a freshly created one); its
  absence is a 🔴/🟡 review finding depending on severity.
