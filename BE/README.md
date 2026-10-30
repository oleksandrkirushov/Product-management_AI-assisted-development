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
3. Зберіть і запустіть API, SQL Server і Mailpit (SMTP-пісочниця для листів):

   ```bash
   docker compose up --build
   ```

4. Дочекайтеся старту контейнерів і відкрийте [http://localhost:8080/swagger](http://localhost:8080/swagger). Health check: [http://localhost:8080/health](http://localhost:8080/health).
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
9. Зупинка без видалення БД: `docker compose down`. Не додавайте `-v`: цей прапорець видаляє Docker-том `sqlserver-data` разом з усіма даними БД (користувачі, продукти). Перед перезбиркою API зробіть бекап тому — див. `.claude/skills/dotnet-clean-architecture/references/configuration-docker.md`.

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

## Відновлення пароля («Forgot password») і Mailpit

Листи для відновлення пароля відправляються через SMTP. Для розробки `compose.yaml` піднімає
[Mailpit](https://mailpit.axllent.org/): SMTP на `localhost:1025`, вхідні листи у веб-інтерфейсі
[http://localhost:8025](http://localhost:8025). Справжня пошта не потрібна; у продакшені досить змінити секцію `Smtp`.

| Endpoint | Тіло | Відповіді |
|---|---|---|
| `POST /api/auth/forgot-password` | `{ "email": "user@example.com" }` | `202` завжди з тим самим `{ "message": "If an account with this email exists, a reset link has been sent." }` (і для невідомого чи деактивованого email); `400` невалідний email |
| `POST /api/auth/reset-password` | `{ "token": "<base64url>", "newPassword": "NewPass123" }` | `204`; `400 { "message": "Reset link is invalid or has expired." }`; `400 { "message": "Password must be at least 8 characters long." }` |

- Обидва endpoint-и анонімні й обмежені rate limiting'ом: 5 запитів на хвилину з однієї IP (спільний ліміт), далі `429`.
- Посилання в листі: `{PasswordReset:ResetUrl}?token=<token>` (для розробки `http://localhost:4200/reset-password?token=...`).
  Токен одноразовий, живе `PasswordReset:TokenLifetimeMinutes` (30 хв); у БД зберігається лише його SHA-256 хеш.
  Новий запит скасовує попередні посилання користувача.
- Після зміни пароля всі раніше видані JWT користувача отримують `401`: у токені є claim `sst` (security stamp),
  який звіряється з поточним значенням у БД. Токени, видані до появи цієї фічі, `sst` не мають, тож після
  оновлення всім треба залогінитися наново.

Перевірка через curl (лист шукайте в Mailpit):

```bash
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@productcatalog.local"}'

curl -X POST http://localhost:8080/api/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"token":"TOKEN_FROM_EMAIL","newPassword":"NewPass123"}'
```

Конфігурація (`appsettings.json`, у Docker перевизначається env-змінними `Smtp__Host`, `PasswordReset__ResetUrl` тощо):

| Ключ | За замовчуванням |
|---|---|
| `Smtp:Host` / `Smtp:Port` | `localhost` / `1025` (у Docker `mailpit`) |
| `Smtp:From` | `no-reply@productcatalog.local` |
| `Smtp:EnableSsl`, `Smtp:User`, `Smtp:Password` | `false`, порожні (Mailpit автентифікації не потребує) |
| `PasswordReset:ResetUrl` | `http://localhost:4200/reset-password` (`PASSWORD_RESET_URL` у `.env`) |
| `PasswordReset:TokenLifetimeMinutes` | `30` |

## Локальний debug у VS Code, SQL Server у Docker

1. Запустіть БД і Mailpit: `docker compose up -d sqlserver mailpit`.
2. Встановіть C# Dev Kit, відкрийте **Run and Debug**, оберіть `.NET: ProductCatalog.Api` і натисніть `F5`.
3. Поставте breakpoint, наприклад у `ProductsController.Create`, та викличте endpoint зі Swagger. VS Code зупиниться на breakpoint.

Альтернатива в Terminal:

```bash
dotnet restore ProductCatalog.sln
dotnet build ProductCatalog.sln
dotnet test ProductCatalog.sln
dotnet run --project src/ProductCatalog.Api
```

Локальний профіль слухає адресу з `launchSettings.json`; Swagger відкрийте за адресою, яку виведе консоль. Схема БД (таблиці `Products`, `Roles`, `Users`, `PasswordResetTokens`) застосовується автоматично при старті через EF Core migrations (`dbContext.Database.MigrateAsync()`). Щоб додати нову міграцію після зміни моделі, виконайте з `BE/`:

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
