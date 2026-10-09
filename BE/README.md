# Product Catalog API

Навчальний ASP.NET Core Web API на .NET 10 з Clean Architecture, SQL Server, EF Core, JWT Bearer, Swagger і Docker Compose.

## Що потрібно

- Docker Desktop (на Apple Silicon увімкніть Rosetta для `amd64`, якщо Docker її запропонує);
- VS Code з розширеннями **C# Dev Kit** та **Docker**;
- .NET 10 SDK — тільки для запуску/дебагу без контейнера;
- Azure Data Studio — опційно, для перегляду БД.

## Найпростіша демонстрація: все у Docker

1. Відкрийте цю папку у VS Code.
2. За потреби створіть локальні змінні: `cp .env.example .env`. Значення призначені лише для локальної демонстрації.
3. Зберіть і запустіть API та SQL Server:

   ```bash
   docker compose up --build
   ```

4. Дочекайтеся старту обох контейнерів і відкрийте [http://localhost:8080/swagger](http://localhost:8080/swagger). Health check: [http://localhost:8080/health](http://localhost:8080/health).
5. У Swagger виконайте `POST /api/auth/login`:

   ```json
   { "username": "admin", "password": "Admin123!" }
   ```

6. Скопіюйте `accessToken`, натисніть **Authorize**, вставте лише токен (без `Bearer`).
7. Виконайте `POST /api/products`:

   ```json
   { "name": "MacBook Stand", "price": 49.99 }
   ```

   Очікувано: `201 Created`. Скопіюйте `id` з відповіді.
8. Виконайте `GET /api/products/{id}` із цим `id`. Очікувано: `200 OK` і створений продукт.
9. Зупинка без видалення БД: `docker compose down`. Повне очищення демонстраційної БД: `docker compose down -v`.

## Перевірка через curl

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin123!"}'

curl -X POST http://localhost:8080/api/products \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"name":"MacBook Stand","price":49.99}'

curl http://localhost:8080/api/products/PRODUCT_ID \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

## Локальний debug у VS Code, SQL Server у Docker

1. Запустіть лише БД: `docker compose up -d sqlserver`.
2. Встановіть C# Dev Kit, відкрийте **Run and Debug**, оберіть `.NET: ProductCatalog.Api` і натисніть `F5`.
3. Поставте breakpoint, наприклад у `ProductsController.Create`, та викличте endpoint зі Swagger. VS Code зупиниться на breakpoint.

Альтернатива в Terminal:

```bash
dotnet restore ProductCatalog.sln
dotnet build ProductCatalog.sln
dotnet test ProductCatalog.sln
dotnet run --project src/ProductCatalog.Api
```

Локальний профіль слухає адресу з `launchSettings.json`; Swagger відкрийте за адресою, яку виведе консоль. Схема БД (таблиці `Products`, `Roles`, `Users`) застосовується автоматично при старті через EF Core migrations (`dbContext.Database.MigrateAsync()`). Щоб додати нову міграцію після зміни моделі, виконайте з `BE/`:

```bash
dotnet tool run dotnet-ef migrations add <Name> --project src/ProductCatalog.Infrastructure --startup-project src/ProductCatalog.Api -o Persistence/Migrations
dotnet tool run dotnet-ef database update --project src/ProductCatalog.Infrastructure --startup-project src/ProductCatalog.Api
```

## Azure Data Studio

Створіть connection типу Microsoft SQL Server:

- Server: `localhost,1433`
- Authentication: SQL Login
- User: `sa`
- Password: `Your_password123` (або `SA_PASSWORD` з `.env`)
- Trust server certificate: `True`

Після старту API база `ProductCatalogDb` і таблиця `dbo.Products` з’являться автоматично.

## Важливі конфігурації

ASP.NET Core перетворює подвійне підкреслення у вкладений ключ: `Jwt__Key` → `Jwt:Key`. Docker Compose перевизначає локальні значення з `appsettings.json`. Демонстраційний користувач і симетричний JWT key навмисно спрощені; production-рішення потребує ASP.NET Core Identity/зовнішнього IdP, secret manager і ротації ключів.
