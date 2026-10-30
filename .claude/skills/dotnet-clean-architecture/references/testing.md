# Testing (xUnit)

## Test projects

| Project | ProjectReference | What it tests |
|---|---|---|
| `BE/tests/ProductCatalog.UnitTests` | only `Application`, `Domain` (NOT Infrastructure, NOT Api) | Domain validation, Application services, pure logic (e.g. `PermissionMatcher`) |
| `BE/tests/ProductCatalog.Api.UnitTests` | `Api` | Api components without HTTP or DB: authorization handlers, policy providers, checking controller attributes via reflection (`[Authorize(Policy = ...)]`) |

- Both are pure unit tests: no DB, no HTTP pipeline, no `WebApplicationFactory` — the project currently has no integration tests.
- Don't add a ProjectReference to `Api`/`Infrastructure` in `ProductCatalog.UnitTests`. If logic from Api needs testing and it doesn't depend on ASP.NET types — better move it to Application; if it does (handler, provider, attributes) — the test goes in `ProductCatalog.Api.UnitTests`.
- A new test project is added to `ProductCatalog.sln` and its `.csproj` is copied in `BE/Dockerfile` before `dotnet restore ProductCatalog.sln` (otherwise restore in Docker will fail).
- Test namespace = project name (`ProductCatalog.UnitTests`, `ProductCatalog.Api.UnitTests`). One test class per file, the file is named after the class (`XTests.cs`).

NuGet (same versions in both projects): `xunit`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `coverlet.collector`. The `.csproj` has `<Using Include="Xunit" />` — so `using Xunit;` isn't needed in test files.

Note: in `ProductCatalog.Api.UnitTests` the name `Options` conflicts with the `ProductCatalog.Api.Options` namespace — for `Microsoft.Extensions.Options.Options.Create(...)` use an alias (`using MsOptions = Microsoft.Extensions.Options.Options;`).

## Example — a Domain validation test

```csharp
namespace ProductCatalog.UnitTests;

public class ProductTests
{
    [Fact]
    public void Constructor_WithValidData_CreatesProduct()
    {
        var product = new Product("Widget", 9.99m);

        Assert.Equal("Widget", product.Name);
        Assert.Equal(9.99m, product.Price);
        Assert.NotEqual(Guid.Empty, product.Id);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_WithInvalidName_ThrowsArgumentException(string name)
    {
        Assert.Throws<ArgumentException>(() => new Product(name, 9.99m));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Constructor_WithInvalidPrice_ThrowsArgumentOutOfRangeException(decimal price)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new Product("Widget", price));
    }
}
```

## Example — an Application service test with a mock repository

The project currently has no tests for `ProductService` and no mocked dependencies — no mocking library (Moq/NSubstitute) is installed. If you add a service with a repository, write your own lightweight test double (a hand-written class implementing the interface) rather than pulling in a new library without an explicit user request:

```csharp
public class ProductServiceTests
{
    private sealed class InMemoryProductRepository : IProductRepository
    {
        public List<Product> Items { get; } = [];

        public Task<Product?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Id == id));

        public Task<IReadOnlyList<Product>> GetAllAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<Product>>(Items);

        public Task AddAsync(Product product, CancellationToken ct = default)
        {
            Items.Add(product);
            return Task.CompletedTask;
        }

        public void Update(Product product) { }
    }

    private sealed class NoopUnitOfWork : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken ct = default) => Task.FromResult(1);
    }

    [Fact]
    public async Task CreateAsync_WithValidCommand_AddsProductAndReturnsDto()
    {
        var repository = new InMemoryProductRepository();
        var service = new ProductService(repository, new NoopUnitOfWork());

        var dto = await service.CreateAsync(new CreateProductCommand("Widget", 9.99m));

        Assert.Equal("Widget", dto.Name);
        Assert.Single(repository.Items);
    }
}
```

## Rules

- `[Fact]` — one specific case. `[Theory]` + `[InlineData]` — the same test with a set of values (edge cases, invalid input).
- Test name: `<Method>_<Condition>_<Result>` (e.g. `Constructor_WithInvalidName_ThrowsArgumentException`).
- Test Domain validation directly through the entity's constructor/methods — don't bypass validation with reflection.
- Test Application services through the real constructor (primary constructor) with hand-written test-double implementations of the ports — don't pull in a mocking framework unless the user explicitly asks.
- Cover a new entity or service added within a task with tests in this same style — the absence of tests for `ProductService`/controllers in the current code is no reason to leave new logic untested.
- Run commands from the `BE/` root: `dotnet test` (all tests), `dotnet test --filter "FullyQualifiedName~ProductServiceTests"` (a specific class).
