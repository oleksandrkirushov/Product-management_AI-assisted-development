# Domain layer

The only entity in the project is `src/ProductCatalog.Domain/Entities/Product.cs`. A new entity follows this same template.

## Entity pattern

```csharp
namespace ProductCatalog.Domain.Entities;

public sealed class Product
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
    public DateTime CreatedAtUtc { get; private set; } = DateTime.UtcNow;

    private Product() { } // for EF Core

    public Product(string name, decimal price)
    {
        ValidateName(name);
        ValidatePrice(price);

        Name = name.Trim();
        Price = price;
    }

    public void Update(string name, decimal price)
    {
        ValidateName(name);
        ValidatePrice(price);

        Name = name.Trim();
        Price = price;
    }

    private static void ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));
        if (name.Length > 200)
            throw new ArgumentException("Name must be 200 characters or fewer.", nameof(name));
    }

    private static void ValidatePrice(decimal price)
    {
        if (price <= 0)
            throw new ArgumentOutOfRangeException(nameof(price), "Price must be greater than zero.");
    }
}
```

## Rules

- `sealed class` — entities are not intended for inheritance.
- A private parameterless constructor `private X() { }` — needed by EF Core to materialize from the DB, not used from code directly.
- The public constructor takes raw values and immediately validates them via **guard clauses** that throw standard .NET exceptions:
  - `ArgumentException` — empty/too long strings, invalid format.
  - `ArgumentOutOfRangeException` — numeric values outside the allowed range.
- Properties are `{ get; private set; }`. External code can't change state directly, only through explicit methods (`Update(...)`).
- Inline defaults on properties (`= Guid.NewGuid()`, `= DateTime.UtcNow`, `= string.Empty`) — rather than setting them only in the constructor. If you add a new entity with the same fields (Id, CreatedAtUtc) — follow this style.
- Mutation methods (`Update`) repeat the same validation as the constructor. In this project validation is deliberately not 100% extracted into a shared private helper (historically duplicated) — if you refactor, don't change the behavior, only remove duplication carefully and with agreement.
- No EF Core attributes (`[Key]`, `[Required]`, etc.) in Domain — all ORM configuration lives in Infrastructure via Fluent API.
- No references to Application/Infrastructure/ASP.NET — Domain has no NuGet dependencies and must not get any.

## When adding a new entity (e.g. `User`)

1. Create `src/ProductCatalog.Domain/Entities/User.cs` following the same template.
2. Decide which fields are required at creation (via the constructor) and which are mutated later (via separate `Update...`, `ChangeX(...)` methods — not one general `Update` for everything if the fields logically group differently, like the password separately from the profile).
3. Validation — guard clauses in the constructor/methods, not Data Annotations or FluentValidation (the project doesn't have these — don't introduce a new library without a request).
