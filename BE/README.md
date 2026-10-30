# Product Catalog API

A learning ASP.NET Core Web API on .NET 10 with Clean Architecture, SQL Server, EF Core, JWT Bearer, Swagger and Docker Compose.

## Prerequisites

- Docker Desktop (on Apple Silicon enable Rosetta for `amd64` if Docker offers it);
- VS Code with the **C# Dev Kit** and **Docker** extensions;
- .NET 10 SDK — only for running/debugging without a container;
- Azure Data Studio — optional, for browsing the DB.

## Simplest demo: everything in Docker

1. Open this folder in VS Code.
2. If needed, create local variables: `cp .env.example .env`. The values are intended for local demo use only.
3. Build and start the API, SQL Server and Mailpit (an SMTP sandbox for emails):

   ```bash
   docker compose up --build
   ```

4. Wait for the containers to start and open [http://localhost:8080/swagger](http://localhost:8080/swagger). Health check: [http://localhost:8080/health](http://localhost:8080/health).
5. In Swagger, run `POST /api/auth/login`:

   ```json
   { "username": "admin", "password": "Admin123!" }
   ```

6. Copy the `accessToken`, click **Authorize**, and paste just the token (without `Bearer`).
7. Run `POST /api/products`:

   ```json
   { "name": "MacBook Stand", "price": 49.99 }
   ```

   Expected: `201 Created`. Copy the `id` from the response.
8. Run `GET /api/products/{id}` with that `id`. Expected: `200 OK` and the created product.
9. Stop without deleting the DB: `docker compose down`. Don't add `-v`: this flag deletes the `sqlserver-data` Docker volume together with all DB data (users, products). Before rebuilding the API, back up the volume — see `.claude/skills/dotnet-clean-architecture/references/configuration-docker.md`.

## Checking with curl

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

## Password reset ("Forgot password") and Mailpit

Password reset emails are sent via SMTP. For development, `compose.yaml` starts
[Mailpit](https://mailpit.axllent.org/): SMTP on `localhost:1025`, incoming emails in the web UI at
[http://localhost:8025](http://localhost:8025). No real mailbox is needed; in production it's enough to change the `Smtp` section.

| Endpoint | Body | Responses |
|---|---|---|
| `POST /api/auth/forgot-password` | `{ "email": "user@example.com" }` | `202` always with the same `{ "message": "If an account with this email exists, a reset link has been sent." }` (also for an unknown or deactivated email); `400` invalid email |
| `POST /api/auth/reset-password` | `{ "token": "<base64url>", "newPassword": "NewPass123" }` | `204`; `400 { "message": "Reset link is invalid or has expired." }`; `400 { "message": "Password must be at least 8 characters long." }` |

- Both endpoints are anonymous and rate limited: 5 requests per minute from one IP (shared limit), then `429`.
- The link in the email: `{PasswordReset:ResetUrl}?token=<token>` (for development `http://localhost:4200/reset-password?token=...`).
  The token is single-use and lives `PasswordReset:TokenLifetimeMinutes` (30 min); only its SHA-256 hash is stored in the DB.
  A new request invalidates the user's previous links.
- After a password change, all previously issued JWTs of the user get `401`: the token contains an `sst` claim (security stamp),
  which is compared against the current value in the DB. Tokens issued before this feature existed have no `sst`, so after
  the update everyone has to log in again.

Checking with curl (look for the email in Mailpit):

```bash
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@productcatalog.local"}'

curl -X POST http://localhost:8080/api/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"token":"TOKEN_FROM_EMAIL","newPassword":"NewPass123"}'
```

Configuration (`appsettings.json`, overridden in Docker by the env variables `Smtp__Host`, `PasswordReset__ResetUrl`, etc.):

| Key | Default |
|---|---|
| `Smtp:Host` / `Smtp:Port` | `localhost` / `1025` (`mailpit` in Docker) |
| `Smtp:From` | `no-reply@productcatalog.local` |
| `Smtp:EnableSsl`, `Smtp:User`, `Smtp:Password` | `false`, empty (Mailpit doesn't require authentication) |
| `PasswordReset:ResetUrl` | `http://localhost:4200/reset-password` (`PASSWORD_RESET_URL` in `.env`) |
| `PasswordReset:TokenLifetimeMinutes` | `30` |

## Local debugging in VS Code, SQL Server in Docker

1. Start the DB and Mailpit: `docker compose up -d sqlserver mailpit`.
2. Install C# Dev Kit, open **Run and Debug**, select `.NET: ProductCatalog.Api` and press `F5`.
3. Set a breakpoint, for example in `ProductsController.Create`, and call the endpoint from Swagger. VS Code will stop at the breakpoint.

Alternative in the Terminal:

```bash
dotnet restore ProductCatalog.sln
dotnet build ProductCatalog.sln
dotnet test ProductCatalog.sln
dotnet run --project src/ProductCatalog.Api
```

The local profile listens on the address from `launchSettings.json`; open Swagger at the address printed to the console. The DB schema (tables `Products`, `Roles`, `Users`, `PasswordResetTokens`) is applied automatically on startup via EF Core migrations (`dbContext.Database.MigrateAsync()`). To add a new migration after changing the model, run from `BE/`:

```bash
dotnet tool run dotnet-ef migrations add <Name> --project src/ProductCatalog.Infrastructure --startup-project src/ProductCatalog.Api -o Persistence/Migrations
dotnet tool run dotnet-ef database update --project src/ProductCatalog.Infrastructure --startup-project src/ProductCatalog.Api
```

## Azure Data Studio

Create a connection of type Microsoft SQL Server:

- Server: `localhost,1433`
- Authentication: SQL Login
- User: `sa`
- Password: `Your_password123` (or `SA_PASSWORD` from `.env`)
- Trust server certificate: `True`

After the API starts, the `ProductCatalogDb` database and the `dbo.Products` table will appear automatically.

## Important configuration

ASP.NET Core turns a double underscore into a nested key: `Jwt__Key` → `Jwt:Key`. Docker Compose overrides the local values from `appsettings.json`. The demo user and the symmetric JWT key are deliberately simplified; a production solution needs ASP.NET Core Identity/an external IdP, a secret manager and key rotation.
