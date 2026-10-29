# Структура та зв’язки проєкту

## Напрямок залежностей

```text
Api ───────────────► Application ─────────► Domain
 │                       ▲
 └──► Infrastructure ────┘───────────────► Domain
```

`Domain` не залежить від інших шарів. `Application` знає Domain і оголошує абстракції. `Infrastructure` реалізує ці абстракції. `Api` є composition root: реєструє всі реалізації, конфігурацію, authentication/authorization та HTTP endpoints.

## Файли

```text
ProductCatalog.sln
├── src/
│   ├── ProductCatalog.Domain/
│   │   └── Entities/{Product,User,Role}.cs
│   ├── ProductCatalog.Application/
│   │   ├── Abstractions/IProductRepository.cs
│   │   ├── Abstractions/IUserRepository.cs
│   │   ├── Abstractions/IRoleRepository.cs
│   │   ├── Abstractions/IPasswordHasher.cs
│   │   ├── Abstractions/IUnitOfWork.cs
│   │   ├── Auth/AuthService.cs, AuthenticatedUserDto.cs
│   │   ├── Authorization/PermissionMatcher.cs
│   │   ├── Authorization/Permissions.cs
│   │   ├── Products/{ProductService,ProductDto,CreateProductCommand,UpdateProductCommand}.cs
│   │   ├── Users/{RegisterUserService,RegisterUserCommand,CreateUserResponse}.cs
│   │   ├── Users/{UserProfileService,UserProfileResponse}.cs
│   │   ├── Users/UserRegistrationExceptions.cs
│   │   ├── Users/{UserManagementService,UserManagementExceptions}.cs
│   │   └── DependencyInjection.cs
│   ├── ProductCatalog.Infrastructure/
│   │   ├── Persistence/AppDbContext.cs
│   │   ├── Persistence/{ProductRepository,UserRepository,RoleRepository}.cs
│   │   ├── Persistence/Migrations/*.cs  # InitialSchema, AddUserIsActive
│   │   ├── Security/BCryptPasswordHasher.cs
│   │   └── DependencyInjection.cs
│   └── ProductCatalog.Api/
│       ├── Authentication/ActiveUserTokenValidator.cs
│       ├── Authorization/{PermissionRequirement,PermissionAuthorizationHandler,PermissionPolicyProvider}.cs
│       ├── Contracts/*.cs
│       ├── Controllers/{AuthController,ProductsController,UsersController}.cs
│       ├── Options/JwtOptions.cs
│       ├── Program.cs
│       └── appsettings.json
├── tests/
│   ├── ProductCatalog.UnitTests/       # → Application, Domain: сутності, сервіси, PermissionMatcher
│   └── ProductCatalog.Api.UnitTests/   # → Api: authorization handler/provider, ActiveUserTokenValidator, контролери
├── .config/dotnet-tools.json           # локальний dotnet-ef для міграцій
├── Dockerfile
├── compose.yaml
└── .vscode/{launch.json,tasks.json}
```

### Domain
- `Product` — сутність з інваріантами: непорожня назва, максимальна довжина та додатна ціна.
- `User` — username, email, ім'я, прізвище, хеш пароля, посилання на роль (`RoleId`), стан `IsActive` (за замовчуванням `true`). Валідує обов'язкові поля та формат email. Стан змінюється лише методами `Activate()`/`Deactivate()`.
- `Role` — назва та список permissions у форматі `resource:action` (`"*"` — усі права, `"products:*"` — усі дії над ресурсом).

### Application
- `IProductRepository`/`IUserRepository`/`IRoleRepository`/`IUnitOfWork` — порти, які ізолюють бізнес-сценарії від EF Core.
- `IPasswordHasher` — абстракція хешування; Application не залежить від конкретної бібліотеки.
- `ProductService` — створення, оновлення та читання продуктів.
- `RegisterUserService` — реєстрація: перевірка пароля, унікальності username/email, призначення ролі `User`. Дублікати сигналізуються `DuplicateUsernameException`/`DuplicateEmailException`.
- `AuthService` — перевіряє credentials і повертає дані користувача (зокрема `Id`) з роллю та permissions для видачі JWT. Деактивований користувач отримує `null`, як і при невірному паролі (перевірка після хешування — не розкриває стан акаунту ні відповіддю, ні часом).
- `UserProfileService` — профіль поточного користувача та список/деталі користувачів (без хешу пароля); `UserProfileResponse` містить `IsActive`.
- `UserManagementService` — `ActivateAsync`/`DeactivateAsync`/`DeleteAsync(id, actingUsername)` (delete — фізичне видалення). Повертає `false`, якщо користувача немає (→ 404), `true` при успіху, зокрема коли стан уже потрібний (ідемпотентність). Порядок перевірок: not-found → self → ідемпотентність → last-admin, з відмінностями за діями: `ActivateAsync` last-admin не перевіряє (активація не зменшує кількість адмінів); `DeleteAsync` не має кроку ідемпотентності (видалення завжди видаляє) і перевіряє last-admin лише якщо ціль активна (видалення вже деактивованого адміна дозволене). Винятки (`UserManagementExceptions.cs`): `CannotModifySelfException` — дія над власним акаунтом (усі три дії); `LastActiveAdminException` — deactivate/delete останнього **активного** адміна, де "адмін" — будь-яка роль, що дає `users:manage` за `PermissionMatcher` (не назва ролі).
  - **Відоме обмеження:** перевірка last-admin і `SaveChanges` не в одній транзакції. Якщо два адміни (рівно двоє) одночасно деактивують/видаляють один одного, обидві перевірки побачать двох активних адмінів і система залишиться без жодного. Свідомо не закрито (низький ризик); відновлення вручну — `UPDATE Users SET IsActive = 1 WHERE ...`. Закрити можна serializable-транзакцією через `IUnitOfWork`.
- `Authorization/PermissionMatcher` — чиста логіка "чи дає набір прав потрібне право" (exact, `*`, `resource:*`), та сама семантика, що й FE `hasPermission`.
- `Authorization/Permissions` — константи назв прав (`users:read`, `users:manage`).

### Infrastructure
- `AppDbContext` — EF Core mapping і Unit of Work: унікальні індекси на `Username`, `Email`, `Role.Name`; FK `User.RoleId → Role.Id`; `Role.Permissions` зберігається як JSON-колонка.
- `ProductRepository`/`UserRepository`/`RoleRepository` — SQL Server реалізації; читання через `AsNoTracking`. `UserRepository` також має `CountActiveByRoleIdsAsync` (для last-admin) і `Remove`.
- `Persistence/Migrations` — EF Core міграції. Схема змінюється **лише** міграціями (`dotnet ef migrations add ...`), `EnsureCreated` не використовується.
  - `InitialSchema` — таблиці `Users`/`Roles` поверх уже наявної `Products`.
  - `AddUserIsActive` — стовпець `Users.IsActive` (`bit`, default `1`, тож наявні користувачі лишаються активними).
- `BCryptPasswordHasher` — реалізація `IPasswordHasher` через BCrypt.Net-Next.

### Api
- `AuthController` — `POST /api/auth/login` (видає JWT з claims `uid` — Id користувача, `Name`, `Email`, `Role` і `permissions` — JSON-масив прав ролі) та `POST /api/auth/register` (публічні). Логін деактивованого користувача — 401 з тим самим повідомленням, що й при невірному паролі.
- `UsersController`:

  | Запит | Право | Успіх | Помилки |
  |---|---|---|---|
  | `GET /api/users/me` | будь-який чинний JWT | 200 (`UserProfileResponse` з `isActive`) | 401, 404 |
  | `GET /api/users` | `users:read` | 200 (масив, у кожного `isActive`) | 401, 403 |
  | `GET /api/users/{id}` | `users:read` | 200 (з `isActive`) | 401, 403, 404 |
  | `PATCH /api/users/{id}/activate` | `users:manage` | 204 | 400, 401, 403, 404 |
  | `PATCH /api/users/{id}/deactivate` | `users:manage` | 204 | 400, 401, 403, 404 |
  | `DELETE /api/users/{id}` | `users:manage` | 204 | 400, 401, 403, 404 |

  Виконавець дії — `User.Identity.Name` (порожній → 401). `false` із `UserManagementService` → 404; `CannotModifySelfException`/`LastActiveAdminException` → 400 з тілом `{ "message": string }`.
- `ProductsController` — `GET` для будь-якого валідного JWT; `POST`/`PUT` поки вимагають роль `Admin` (legacy, ще не мігровано на permissions).
- `Authentication/ActiveUserTokenValidator` — негайне відкликання доступу. JWT stateless і живе до `ExpirationMinutes`, тому `JwtBearerEvents.OnTokenValidated` у `Program.cs` для кожного автентифікованого запиту викликає `IsAllowedAsync`: шукає користувача за **Id** з claim `uid` (не за username — ім'я після видалення можна зареєструвати знову) і вимагає `IsActive` та точний (Ordinal) збіг `Username` з claim `Name`. Інакше `context.Fail(...)` → 401 на **будь-якому** `[Authorize]`-endpoint (Users, Products, `/me`). Наслідки: деактивований/видалений користувач втрачає доступ одразу; токени, видані до появи `uid`, отримують 401 (разовий перелогін). Ціна — один запит до БД на автентифікований запит. Застарілий `permissions`-claim після зміни прав ролі цим не закривається (ролі поки не редагуються).
- `Authorization/` — permission-based авторизація: `[Authorize(Policy = Permissions.X)]` → `PermissionPolicyProvider` будує політику для будь-якої назви з `:` → `PermissionAuthorizationHandler` перевіряє claim `permissions` через `PermissionMatcher`. Роль при цьому не враховується.
- `Program.cs` — composition root; при старті застосовує міграції (`MigrateAsync`) і сідить ролі `Admin` (`["*"]`), `User` (`["products:read"]`) та admin-користувача (з конфігурації `AdminSeed`) — останнього лише якщо таблиця `Users` порожня (перший запуск); інакше сід користувача пропускається й нікого не змінює. Порядок middleware: Swagger → CORS → Authentication → Authorization → Controllers.

### Інфраструктура запуску
- `Dockerfile` — multi-stage build: SDK компілює, менший ASP.NET runtime запускає. Нові тест-проєкти треба додавати в `COPY` перед `dotnet restore`.
- `backups/` — бекапи Docker-тому SQL Server (`sqlserver-volume-<yyyyMMdd-HHmmss>.tar.gz`), обов'язкові перед `docker compose up --build api` (застосовує міграції). Виключено з git (`.gitignore`) і з Docker build context (`.dockerignore`). Процедура — `.claude/skills/dotnet-clean-architecture/references/configuration-docker.md`.
- `compose.yaml` — API + SQL Server, healthcheck, мережа, volume для збереження даних і environment overrides.

## Потік запиту

Будь-який `[Authorize]`-запит → JWT authentication (підпис, issuer, audience, строк) → `OnTokenValidated` → `ActiveUserTokenValidator` (`IUserRepository.FindByIdAsync(uid)`, `IsActive`, збіг `Username`) → далі authorization. Неактивний/видалений користувач — 401 ще до авторизації.

`POST /api/auth/login` → `AuthController` → `AuthService` → `IUserRepository`/`IRoleRepository` + `IPasswordHasher` → JWT з роллю та permissions.

`GET /api/users` → JWT authentication → `PermissionPolicyProvider` (політика `users:read`) → `PermissionAuthorizationHandler` (claim `permissions`) → `UsersController` → `UserProfileService` → `UserRepository`/`RoleRepository` → SQL Server. Без права — 403, без токена — 401.

`PATCH /api/users/{id}/deactivate` → JWT authentication + `ActiveUserTokenValidator` → політика `users:manage` → `UsersController` → `UserManagementService` (not-found → self → ідемпотентність → last-admin) → `User.Deactivate()` → `IUserRepository.Update` + `IUnitOfWork.SaveChangesAsync`. Activate і Delete (`IUserRepository.Remove`) — той самий шлях.

`POST /api/products` → JWT authentication → role authorization (`Admin`) → `ProductsController` → `ProductService` → `Product` → `IProductRepository`/`IUnitOfWork` → `ProductRepository`/`AppDbContext` → SQL Server.

`GET /api/products/{id}` проходить той самий шлях, але repository читає сутність з `AsNoTracking`, а service повертає DTO, не exposing EF entity напряму.
