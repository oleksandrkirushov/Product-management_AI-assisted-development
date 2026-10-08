# Конфігурація та Docker

## appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=ProductCatalogDb;User Id=sa;Password=Your_password123;TrustServerCertificate=True"
  },
  "Jwt": {
    "Issuer": "ProductCatalog.Api",
    "Audience": "ProductCatalog.Client",
    "Key": "local-development-signing-key-change-me-2026",
    "ExpirationMinutes": 60
  },
  "DemoUser": {
    "Username": "admin",
    "Password": "Admin123!"
  }
}
```

- `appsettings.Development.json` переозначає лише `Logging` — більше нічого.
- Секції зчитуються через `IConfiguration`/`IOptions<T>`: `configuration.GetConnectionString("DefaultConnection")`, `configuration.GetSection(JwtOptions.SectionName)`.
- Секрети (`Jwt:Key`, `DemoUser:Password`) лежать прямо в `appsettings.json` для локальної демо-розробки, перевизначаються через env vars у Docker — не хардкодь нові секрети в код, завжди через конфігурацію з розумним fallback.

## Docker

`compose.yaml` передає конфігурацію через env vars із double-underscore нотацією ASP.NET Core (`Section__Key` ↔ `"Section": { "Key": ... }`):

```yaml
services:
  api:
    environment:
      ConnectionStrings__DefaultConnection: Server=sqlserver,1433;...
      Jwt__Key: ${JWT_KEY:-local-development-signing-key-change-me-2026}
      DemoUser__Password: ${DEMO_USER_PASSWORD:-Admin123!}
    depends_on:
      sqlserver:
        condition: service_healthy

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    platform: linux/amd64
    environment:
      MSSQL_SA_PASSWORD: ${SA_PASSWORD:-Your_password123}
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P \"$${MSSQL_SA_PASSWORD}\" -C -Q 'SELECT 1' || exit 1"]
```

- Якщо додаєш нову секцію конфігурації (напр. для нового Options-класу) — дотримуйся того ж паттерна: fallback-значення в `compose.yaml` через `${VAR:-default}`, double-underscore для вкладених ключів.
- **Важливо:** всередині shell-команд у `healthcheck`/`CMD-SHELL` змінні, що мають розгортатись, беруться в **подвійні** лапки (`"$${VAR}"`), не одинарні — одинарні лапки в shell блокують expansion (на цьому проєкт уже раз ловив баг).
- `Dockerfile` — multi-stage: `sdk:10.0` для build/publish → `aspnet:10.0` для рантайму. Копіює спочатку `.csproj`+`.sln` окремим шаром (кешування `dotnet restore`), потім решту коду.

## Запуск локально

```bash
cd BE
docker compose up --build        # перший запуск / після зміни залежностей
docker compose up                 # повторний запуск без ребілду
docker compose down -v            # зупинити й видалити дані БД
```
