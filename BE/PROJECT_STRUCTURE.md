# Project structure and relationships

## Dependency direction

```text
Api ───────────────► Application ─────────► Domain
 │                       ▲
 └──► Infrastructure ────┘───────────────► Domain
```

`Domain` doesn't depend on other layers. `Application` knows Domain and declares abstractions. `Infrastructure` implements those abstractions. `Api` is the composition root: it registers all implementations, configuration, authentication/authorization and HTTP endpoints.

## Files

```text
ProductCatalog.sln
├── src/
│   ├── ProductCatalog.Domain/
│   │   └── Entities/{Product,User,Role,PasswordResetToken}.cs
│   ├── ProductCatalog.Application/
│   │   ├── Abstractions/IProductRepository.cs
│   │   ├── Abstractions/IUserRepository.cs
│   │   ├── Abstractions/IRoleRepository.cs
│   │   ├── Abstractions/IPasswordHasher.cs
│   │   ├── Abstractions/{IPasswordResetTokenRepository,IPasswordResetTokenGenerator,IEmailSender}.cs
│   │   ├── Abstractions/IUnitOfWork.cs
│   │   ├── Auth/AuthService.cs, AuthenticatedUserDto.cs
│   │   ├── Authorization/PermissionMatcher.cs
│   │   ├── Authorization/Permissions.cs
│   │   ├── Products/{ProductService,ProductDto,CreateProductCommand,UpdateProductCommand}.cs
│   │   ├── Users/{RegisterUserService,RegisterUserCommand,CreateUserResponse}.cs
│   │   ├── Users/{UserProfileService,UserProfileResponse}.cs
│   │   ├── Users/UserRegistrationExceptions.cs
│   │   ├── Users/{UserManagementService,UserManagementExceptions}.cs
│   │   ├── Users/{PasswordResetService,ResetPasswordCommand,PasswordResetOptions,PasswordResetExceptions,PasswordPolicy}.cs
│   │   └── DependencyInjection.cs
│   ├── ProductCatalog.Infrastructure/
│   │   ├── Persistence/AppDbContext.cs
│   │   ├── Persistence/{ProductRepository,UserRepository,RoleRepository,PasswordResetTokenRepository}.cs
│   │   ├── Persistence/Migrations/*.cs  # InitialSchema, AddUserIsActive, AddPasswordReset
│   │   ├── Security/{BCryptPasswordHasher,PasswordResetTokenGenerator}.cs
│   │   ├── Email/{SmtpEmailSender,SmtpOptions}.cs
│   │   └── DependencyInjection.cs
│   └── ProductCatalog.Api/
│       ├── Authentication/ActiveUserTokenValidator.cs
│       ├── Authorization/{PermissionRequirement,PermissionAuthorizationHandler,PermissionPolicyProvider}.cs
│       ├── Contracts/*.cs
│       ├── Controllers/{AuthController,ProductsController,UsersController}.cs
│       ├── Options/JwtOptions.cs
│       ├── RateLimiting/RateLimitingPolicies.cs
│       ├── Program.cs
│       └── appsettings.json
├── tests/
│   ├── ProductCatalog.UnitTests/       # → Application, Domain: entities, services, PermissionMatcher
│   └── ProductCatalog.Api.UnitTests/   # → Api: authorization handler/provider, ActiveUserTokenValidator, controllers
├── .config/dotnet-tools.json           # local dotnet-ef for migrations
├── Dockerfile
├── compose.yaml
└── .vscode/{launch.json,tasks.json}
```

### Domain
- `Product` — an entity with invariants: non-empty name, maximum length and a positive price.
- `User` — username, email, first name, last name, password hash, role reference (`RoleId`), `IsActive` state (`true` by default). Validates required fields and the email format. State changes only via the `Activate()`/`Deactivate()`/`ChangePasswordHash(hash)` methods. `SecurityStamp` is generated in the constructor and regenerated on every password change (JWT revocation).
- `PasswordResetToken` — a single-use password reset token: `UserId`, `TokenHash` (only the SHA-256 hash, not the token itself), `CreatedAtUtc`, `ExpiresAtUtc`, `UsedAtUtc?`. `IsUsable(now)` — not used and not expired; `MarkUsed(now)` — consumes it (a second time — `InvalidOperationException`).
- `Role` — a name and a list of permissions in the `resource:action` format (`"*"` — all permissions, `"products:*"` — all actions on a resource).

### Application
- `IProductRepository`/`IUserRepository`/`IRoleRepository`/`IUnitOfWork` — ports that isolate business scenarios from EF Core.
- `IPasswordHasher` — a hashing abstraction; Application doesn't depend on a specific library.
- `IPasswordResetTokenRepository`, `IPasswordResetTokenGenerator` (token generation + hash), `IEmailSender` — ports for password reset.
- `PasswordResetService` — `RequestResetAsync(email)`: for an active user it revokes previous tokens, stores the hash of a new one and sends an email with the link `{ResetUrl}?token=...`; for an unknown/inactive email it silently does nothing. `ResetAsync(command)`: checks the password (`PasswordPolicy`), the token (by hash, `IsUsable`) and that the user is active, then `ChangePasswordHash` + `MarkUsed` in a single `SaveChanges`. Errors: `InvalidPasswordException` (empty/short password), `InvalidPasswordResetTokenException` (unknown/expired/used token, inactive/deleted user). Time — via `TimeProvider`.
- `PasswordPolicy` — the shared minimum password length rule (8) for registration and reset.
- `ProductService` — creating, updating and reading products.
- `RegisterUserService` — registration: password check, username/email uniqueness, assigning the `User` role. Duplicates are signaled with `DuplicateUsernameException`/`DuplicateEmailException`.
- `AuthService` — verifies credentials and returns the user data (including `Id` and `SecurityStamp`) with the role and permissions for issuing a JWT. A deactivated user gets `null`, same as with a wrong password (the check runs after hashing — it reveals the account state neither by the response nor by timing).
- `UserProfileService` — the current user's profile and the list/details of users (without the password hash); `UserProfileResponse` contains `IsActive`.
- `UserManagementService` — `ActivateAsync`/`DeactivateAsync`/`DeleteAsync(id, actingUsername)` (delete is a physical deletion). Returns `false` if the user doesn't exist (→ 404), `true` on success, including when the state is already the desired one (idempotency). Check order: not-found → self → idempotency → last-admin, with per-action differences: `ActivateAsync` doesn't check last-admin (activation doesn't reduce the number of admins); `DeleteAsync` has no idempotency step (deletion always deletes) and checks last-admin only if the target is active (deleting an already deactivated admin is allowed). Exceptions (`UserManagementExceptions.cs`): `CannotModifySelfException` — an action on one's own account (all three actions); `LastActiveAdminException` — deactivating/deleting the last **active** admin, where "admin" is any role that grants `users:manage` according to `PermissionMatcher` (not the role name).
  - **Known limitation:** the last-admin check and `SaveChanges` are not in one transaction. If two admins (exactly two) deactivate/delete each other at the same time, both checks will see two active admins and the system will be left with none. Deliberately not addressed (low risk); manual recovery — `UPDATE Users SET IsActive = 1 WHERE ...`. It can be closed with a serializable transaction via `IUnitOfWork`.
- `Authorization/PermissionMatcher` — pure logic for "does a set of permissions grant the required permission" (exact, `*`, `resource:*`), the same semantics as the FE `hasPermission`.
- `Authorization/Permissions` — permission name constants (`users:read`, `users:manage`).

### Infrastructure
- `AppDbContext` — EF Core mapping and Unit of Work: unique indexes on `Username`, `Email`, `Role.Name`; FK `User.RoleId → Role.Id`; `Role.Permissions` is stored as a JSON column; the `PasswordResetTokens` table with a unique index on `TokenHash` and an FK to `Users` (cascade delete).
- `ProductRepository`/`UserRepository`/`RoleRepository` — SQL Server implementations; reads via `AsNoTracking`. `UserRepository` also has `CountActiveByRoleIdsAsync` (for last-admin) and `Remove`.
- `Persistence/Migrations` — EF Core migrations. The schema changes **only** through migrations (`dotnet ef migrations add ...`), `EnsureCreated` is not used.
  - `InitialSchema` — `Users`/`Roles` tables on top of the already existing `Products`.
  - `AddUserIsActive` — the `Users.IsActive` column (`bit`, default `1`, so existing users stay active).
  - `AddPasswordReset` — the `Users.SecurityStamp` column (`nvarchar(64)`, default `NEWID()` for existing rows) and the `PasswordResetTokens` table.
- `BCryptPasswordHasher` — an `IPasswordHasher` implementation via BCrypt.Net-Next.
- `PasswordResetTokenGenerator` — 32 bytes from `RandomNumberGenerator` in base64url; the hash is SHA-256 in hex (64 characters).
- `SmtpEmailSender` + `SmtpOptions` — sending emails via `System.Net.Mail.SmtpClient`; the `Smtp` section is read and validated in `AddInfrastructure` (fail-fast). For development — Mailpit from `compose.yaml`.

### Api
- `AuthController` — `POST /api/auth/login` (issues a JWT with the claims `uid` — the user Id, `sst` — security stamp, `Name`, `Email`, `Role` and `permissions` — a JSON array of the role's permissions) and `POST /api/auth/register` (public). Login of a deactivated user — 401 with the same message as for a wrong password.
  - `POST /api/auth/forgot-password` — always `202 { message }` with the same text (doesn't reveal whether the email exists), including when sending the email fails (the error is logged via `ILogger`, without the address; `OperationCanceledException` is not caught); `400` — invalid email.
  - `POST /api/auth/reset-password` — `204`; `400 { message }` for an invalid/expired/used token (`InvalidPasswordResetTokenException`) or a missing/short password (`InvalidPasswordException`).
  - Both — `[AllowAnonymous]` + `[EnableRateLimiting("password-reset")]`: fixed window of 5 requests/min per IP (shared between the two endpoints), then `429`.
- `UsersController`:

  | Request | Permission | Success | Errors |
  |---|---|---|---|
  | `GET /api/users/me` | any valid JWT | 200 (`UserProfileResponse` with `isActive`) | 401, 404 |
  | `GET /api/users` | `users:read` | 200 (array, each with `isActive`) | 401, 403 |
  | `GET /api/users/{id}` | `users:read` | 200 (with `isActive`) | 401, 403, 404 |
  | `PATCH /api/users/{id}/activate` | `users:manage` | 204 | 400, 401, 403, 404 |
  | `PATCH /api/users/{id}/deactivate` | `users:manage` | 204 | 400, 401, 403, 404 |
  | `DELETE /api/users/{id}` | `users:manage` | 204 | 400, 401, 403, 404 |

  The acting user is `User.Identity.Name` (empty → 401). `false` from `UserManagementService` → 404; `CannotModifySelfException`/`LastActiveAdminException` → 400 with the body `{ "message": string }`.
- `ProductsController` — `GET` for any valid JWT; `POST`/`PUT` still require the `Admin` role (legacy, not yet migrated to permissions).
- `Authentication/ActiveUserTokenValidator` — immediate access revocation. A JWT is stateless and lives until `ExpirationMinutes`, so `JwtBearerEvents.OnTokenValidated` in `Program.cs` calls `IsAllowedAsync` for every authenticated request: it looks up the user by the **Id** from the `uid` claim (not by username — after deletion the name can be registered again) and requires `IsActive` and an exact (Ordinal) match of `Username` with the `Name` claim and of `SecurityStamp` with the `sst` claim (a password change revokes all previously issued tokens; a token without `sst` is rejected). Otherwise `context.Fail(...)` → 401 on **any** `[Authorize]` endpoint (Users, Products, `/me`). Consequences: a deactivated/deleted user loses access immediately; tokens issued before `uid` existed get 401 (a one-time re-login). The cost is one DB query per authenticated request. A stale `permissions` claim after a change to the role's permissions isn't covered by this (roles aren't editable yet).
- `Authorization/` — permission-based authorization: `[Authorize(Policy = Permissions.X)]` → `PermissionPolicyProvider` builds a policy for any name containing `:` → `PermissionAuthorizationHandler` checks the `permissions` claim via `PermissionMatcher`. The role is not taken into account.
- `Program.cs` — the composition root; on startup it applies migrations (`MigrateAsync`) and seeds the roles `Admin` (`["*"]`), `User` (`["products:read"]`) and the admin user (from the `AdminSeed` configuration) — the latter only if the `Users` table is empty (first run); otherwise the user seed is skipped and changes nothing. It reads and validates the `PasswordReset` section (fail-fast) and registers `PasswordResetOptions`; configures the rate limiter. Middleware order: Swagger → CORS → RateLimiter → Authentication → Authorization → Controllers.

### Runtime infrastructure
- `Dockerfile` — multi-stage build: the SDK compiles, the smaller ASP.NET runtime runs. New test projects must be added to `COPY` before `dotnet restore`.
- `backups/` — backups of the SQL Server Docker volume (`sqlserver-volume-<yyyyMMdd-HHmmss>.tar.gz`), mandatory before `docker compose up --build api` (which applies migrations). Excluded from git (`.gitignore`) and from the Docker build context (`.dockerignore`). Procedure — `.claude/skills/dotnet-clean-architecture/references/configuration-docker.md`.
- `compose.yaml` — API + SQL Server + Mailpit (SMTP `1025`, UI `8025`), healthcheck, network, a volume for persisting data and environment overrides.

## Request flow

Any `[Authorize]` request → JWT authentication (signature, issuer, audience, lifetime) → `OnTokenValidated` → `ActiveUserTokenValidator` (`IUserRepository.FindByIdAsync(uid)`, `IsActive`, matching `Username` and `SecurityStamp`) → then authorization. An inactive/deleted user gets 401 before authorization.

`POST /api/auth/login` → `AuthController` → `AuthService` → `IUserRepository`/`IRoleRepository` + `IPasswordHasher` → JWT with role and permissions.

`POST /api/auth/forgot-password` → rate limiter → `AuthController` → `PasswordResetService.RequestResetAsync` → `IUserRepository.FindByEmailAsync` → (active) revoke old tokens + new `PasswordResetToken` → `SaveChanges` → `IEmailSender` (with `CancellationToken.None`, because the token is already committed; a failure is caught by the controller) → 202.

`POST /api/auth/reset-password` → rate limiter → `AuthController` → `PasswordResetService.ResetAsync` → `IPasswordResetTokenRepository.FindByHashAsync` → `User.ChangePasswordHash` (new `SecurityStamp`) + `MarkUsed` → `SaveChanges` → 204.

`GET /api/users` → JWT authentication → `PermissionPolicyProvider` (`users:read` policy) → `PermissionAuthorizationHandler` (`permissions` claim) → `UsersController` → `UserProfileService` → `UserRepository`/`RoleRepository` → SQL Server. Without the permission — 403, without a token — 401.

`PATCH /api/users/{id}/deactivate` → JWT authentication + `ActiveUserTokenValidator` → `users:manage` policy → `UsersController` → `UserManagementService` (not-found → self → idempotency → last-admin) → `User.Deactivate()` → `IUserRepository.Update` + `IUnitOfWork.SaveChangesAsync`. Activate and Delete (`IUserRepository.Remove`) follow the same path.

`POST /api/products` → JWT authentication → role authorization (`Admin`) → `ProductsController` → `ProductService` → `Product` → `IProductRepository`/`IUnitOfWork` → `ProductRepository`/`AppDbContext` → SQL Server.

`GET /api/products/{id}` follows the same path, but the repository reads the entity with `AsNoTracking`, and the service returns a DTO without exposing the EF entity directly.
