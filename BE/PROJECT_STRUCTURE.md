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
│   │   └── DependencyInjection.cs
│   ├── ProductCatalog.Infrastructure/
│   │   ├── Persistence/AppDbContext.cs
│   │   ├── Persistence/{ProductRepository,UserRepository,RoleRepository}.cs
│   │   ├── Persistence/Migrations/*.cs
│   │   ├── Security/BCryptPasswordHasher.cs
│   │   └── DependencyInjection.cs
│   └── ProductCatalog.Api/
│       ├── Authorization/{PermissionRequirement,PermissionAuthorizationHandler,PermissionPolicyProvider}.cs
│       ├── Contracts/*.cs
│       ├── Controllers/{AuthController,ProductsController,UsersController}.cs
│       ├── Options/JwtOptions.cs
│       ├── Program.cs
│       └── appsettings.json
├── tests/
│   ├── ProductCatalog.UnitTests/       # → Application, Domain: сутності, сервіси, PermissionMatcher
│   └── ProductCatalog.Api.UnitTests/   # → Api: authorization handler/provider, атрибути контролерів
├── .config/dotnet-tools.json           # локальний dotnet-ef для міграцій
├── Dockerfile
├── compose.yaml
└── .vscode/{launch.json,tasks.json}
```

### Domain
- `Product` — сутність з інваріантами: непорожня назва, максимальна довжина та додатна ціна.
- `User` — username, email, ім'я, прізвище, хеш пароля, посилання на роль (`RoleId`). Валідує обов'язкові поля та формат email.
- `Role` — назва та список permissions у форматі `resource:action` (`"*"` — усі права, `"products:*"` — усі дії над ресурсом).

### Application
- `IProductRepository`/`IUserRepository`/`IRoleRepository`/`IUnitOfWork` — порти, які ізолюють бізнес-сценарії від EF Core.
- `IPasswordHasher` — абстракція хешування; Application не залежить від конкретної бібліотеки.
- `ProductService` — створення, оновлення та читання продуктів.
- `RegisterUserService` — реєстрація: перевірка пароля, унікальності username/email, призначення ролі `User`. Дублікати сигналізуються `DuplicateUsernameException`/`DuplicateEmailException`.
- `AuthService` — перевіряє credentials і повертає дані користувача з роллю та permissions для видачі JWT.
- `UserProfileService` — профіль поточного користувача та список/деталі користувачів (без хешу пароля).
- `Authorization/PermissionMatcher` — чиста логіка "чи дає набір прав потрібне право" (exact, `*`, `resource:*`), та сама семантика, що й FE `hasPermission`.
- `Authorization/Permissions` — константи назв прав (`users:read`, `users:manage`).

### Infrastructure
- `AppDbContext` — EF Core mapping і Unit of Work: унікальні індекси на `Username`, `Email`, `Role.Name`; FK `User.RoleId → Role.Id`; `Role.Permissions` зберігається як JSON-колонка.
- `ProductRepository`/`UserRepository`/`RoleRepository` — SQL Server реалізації; читання через `AsNoTracking`.
- `Persistence/Migrations` — EF Core міграції. Схема змінюється **лише** міграціями (`dotnet ef migrations add ...`), `EnsureCreated` не використовується.
- `BCryptPasswordHasher` — реалізація `IPasswordHasher` через BCrypt.Net-Next.

### Api
- `AuthController` — `POST /api/auth/login` (видає JWT з claims `Name`, `Email`, `Role` і `permissions` — JSON-масив прав ролі) та `POST /api/auth/register` (публічні).
- `UsersController` — `GET /api/users/me` (будь-який валідний JWT), `GET /api/users` і `GET /api/users/{id}` (потрібне право `users:read`).
- `ProductsController` — `GET` для будь-якого валідного JWT; `POST`/`PUT` поки вимагають роль `Admin` (legacy, ще не мігровано на permissions).
- `Authorization/` — permission-based авторизація: `[Authorize(Policy = Permissions.X)]` → `PermissionPolicyProvider` будує політику для будь-якої назви з `:` → `PermissionAuthorizationHandler` перевіряє claim `permissions` через `PermissionMatcher`. Роль при цьому не враховується.
- `Program.cs` — composition root; при старті застосовує міграції (`MigrateAsync`) і сідить ролі `Admin` (`["*"]`), `User` (`["products:read"]`) та admin-користувача (з конфігурації `AdminSeed`). Порядок middleware: Swagger → CORS → Authentication → Authorization → Controllers.

### Інфраструктура запуску
- `Dockerfile` — multi-stage build: SDK компілює, менший ASP.NET runtime запускає. Нові тест-проєкти треба додавати в `COPY` перед `dotnet restore`.
- `compose.yaml` — API + SQL Server, healthcheck, мережа, volume для збереження даних і environment overrides.

## Потік запиту

`POST /api/auth/login` → `AuthController` → `AuthService` → `IUserRepository`/`IRoleRepository` + `IPasswordHasher` → JWT з роллю та permissions.

`GET /api/users` → JWT authentication → `PermissionPolicyProvider` (політика `users:read`) → `PermissionAuthorizationHandler` (claim `permissions`) → `UsersController` → `UserProfileService` → `UserRepository`/`RoleRepository` → SQL Server. Без права — 403, без токена — 401.

`POST /api/products` → JWT authentication → role authorization (`Admin`) → `ProductsController` → `ProductService` → `Product` → `IProductRepository`/`IUnitOfWork` → `ProductRepository`/`AppDbContext` → SQL Server.

`GET /api/products/{id}` проходить той самий шлях, але repository читає сутність з `AsNoTracking`, а service повертає DTO, не exposing EF entity напряму.
