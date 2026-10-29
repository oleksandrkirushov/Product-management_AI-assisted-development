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
  "AdminSeed": {
    "Username": "admin",
    "Email": "admin@productcatalog.local",
    "Password": "Admin123!"
  }
}
```

- `appsettings.Development.json` переозначає лише `Logging` — більше нічого.
- Секції зчитуються через `IConfiguration`/`IOptions<T>`: `configuration.GetConnectionString("DefaultConnection")`, `configuration.GetSection(JwtOptions.SectionName)`, `configuration["AdminSeed:Username"]`.
- `AdminSeed` — облікові дані admin-користувача (з fallback на ті самі значення в коді), якого `Program.cs` сідить на старті **лише якщо таблиця `Users` порожня** (перший запуск); якщо є хоч один користувач — сід пропускається, нікого не створює й не змінює. Тому зміна `AdminSeed:Password` на вже наповненій БД нічого не дає.
- Секрети (`Jwt:Key`, `AdminSeed:Password`) лежать прямо в `appsettings.json` для локальної демо-розробки, перевизначаються через env vars у Docker — не хардкодь нові секрети в код, завжди через конфігурацію з розумним fallback.

## Docker

`compose.yaml` передає конфігурацію через env vars із double-underscore нотацією ASP.NET Core (`Section__Key` ↔ `"Section": { "Key": ... }`):

```yaml
services:
  api:
    environment:
      ConnectionStrings__DefaultConnection: Server=sqlserver,1433;...
      Jwt__Key: ${JWT_KEY:-local-development-signing-key-change-me-2026}
      AdminSeed__Password: ${ADMIN_SEED_PASSWORD:-Admin123!}
    depends_on:
      sqlserver:
        condition: service_healthy

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    platform: linux/amd64
    environment:
      MSSQL_SA_PASSWORD: ${SA_PASSWORD:-Your_password123}
    volumes:
      - sqlserver-data:/var/opt/mssql
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P \"$${MSSQL_SA_PASSWORD}\" -C -Q 'SELECT 1' || exit 1"]

volumes:
  sqlserver-data:
```

- Змінні `${VAR:-default}` беруться з `BE/.env` (шаблон — `BE/.env.example`: `SA_PASSWORD`, `JWT_KEY`, `ADMIN_SEED_PASSWORD`).
- Дані БД живуть у named volume `sqlserver-data` (повне ім'я `be_sqlserver-data`) — він переживає `docker compose down`/`stop`, але не видалення тому (див. заборони нижче).
- Якщо додаєш нову секцію конфігурації (напр. для нового Options-класу) — дотримуйся того ж паттерна: fallback-значення в `compose.yaml` через `${VAR:-default}`, double-underscore для вкладених ключів.
- **Важливо:** всередині shell-команд у `healthcheck`/`CMD-SHELL` змінні, що мають розгортатись, беруться в **подвійні** лапки (`"$${VAR}"`), не одинарні — одинарні лапки в shell блокують expansion (на цьому проєкт уже раз ловив баг).
- `Dockerfile` — multi-stage: `sdk:10.0` для build/publish → `aspnet:10.0` для рантайму. Копіює спочатку `.csproj`+`.sln` окремим шаром (кешування `dotnet restore`), потім решту коду.
- `BE/backups/` (бекапи тому, див. нижче) виключено і з git (`BE/.gitignore`), і з Docker build context (`BE/.dockerignore`) — інакше багатомегабайтні архіви з даними БД потрапляли б у контекст збірки образу.

## Запуск локально

```bash
cd BE
docker compose up --build        # перший запуск / після зміни залежностей
docker compose up                 # повторний запуск без ребілду
docker compose down               # зупинити без видалення даних
```

## Бекап тому SQL Server перед міграцією чи перезбиркою API

`Program.cs` на старті застосовує всі непрозастосовані міграції (`MigrateAsync`), тож будь-який
`docker compose up --build api` може змінити схему живої БД. Перед ним (і перед будь-якою ручною дією над БД):

- **Заборонено** видаляти том чи витирати БД: жодних `docker compose down -v` (`-v` видаляє named volume з усіма
  даними), `docker volume rm`, `DROP DATABASE`.
- Зроби бекап тому `be_sqlserver-data` (ім'я = `<project>_sqlserver-data`, project за замовчуванням — `be`)
  у `BE/backups/` (у `.gitignore` і `.dockerignore`), ім'я `sqlserver-volume-<yyyyMMdd-HHmmss>.tar.gz`.
  Контейнери зупиняються через `stop` (не `down`), щоб файли `.mdf/.ldf` були консистентні.

Блок нижче — **одна команда** (усе з'єднано через `&&`): виконуй її одним викликом shell, бо змінна `TS` не
переживає окремих викликів, а будь-яка помилка (не зупинився контейнер, не створився архів, в архіві немає
файлів БД) має зупинити все до `up --build`, тобто до застосування міграцій:

```bash
cd BE && TS=$(date +%Y%m%d-%H%M%S) && mkdir -p backups && \
  docker compose stop api sqlserver && \
  docker run --rm -v be_sqlserver-data:/data:ro -v "$PWD/backups":/backup alpine \
    tar czf /backup/sqlserver-volume-$TS.tar.gz -C /data . && \
  tar tzf backups/sqlserver-volume-$TS.tar.gz | grep -q 'ProductCatalogDb.mdf' && \
  tar tzf backups/sqlserver-volume-$TS.tar.gz | grep -q 'ProductCatalogDb_log.ldf' && \
  echo "Backup: $PWD/backups/sqlserver-volume-$TS.tar.gz" && \
  docker compose up -d --build api
```

- Застосування міграцій видно в `docker compose logs api` (`Applying migration ...` або
  `No migrations were applied. The database is already up to date.`).

### Відновлення з бекапу — лише свідомо, за погодженням з користувачем

Відновлення замінює поточний вміст тому. Тому спершу переконайся, що обраний архів читається, потім зроби бекап
**поточного** стану (той самий скрипт, що вище, але без `docker compose up`), і лише тоді очищай том і розпаковуй.
Знову одна команда через `&&` — при будь-якій помилці (зокрема якщо в архіві немає файлів БД) том не чіпається. `RESTORE` — ім'я файла в `BE/backups/`; значення нижче — лише приклад, **заміни на свій файл**:

```bash
cd BE && RESTORE=sqlserver-volume-20261029-151609.tar.gz && \
  tar tzf "backups/$RESTORE" > /dev/null && \
  tar tzf "backups/$RESTORE" | grep -q 'ProductCatalogDb.mdf' && \
  tar tzf "backups/$RESTORE" | grep -q 'ProductCatalogDb_log.ldf' && \
  TS=$(date +%Y%m%d-%H%M%S) && mkdir -p backups && \
  docker compose stop api sqlserver && \
  docker run --rm -v be_sqlserver-data:/data:ro -v "$PWD/backups":/backup alpine \
    tar czf /backup/sqlserver-volume-$TS.tar.gz -C /data . && \
  tar tzf backups/sqlserver-volume-$TS.tar.gz | grep -q 'ProductCatalogDb.mdf' && \
  tar tzf backups/sqlserver-volume-$TS.tar.gz | grep -q 'ProductCatalogDb_log.ldf' && \
  docker run --rm -e RESTORE="$RESTORE" -v be_sqlserver-data:/data -v "$PWD/backups":/backup alpine \
    sh -c 'rm -rf /data/* /data/.[!.]* && tar xzf "/backup/$RESTORE" -C /data' && \
  docker compose up -d sqlserver
```
