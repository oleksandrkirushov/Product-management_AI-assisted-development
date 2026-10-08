# Тестування (xUnit)

## Проєкт тестів

`BE/tests/ProductCatalog.UnitTests` — референсить лише `ProductCatalog.Application` і `ProductCatalog.Domain` (НЕ Infrastructure, НЕ Api). Це чисто юніт-тести доменної логіки й Application-сервісів, без БД, без HTTP, без `WebApplicationFactory` — інтеграційних тестів у проєкті зараз немає.

NuGet: `xunit`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `coverlet.collector`. У `.csproj` є `<Using Include="Xunit" />` — тому `using Xunit;` в файлах тестів не потрібен.

## Приклад — тест на Domain-валідацію

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

## Приклад — тест на Application-сервіс з мок-репозиторієм

У проєкті зараз немає тестів на `ProductService` і немає моканих залежностей — немає підключеної mocking-бібліотеки (Moq/NSubstitute). Якщо додаєш сервіс із репозиторієм, напиши власну легку test-double (ручний клас, що реалізує інтерфейс), а не підключай нову бібліотеку без явного запиту користувача:

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

## Правила

- `[Fact]` — один конкретний кейс. `[Theory]` + `[InlineData]` — той самий тест з набором значень (граничні випадки, невалідний вхід).
- Ім'я тесту: `<Метод>_<Умова>_<Результат>` (напр. `Constructor_WithInvalidName_ThrowsArgumentException`).
- Тестуй Domain-валідацію напряму через конструктор/методи сутності — не обходь валідацію рефлексією.
- Тестуй Application-сервіси через реальний конструктор (primary constructor) з ручними test-double реалізаціями портів — не підключай mocking-фреймворк, якщо користувач не попросив явно.
- Нову сутність чи сервіс, додану в межах задачі, покривай тестами в цьому ж стилі — відсутність тестів на `ProductService`/контролери в поточному коді не привід залишати нову логіку без тестів.
- Команди запуску — з кореня `BE/`: `dotnet test` (усі тести), `dotnet test --filter "FullyQualifiedName~ProductServiceTests"` (конкретний клас).
