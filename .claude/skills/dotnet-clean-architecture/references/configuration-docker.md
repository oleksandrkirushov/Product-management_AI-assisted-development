# Configuration and Docker

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

- `appsettings.Development.json` overrides only `Logging` — nothing else.
- Sections are read via `IConfiguration`/`IOptions<T>`: `configuration.GetConnectionString("DefaultConnection")`, `configuration.GetSection(JwtOptions.SectionName)`, `configuration["AdminSeed:Username"]`.
- `AdminSeed` — credentials of the admin user (with a fallback to the same values in code), which `Program.cs` seeds on startup **only if the `Users` table is empty** (first run); if there is at least one user, the seed is skipped and creates or changes nothing. So changing `AdminSeed:Password` on an already populated DB has no effect.
- Secrets (`Jwt:Key`, `AdminSeed:Password`) live directly in `appsettings.json` for local demo development and are overridden via env vars in Docker — don't hard-code new secrets in code, always go through configuration with a reasonable fallback.

## Docker

`compose.yaml` passes configuration via env vars using ASP.NET Core's double-underscore notation (`Section__Key` ↔ `"Section": { "Key": ... }`):

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

- `${VAR:-default}` variables come from `BE/.env` (template — `BE/.env.example`: `SA_PASSWORD`, `JWT_KEY`, `ADMIN_SEED_PASSWORD`).
- DB data lives in the named volume `sqlserver-data` (full name `be_sqlserver-data`) — it survives `docker compose down`/`stop`, but not deletion of the volume (see the prohibitions below).
- If you add a new configuration section (e.g. for a new Options class) — follow the same pattern: fallback values in `compose.yaml` via `${VAR:-default}`, double underscore for nested keys.
- **Important:** inside shell commands in `healthcheck`/`CMD-SHELL`, variables that must expand are wrapped in **double** quotes (`"$${VAR}"`), not single ones — single quotes in the shell block expansion (the project has already hit this bug once).
- `Dockerfile` — multi-stage: `sdk:10.0` for build/publish → `aspnet:10.0` for runtime. It copies `.csproj`+`.sln` first as a separate layer (caching `dotnet restore`), then the rest of the code.
- `BE/backups/` (volume backups, see below) is excluded both from git (`BE/.gitignore`) and from the Docker build context (`BE/.dockerignore`) — otherwise multi-megabyte archives with DB data would end up in the image build context.

## Running locally

```bash
cd BE
docker compose up --build        # first run / after dependency changes
docker compose up                 # subsequent run without a rebuild
docker compose down               # stop without deleting data
```

## Backing up the SQL Server volume before a migration or API rebuild

`Program.cs` applies all pending migrations on startup (`MigrateAsync`), so any
`docker compose up --build api` can change the schema of the live DB. Before it (and before any manual action on the DB):

- It is **forbidden** to delete the volume or wipe the DB: no `docker compose down -v` (`-v` deletes the named volume with all
  data), `docker volume rm`, `DROP DATABASE`.
- Back up the `be_sqlserver-data` volume (name = `<project>_sqlserver-data`, the default project is `be`)
  to `BE/backups/` (in `.gitignore` and `.dockerignore`), named `sqlserver-volume-<yyyyMMdd-HHmmss>.tar.gz`.
  Containers are stopped with `stop` (not `down`) so that the `.mdf/.ldf` files are consistent.

The block below is **one command** (everything chained with `&&`): run it in a single shell call, because the `TS` variable doesn't
survive separate calls, and any error (the container didn't stop, the archive wasn't created, the archive has no
DB files) must stop everything before `up --build`, i.e. before migrations are applied:

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

- Applied migrations are visible in `docker compose logs api` (`Applying migration ...` or
  `No migrations were applied. The database is already up to date.`).

### Restoring from a backup — only deliberately, with the user's agreement

Restoring replaces the current contents of the volume. So first make sure the chosen archive is readable, then back up
the **current** state (the same script as above, but without `docker compose up`), and only then clear the volume and extract.
Again a single command chained with `&&` — on any error (in particular if the archive has no DB files) the volume isn't touched. `RESTORE` is the file name in `BE/backups/`; the value below is only an example, **replace it with your file**:

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
