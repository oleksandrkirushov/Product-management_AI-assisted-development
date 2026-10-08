# Domain layer

Єдина сутність у проєкті — `src/ProductCatalog.Domain/Entities/Product.cs`. Нова сутність повторює цей самий шаблон.

## Паттерн сутності

```csharp
namespace ProductCatalog.Domain.Entities;

public sealed class Product
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
    public DateTime CreatedAtUtc { get; private set; } = DateTime.UtcNow;

    private Product() { } // для EF Core

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

## Правила

- `sealed class` — сутності не призначені для наслідування.
- Приватний безпараметричний конструктор `private X() { }` — потрібен EF Core для матеріалізації з БД, не використовується з коду напряму.
- Публічний конструктор приймає сирі значення й одразу валідує їх через **guard clauses**, що кидають стандартні .NET exceptions:
  - `ArgumentException` — порожні/надто довгі рядки, некоректний формат.
  - `ArgumentOutOfRangeException` — числові значення поза допустимим діапазоном.
- Властивості — `{ get; private set; }`. Зовнішній код не може змінити стан напряму, лише через явні методи (`Update(...)`).
- Inline-дефолти на властивостях (`= Guid.NewGuid()`, `= DateTime.UtcNow`, `= string.Empty`) — а не встановлення лише в конструкторі. Якщо додаєш нову сутність з такими ж полями (Id, CreatedAtUtc) — повторюй цей стиль.
- Методи мутації (`Update`) повторюють ту саму валідацію, що й конструктор. У цьому проєкті валідація свідомо не винесена в спільний приватний helper на 100% (історично продубльована) — якщо рефакториш, не змінюй поведінку, лише усувай дублювання обережно і за згодою.
- Жодних атрибутів EF Core (`[Key]`, `[Required]` тощо) в Domain — вся ORM-конфігурація в Infrastructure через Fluent API.
- Жодних посилань на Application/Infrastructure/ASP.NET — Domain не має NuGet-залежностей і не повинен їх отримати.

## Коли додаєш нову сутність (напр. `User`)

1. Створи `src/ProductCatalog.Domain/Entities/User.cs` за тим самим шаблоном.
2. Визнач, які поля обов'язкові при створенні (через конструктор) і які мутуються пізніше (через окремі методи `Update...`, `ChangeX(...)` — не один загальний `Update` на все, якщо логічно поля групуються по-різному, як пароль окремо від профілю).
3. Валідація — guard clauses у конструкторі/методах, не Data Annotations і не FluentValidation (у проєкті цього немає — не вводь нову бібліотеку без запиту).
