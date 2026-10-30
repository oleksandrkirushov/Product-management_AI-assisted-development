# Products Audit

A learning full-stack application for managing a product catalog:

| Part | Stack | Folder |
|---|---|---|
| Frontend | Angular 22 (standalone, zoneless, Angular Material) | [FE/](FE/) |
| Backend | ASP.NET Core 10 Web API, Clean Architecture, EF Core, SQL Server, JWT | [BE/](BE/) |

Supporting services run in Docker: **SQL Server 2022** (database) and **Mailpit** (a local SMTP sandbox that
catches password-reset emails).

## Prerequisites

| Tool | Needed for | Notes |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | backend, database, Mailpit | On Apple Silicon enable Rosetta (SQL Server image is `amd64` only) |
| [Node.js 22](https://nodejs.org/) (≥ 22.22.3) | frontend | The exact version is in [FE/.nvmrc](FE/.nvmrc); with nvm just run `nvm use` in `FE/` |
| [.NET 10 SDK](https://dotnet.microsoft.com/download) | optional | Only to run/debug the backend without Docker or to run backend tests |

## Quick start

Two terminals: one for the backend, one for the frontend.

### 1. Start the backend (API + SQL Server + Mailpit)

```bash
cd BE
cp .env.example .env        # optional: local demo values for passwords and the JWT key
docker compose up --build
```

The first start takes a few minutes (images are downloaded, the API waits until SQL Server is healthy).
On startup the API applies EF Core migrations and seeds the roles and the admin user automatically.

Check that it works:

- Health check: <http://localhost:8080/health> → `{"status":"Healthy"}`
- Swagger UI: <http://localhost:8080/swagger>
- Mailpit inbox: <http://localhost:8025>

### 2. Start the frontend

```bash
cd FE
nvm use                     # switches to Node 22 (skip if Node 22 is already active)
npm install
npm start
```

Open <http://localhost:4200>.

> The frontend must run on port **4200** (the only origin allowed by the API's CORS policy), and it calls the API at
> `http://localhost:8080/api` ([FE/src/environments/environment.ts](FE/src/environments/environment.ts)).

## Logging in

### Test admin user

Created automatically on the first start of the API (only when the `Users` table is empty):

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `Admin123!` |
| Email | `admin@productcatalog.local` |
| Role | `Admin` (all permissions) |

1. Open <http://localhost:4200/login>.
2. Enter username `admin` and password `Admin123!`.
3. After login the header shows **Products** and **Admin** links (Admin is visible only to users with the
   `users:read` permission). The Admin section (`/admin/users`) lets you manage users.

> The password comes from `ADMIN_SEED_PASSWORD` in `BE/.env` (default `Admin123!`). If you change it, do so **before**
> the first start — the admin is seeded only once. To re-seed, delete the database volume (see [Resetting the data](#resetting-the-data)).

### Regular user

There is no seeded regular user. Create one at <http://localhost:4200/register>: self-registered accounts get the
`User` role, which can only view products (`products:read`).

### Logging in via Swagger or curl

In Swagger run `POST /api/auth/login` with:

```json
{ "username": "admin", "password": "Admin123!" }
```

copy `accessToken` from the response, click **Authorize** and paste only the token (without `Bearer`). The same with curl:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin123!"}'
```

### Forgot password

1. On the login page click **Forgot password?** and enter the user's email (for the admin: `admin@productcatalog.local`).
2. Open Mailpit at <http://localhost:8025> — the reset email is there (no real mailbox is involved).
3. Follow the link in the email (`http://localhost:4200/reset-password?token=...`) and set a new password.
   The link is single-use and valid for 30 minutes.

## Alternative: backend without Docker for the API

Useful for debugging the API in VS Code / Rider. The database and Mailpit still run in Docker:

```bash
cd BE
docker compose up -d sqlserver mailpit
dotnet run --project src/ProductCatalog.Api --urls http://localhost:8080
```

`--urls http://localhost:8080` keeps the address the frontend expects (the default launch profile uses port `5205`).

> Running outside Docker, the API takes its settings from
> [appsettings.json](BE/src/ProductCatalog.Api/appsettings.json), not from `.env`. If you set a custom `SA_PASSWORD`
> in `BE/.env`, pass the matching connection string before `dotnet run`:
>
> ```bash
> export ConnectionStrings__DefaultConnection='Server=localhost,1433;Database=ProductCatalogDb;User Id=sa;Password=<your SA_PASSWORD>;TrustServerCertificate=True'
> ```

More details (debugging with breakpoints, migrations, Azure Data Studio): [BE/README.md](BE/README.md).

## Stopping and resetting

### Stopping

```bash
cd BE
docker compose down         # keeps the database
```

Stop the frontend with `Ctrl+C`.

### Resetting the data

```bash
cd BE
docker compose down -v      # ⚠️ deletes the sqlserver-data volume: all users and products
```

On the next `docker compose up` the database is recreated and the admin user is seeded again.
To keep a copy of the data first, see the backup steps in
[configuration-docker.md](.claude/skills/dotnet-clean-architecture/references/configuration-docker.md).

## Tests

```bash
# Frontend (Karma + Jasmine, headless Chrome)
cd FE && npm run test:ci
cd FE && npm run test:coverage   # with coverage report and thresholds

# Backend (needs the .NET 10 SDK)
cd BE && dotnet test ProductCatalog.sln
```

## Ports

| Port | Service |
|---|---|
| 4200 | Frontend (Angular dev server) |
| 8080 | API (Swagger at `/swagger`) |
| 1433 | SQL Server (`sa` / `SA_PASSWORD`, default `Your_password123`) |
| 1025 / 8025 | Mailpit SMTP / web inbox |

## Troubleshooting

- **Login fails with a network/CORS error** — check that the API is up (<http://localhost:8080/health>) and that
  the frontend is opened on `http://localhost:4200`, not another port.
- **`Login failed for user 'sa'`** — the database volume was created with a different `SA_PASSWORD`. Use the original
  password or reset the data (`docker compose down -v`).
- **Angular CLI complains about the Node version** — switch to Node 22: `nvm use` in `FE/`.
- **`429 Too Many Requests` on forgot / reset password** — these endpoints allow 5 requests per minute per IP; wait a minute.
- **The admin password doesn't work after changing `ADMIN_SEED_PASSWORD`** — the admin is seeded only once;
  reset the data or use the old password.

## Security note

All passwords and the JWT key in this repository (`Admin123!`, `Your_password123`,
`local-development-signing-key-change-me-2026`) are **local demo values only**. For any real deployment, provide
your own values via environment variables or a secret manager.

## Further documentation

- [BE/README.md](BE/README.md) — backend details, password reset API, configuration keys
- [BE/PROJECT_STRUCTURE.md](BE/PROJECT_STRUCTURE.md) — backend project structure
- [FE/CLAUDE.md](FE/CLAUDE.md) — frontend commands, structure and conventions
