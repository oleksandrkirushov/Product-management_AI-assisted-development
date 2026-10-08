---
name: dotnet-clean-architecture
description: Конвенції Clean Architecture цього бекенд-проєкту (ASP.NET Core 10, BE/). Шари Domain/Application/Infrastructure/Api, primary constructors для DI, Commands/DTO, EF Core, JWT auth, контролери. Використовуй щоразу, коли пишеш, змінюєш або рев'юїш C#-код у BE/.
---

# .NET Clean Architecture (цей проєкт)

## Перед початком роботи
1. Перевір `BE/ProductCatalog.sln` і структуру `BE/src/` — чотири проєкти-шари + `BE/tests/ProductCatalog.UnitTests`.
2. Подивись на вже написаний код у відповідному шарі (`Product.cs`, `ProductService.cs`, `ProductsController.cs`, `AppDbContext.cs`) — **нова сутність повторює ці самі паттерни**, це не загальні рекомендації, а те, як конкретно зроблено тут.
3. Не став нові NuGet-пакети без явного запиту.

## Шари та залежності → [references/project-structure.md](references/project-structure.md)
```
Domain  ←  Application  ←  Infrastructure  ←  Api
              ↑___________________|
```
- `Domain` — нуль залежностей (ні на інші проєкти, ні на NuGet).
- `Application` → `Domain`.
- `Infrastructure` → `Application`, `Domain`.
- `Api` → `Application`, `Infrastructure`.
- `tests/ProductCatalog.UnitTests` → `Application`, `Domain` (без Infrastructure/Api — юніт-тести логіки, не інтеграційні).
- Залежність лише в один бік. Domain і Application нічого не знають про EF Core, HTTP чи Api-контракти.

## Domain → [references/domain.md](references/domain.md)
- `sealed class`, приватний безпараметричний конструктор (для EF Core), публічний конструктор з доменною валідацією (guard clauses → `ArgumentException`/`ArgumentOutOfRangeException`).
- Властивості `{ get; private set; }` — мутація лише через явні методи (`Update(...)`), що повторюють ту саму валідацію.
- Жодних посилань на Application/Infrastructure/EF Core/ASP.NET з Domain.

## Application → [references/application.md](references/application.md)
- Сервіс = `sealed class` з **primary constructor** DI: `public sealed class XService(IXRepository repository, IUnitOfWork unitOfWork)`.
- Порти (`IXRepository`, `IUnitOfWork`) оголошені в `Application/Abstractions/`, не в Domain.
- Commands (`CreateXCommand`, `UpdateXCommand`) і DTO (`XDto`) — в `Application/<Aggregate>/`, не в Api.
- Кожен публічний async метод — `CancellationToken cancellationToken = default` останнім параметром.
- `DependencyInjection.cs` у кожному шарі: статичний клас з одним методом `Add<Layer>(...)`, що реєструє сервіси в DI.

## Infrastructure → [references/infrastructure.md](references/infrastructure.md)
- `AppDbContext` реалізує `IUnitOfWork` напряму (вже має `SaveChangesAsync`).
- Fluent API конфігурація в `OnModelCreating`, без окремих `IEntityTypeConfiguration` файлів (поки одна сутність — тримайся існуючого стилю, не вводь нову абстракцію без потреби).
- Repository-реалізації — `internal sealed class` (деталь реалізації, недоступна за межами Infrastructure); read-методи — `.AsNoTracking()`.

## Api → [references/api.md](references/api.md)
- Контролер = primary constructor з Application-сервісом, `[ApiController] [Authorize] [Route("api/...")]`.
- Кожен action: `[ProducesResponseType<T>(StatusCodes.Status200OK)]` (generic-синтаксис) + окремий атрибут без generic на кожен можливий error-статус.
- Write-операції додатково `[Authorize(Roles = "Admin")]`.
- Request-контракти (`*Request`, `sealed record` з DataAnnotations) — в `Api/Contracts/`. Response повертає DTO з Application напряму — **без** окремого Api-response-типу.
- `Program.cs` — top-level statements, конфігурація читається і валідується (fail-fast) до `builder.Build()`.

## Тестування → [references/testing.md](references/testing.md)
- xUnit у `BE/tests/ProductCatalog.UnitTests`, референс лише на `Application`+`Domain`.
- `[Fact]` для одного кейсу, `[Theory]`+`[InlineData]` для набору значень.
- Юніт-тести на Domain-валідацію й Application-сервіси (з мок-репозиторієм). Інтеграційних тестів і WebApplicationFactory наразі немає.

## Конфігурація та Docker → [references/configuration-docker.md](references/configuration-docker.md)
- Секції `appsettings.json` відображаються в env vars через `__` (double underscore): `Jwt__Key`, `DemoUser__Password`.
- `compose.yaml`: сервіс `api` + `sqlserver`, `depends_on.sqlserver.condition: service_healthy`.

## Чеклист перед завершенням задачі
- [ ] `dotnet build` з кореня `BE/` проходить без помилок і нових warnings.
- [ ] Залежності між шарами не порушені (Domain нічого не імпортує; Application не посилається на Infrastructure/Api).
- [ ] Нова сутність/сервіс повторює існуючі паттерни (sealed, primary constructors, CancellationToken, guard clauses), а не вигадує нові.
- [ ] DTO/Commands — в Application, Request-контракти — в Api/Contracts, інтерфейси портів — в Application/Abstractions.
- [ ] Юніт-тести на нову доменну логіку й Application-сервіс написані (xUnit, `BE/tests/ProductCatalog.UnitTests`).
- [ ] `dotnet test` з кореня `BE/` проходить.
- [ ] Паролі/секрети не хардкодяться — лише через конфігурацію з fallback для локальної розробки.
