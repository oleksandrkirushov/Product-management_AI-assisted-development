<!-- # План реалізації інтеграції FE та BE

**Дата:** 2026-10-07
**Проєкт:** Products Audit (Angular 22 FE + ASP.NET Core 10 BE)
**Статус:** На розгляді

---

## Аналіз поточного стану

### Фронтенд (FE/)
- **Фреймворк:** Angular 22 (standalone, zoneless)
- **HTTP:** Не використовує `HttpClient` — `ProductService` повертає мок-дані через `of(MOCK_PRODUCTS).pipe(delay())`
- **Моделі:** `Product` (id: string, name: string, price: number)
- **Конфігурація:** `src/environments/environment.ts` — порожня, без API URL
- **Компоненти:** `List` компонент використовує `rxResource` для завантаження даних
- **Тести:** Karma + Jasmine, мають мок-дані для тестування

### Бекенд (BE/)
- **Фреймворк:** ASP.NET Core 10 (Clean Architecture)
- **БД:** SQL Server (EF Core)
- **Автентифікація:** JWT Bearer
- **Запуск:** Docker Compose (порт 8080)
- **Endpoints:**
  - `POST /api/auth/login` — вхід (демо credentials: admin/Admin123!)
  - `POST /api/products` — створення (вимагає Admin роль)
  - `GET /api/products/{id}` — отримання за ID
  - `PUT /api/products/{id}` — оновлення (вимагає Admin роль)
- **Моделі:**
  - `ProductDto`: `{ Id: Guid, Name: string, Price: decimal, CreatedAtUtc: DateTime }`
  - `CreateProductRequest`: `{ Name: string, Price: decimal }`
  - `UpdateProductRequest`: `{ Name: string, Price: decimal }`
- **Документація:** Swagger доступна на `/swagger`

---

## Проблеми для вирішення

1. **Невідповідність моделей:** FE використовує `id: string`, BE повертає `Id: Guid`
2. **Невідповідність типів ціни:** FE використовує `number`, BE повертає `decimal`
3. **Відсутність додатних полів:** FE немає `CreatedAtUtc`
4. **Відсутність HTTP клієнта:** FE не налаштований для HTTP запитів
5. **Відсутність конфігурації API:** Немає URL базової адреси API
6. **Відсутність аутентифікації на FE:** Немає JWT токена, немає сервісу логіну
7. **Відсутність CORS:** BE потребує налаштування CORS для дозволу запитів з FE
8. **Відсутність обробки помилок:** Немає глобального errorhandler для HTTP помилок

---

## План реалізації

### Фаза 1: Підготовка інфраструктури (BE)

#### 1.1 Налаштування CORS
- **Файл:** `BE/src/ProductCatalog.Api/Program.cs`
- **Дія:** Додати CORS middleware на порту FE (http://localhost:4200)
- **Причина:** Дозволити запити з FE на BE
- **Сложность:** Низька (3-5 рядків кода)

#### 1.2 Додавання GET /api/products endpoint (список продуктів)
- **Файл:** `BE/src/ProductCatalog.Api/Controllers/ProductsController.cs`
- **Дія:** Додати `GetAll()` метод для отримання списку всіх продуктів
- **Повернення:** `List<ProductDto>`
- **Сложность:** Низька (вже є логіка в `ProductService`)

#### 1.3 Експорт OpenAPI/Swagger JSON
- **Файл:** `BE/src/ProductCatalog.Api/Program.cs`
- **Дія:** Налаштувати Swagger для генерації OpenAPI schema
- **Причина:** Використати для code generation на FE або ручної генерації HTTP сервісів
- **Сложность:** Низька (вже налаштовано)

---

### Фаза 2: Налаштування конфігурацій (FE + BE)

#### 2.1 Конфігурація API URL (FE)
- **Файли:**
  - `FE/src/environments/environment.ts`
  - `FE/src/environments/environment.development.ts`
- **Дія:** Додати `apiUrl` до кожного environment файлу
  ```typescript
  // development
  export const environment = {
    production: false,
    apiUrl: 'http://localhost:8080/api',
  };

  // production
  export const environment = {
    production: true,
    apiUrl: 'https://api.example.com/api',
  };
  ```
- **Сложность:** Дуже низька

#### 2.2 Синхронізація CORS URL (BE)
- **Файл:** `BE/src/ProductCatalog.Api/Program.cs`
- **Дія:** Переконатися, що CORS дозволяє http://localhost:4200
- **Сложность:** Дуже низька

---

### Фаза 3: Реалізація автентифікації (FE)

#### 3.1 Створення моделей автентифікації
- **Новий файл:** `FE/src/app/features/models/auth.ts`
- **Модель:**
  ```typescript
  export interface LoginRequest {
    username: string;
    password: string;
  }

  export interface LoginResponse {
    accessToken: string;
    tokenType: string;
    expiresAtUtc: string;
  }

  export interface AuthState {
    token: string | null;
    isAuthenticated: boolean;
  }
  ```
- **Сложность:** Дуже низька

#### 3.2 Створення сервісу автентифікації
- **Новий файл:** `FE/src/app/features/services/auth-service.ts`
- **Функціональність:**
  - `login(username, password): Observable<LoginResponse>`
  - `logout(): void`
  - `getToken(): string | null`
  - `setToken(token: string): void`
  - `isAuthenticated(): boolean`
  - Зберігання токена в `localStorage` або `sessionStorage`
- **Залежності:** `HttpClient`, `environment`
- **Сложность:** Середня (8-15 рядків кода)

#### 3.3 Створення HTTP Interceptor для JWT
- **Новий файл:** `FE/src/app/core/interceptors/auth.interceptor.ts`
- **Функціональність:**
  - Додавати `Authorization: Bearer {token}` до всіх HTTP запитів
  - Обробляти 401 помилки (невалідний токен)
  - Переспрямовувати на сторінку логіну при 401
- **Залежності:** `HttpInterceptorFn`, `AuthService`
- **Сложність:** Середня

#### 3.4 Додавання перехоплювача до `program.ts`
- **Файл:** `FE/src/main.ts`
- **Дія:** Зареєструвати interceptor в `provideHttpClient()`
- **Сложность:** Дуже низька

---

### Фаза 4: Оновлення моделей даних (FE)

#### 4.1 Оновлення моделі Product
- **Файл:** `FE/src/app/features/models/product.ts`
- **Нова структура:**
  ```typescript
  export interface Product {
    id: string; // UUID від бекенда (Guid)
    name: string;
    price: number; // decimal від бекенда (для JS вважається number)
    createdAtUtc: string; // DateTime ISO 8601
  }

  export interface CreateProductRequest {
    name: string;
    price: number;
  }

  export interface UpdateProductRequest {
    name: string;
    price: number;
  }
  ```
- **Сложность:** Дуже низька

#### 4.2 Додавання конвертора типів
- **Новий файл:** `FE/src/app/features/services/product-mapper.ts` (опціонально)
- **Функціональність:** Конвертація DTO від бекенда на FE модель (якщо потрібна трансформація)
- **Сложность:** Дуже низька

---

### Фаза 5: Оновлення сервісу продуктів (FE)

#### 5.1 Переписання ProductService
- **Файл:** `FE/src/app/features/services/product-service.ts`
- **Нові методи:**
  ```typescript
  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/products`);
  }

  getById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/products/${id}`);
  }

  create(request: CreateProductRequest): Observable<Product> {
    return this.http.post<Product>(`${this.apiUrl}/products`, request);
  }

  update(id: string, request: UpdateProductRequest): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/products/${id}`, request);
  }
  ```
- **Залежності:** `HttpClient`, `environment`
- **Видалення:** `MOCK_DELAY_MS`, `of()`, `delay()`
- **Сложность:** Низька

#### 5.2 Оновлення тестів ProductService
- **Файл:** `FE/src/app/features/services/product-service.spec.ts`
- **Нові тести:**
  - Мокування HttpClient (заміст of/delay)
  - Тестування запитів до кожного endpoint
  - Тестування помилок HTTP
- **Инструменти:** `HttpClientTestingModule`, `HttpTestingController`
- **Сложність:** Середня

---

### Фаза 6: Оновлення компонентів (FE)

#### 6.1 Оновлення List компонента
- **Файл:** `FE/src/app/features/list/list.ts`
- **Дії:**
  - Використовувати оновлену `ProductService.getAll()`
  - Додати обробку помилок (error state)
  - Додати loading state (якщо потрібно)
- **Сложність:** Низька (3-5 змін)

#### 6.2 Створення Login компонента (опціонально)
- **Новий файл:** `FE/src/app/features/auth/login.ts`
- **Функціональність:**
  - Форма входу (username, password)
  - Виклик `AuthService.login()`
  - Переспрямування на List після успішного входу
- **Сложність:** Середня

#### 6.3 Захист маршрутів
- **Файл:** `FE/src/app/features/list/list.routes.ts` (або інші маршрути)
- **Дія:** Додати `canActivate: [authGuard]` до protected маршрутів
- **Новий файл:** `FE/src/app/core/guards/auth.guard.ts`
- **Сложність:** Середня

---

### Фаза 7: Обробка помилок та edge cases (FE)

#### 7.1 Глобальний error handler
- **Новий файл:** `FE/src/app/core/error-handler/global-error-handler.ts`
- **Функціональність:**
  - Перехоплення та логування помилок HTTP
  - Показ user-friendly повідомлень
- **Сложність:** Середня

#### 7.2 Обробка помилок в компонентах
- **Файли:** `list.ts` та інші
- **Дія:** Додати error state до `rxResource`
- **Сложність:** Низька

---

### Фаза 8: Тестування інтеграції

#### 8.1 Наскрізне тестування (E2E)
- **Середовище:** Docker Compose (API + БД запущені)
- **Сценарії:**
  1. Логін → отримуємо JWT
  2. GET /api/products (без даних) → порожній список
  3. POST /api/products → створюємо продукт
  4. GET /api/products/{id} → отримуємо створений продукт
  5. PUT /api/products/{id} → оновлюємо продукт
  6. Невалідний токен → 401 Unauthorized → переспрямування на Login
- **Інструменти:** Playwright або Protractor
- **Сложность:** Висока (20-40 рядків spec code)

#### 8.2 Інтеграційні тести (API)
- **Файл:** `FE/src/app/features/services/product-service.integration.spec.ts`
- **Дія:** Запустити реальні HTTP запити до BE (за наявності)
- **Сложность:** Середня

---

## Порядок виконання

### Спринт 1: Базова інфраструктура
- [x] **1.1** BE: CORS налаштування → 30 хв
- [x] **1.2** BE: GET /api/products endpoint → 30 хв
- [x] **2.1** FE: Конфігурація API URL → 15 хв

### Спринт 2: Автентифікація
- [x] **3.1** FE: Моделі автентифікації → 20 хв
- [x] **3.2** FE: AuthService → 60 хв
- [x] **3.3** FE: JWT Interceptor → 45 хв
- [x] **3.4** FE: Додавання interceptor → 10 хв

### Спринт 3: Оновлення моделей та сервісів
- [x] **4.1** FE: Оновлення Product моделі → 15 хв
- [x] **5.1** FE: Переписання ProductService → 45 хв
- [x] **5.2** FE: Оновлення тестів → 60 хв

### Спринт 4: Компоненти та навігація
- [x] **6.1** FE: Оновлення List компонента → 30 хв
- [x] **6.2** FE: Login компонент (опціонально) → 60 хв
- [x] **6.3** FE: Auth Guard → 45 хв

### Спринт 5: Обробка помилок та тестування
- [x] **7.1** FE: Global error handler → 45 хв
- [x] **7.2** FE: Error states в компонентах → 30 хв
- [x] **8.1** E2E тестування → 120 хв
- [x] **8.2** Інтеграційні тести → 60 хв

**Загальний час:** ~12 годин розробки

---

## Залежності та ризики

### Залежності
- ✅ BE запущений та доступний на localhost:8080
- ✅ SqlServer контейнер запущений
- ✅ FE dev сервер запущений на localhost:4200

### Ризики
1. **CORS помилки** → Розв'язання: Перевірити конфігурацію на BE
2. **JWT експіраця** → Розв'язання: Додати refresh token flow (future)
3. **Типи Guid vs string** → Розв'язання: Використовувати string на FE для ID
4. **Decimal точність** → Розв'язання: Використовувати number з округленням на FE
5. **Відсутність migration BE** → Розв'язання: Використовувати EnsureCreatedAsync (вже реалізовано)

---

## Інструменти та бібліотеки

### FE
- `@angular/common/http` — HttpClient для запитів
- `rxjs` — Observable, delay, tap, catchError
- Karma + Jasmine — тестування
- Playwright — E2E тестування (опціонально)

### BE
- `Microsoft.AspNetCore.Cors` — CORS
- `Microsoft.IdentityModel.Tokens` — JWT validation (вже використовується)
- Swagger/Swashbuckle — API документація (вже налаштовано)

---

## Успіх критерії

- [ ] BE CORS налаштований, запити з localhost:4200 проходять
- [ ] FE успішно авторизується через `/api/auth/login`
- [ ] FE отримує JWT токен та зберігає в localStorage
- [ ] FE додає JWT до всіх HTTP запитів через interceptor
- [ ] FE успішно завантажує список продуктів з `/api/products`
- [ ] FE успішно створює новий продукт через `/api/products`
- [ ] FE успішно отримує продукт за ID через `/api/products/{id}`
- [ ] Перевалідний токен → 401 → переспрямування на Login
- [ ] Усі unit тести проходять (FE)
- [ ] E2E тестування пройшло успішно

---

## Додаткові розгляди (future)

- [ ] Refresh token flow
- [ ] Logout функціональність
- [ ] Delete endpoint для продуктів
- [ ] Пошук та фільтрація продуктів
- [ ] Pagination
- [ ] Роль-базована авторизація (Admin vs User)
- [ ] Loading скелетони в UI
- [ ] Toast повідомлення про помилки
- [ ] State management (NgRx, Akita, або сигнали)

--- -->

# Phase 4: User Management

**Дата аналізу:** 2026-10-08
**Статус:** Планування

## Аналіз поточного стану

### Поточна автентифікація: Demo-only, без управління користувачами

**BE:**
- **User model:** Відсутня — демо-користувач жорстко закодований у `appsettings.json`:
  ```json
  "DemoUser": { "Username": "admin", "Password": "Admin123!" }
  ```
- **JWT claims:** У токені лише `ClaimTypes.Name` (username) та `ClaimTypes.Role` ("Admin" — жорстко)
- **Автентифікація:** `AuthController.Login()` порівнює username/password в plain text (немає хешування)
- **Залеж:** Немає таблиці User в БД, немає User entity, немає репозиторію
- **Авторизація:** Role-based (`[Authorize(Roles = "Admin")]`), але жорстко в коді

**FE:**
- **User tracking:** AuthService зберігає лише JWT токен, не знає username/roles/email користувача
- **Registration:** Відсутня — можна логінитися лише через demo credentials
- **User profile:** Не показується ніде інформація про залогіненого користувача
- **Role-based UI:** Немає — UI однаковий для всіх

### Архітектурні паттерни (за результатами дослідження)

**BE (Clean Architecture):**
- **Domain:** Entities (sealed) із factory-конструкторами та доменною валідацією
- **Application:** Services з Commands, DTO mapping, Repository абстракція
- **Infrastructure:** EF Core contexts, repository implementations, DI extension methods
- **API:** Controllers з `[Authorize]` attributes, `[ProducesResponseType(...)]` декоратори

**FE (Angular 22):**
- **Services:** RxJS Observables, HttpClient, сигнали для стану
- **Forms:** Reactive forms з `NonNullableFormBuilder`, `takeUntilDestroyed()` для cleanup
- **Auth flow:** AuthService + AuthInterceptor + AuthGuard (уже реалізовано)
- **Models:** Interfaces у `@features/models/`

---

## Висновки: Що потрібно для User Management

### 1. Backend: Domain Layer (BE)

**Нова User Entity:**
- Властивості: `Id` (Guid), `Username` (string), `Email` (string), `FirstName`, `LastName`, `PasswordHash` (string), `Role` (string або foreign key), `CreatedAtUtc`, `UpdatedAtUtc`
- Паттерн: Sealed class з factory-конструктором, private setters, domain validation у конструкторі
- Валідація в конструкторі: Username/Email не пусті, Email format, Password strength (при реєстрації)

**Нова Role Entity (для гнучкості):**
- Властивості: `Id` (Guid), `Name` (string), `Permissions` (JSON array або оборотна таблиця)
- Причина: Дозволяє створювати custom ролі без перебудови коду
- Дизайн permissions: Масив рядків (`["products:read", "products:create", "products:update", "users:read", "users:manage"]`)
  - Формат `resource:action` дозволяє RBAC, ABAC розширення в майбутньому

### 2. Backend: Application Layer (BE)

**RegisterUserService:**
- Команда: `RegisterUserCommand { Username, Email, FirstName, LastName, Password }`
- Logic: Валідація, перевірка унікальності username/email, хешування пароля (bcrypt), створення User entity, збереження в БД
- DTO: `CreateUserResponse { Id, Username, Email, FirstName, LastName, CreatedAtUtc }`

**UpdateUserService (опціонально):**
- Оновлення FirstName/LastName, Email (з перевіркою унікальності)
- Password change (вимагає поточний пароль)

**UserRepository:**
- Methods: `FindByUsernameAsync`, `FindByEmailAsync`, `FindByIdAsync`, `CreateAsync`, `UpdateAsync`
- Абстракція для DI

### 3. Backend: Infrastructure Layer (BE)

**Database:**
- Міграція EF Core: Додати таблиці `Users` та `Roles`
- `Users` table: Id (PK), Username (UNIQUE), Email (UNIQUE), FirstName, LastName, PasswordHash, RoleId (FK), CreatedAtUtc, UpdatedAtUtc
- `Roles` table: Id (PK), Name (UNIQUE), Permissions (JSON array), CreatedAtUtc
- Seed: Додати default "Admin" role з permissions `["*"]` (all), "User" role з `["products:read"]`

**AppDbContext:**
- `DbSet<User>` та `DbSet<Role>`
- Model configuration: FK constraint, unique indexes, JSON serialization для permissions

### 4. Backend: API Layer (BE)

**Endpoints:**
- `POST /api/auth/register` — Registration (public, no auth required)
  - Request: `{ username, email, firstName, lastName, password }`
  - Response: `{ id, username, email, firstName, lastName, createdAtUtc }`
  - Status: 201 Created or 400 BadRequest (username taken, invalid email, etc.)

- `GET /api/users/me` — Current user profile (requires auth)
  - Response: `{ id, username, email, firstName, lastName, roles: string[], permissions: string[], createdAtUtc }`
  - Used by FE to populate user context after login

- `GET /api/users` — List users (requires `[Authorize(Roles = "Admin")]` or permission check)
  - Response: `List<{ id, username, email, firstName, lastName, role, createdAtUtc }>`
  - Pagination (optional for Phase 4)

- `PUT /api/users/{id}` — Update user (admin only or self-edit)
- `DELETE /api/users/{id}` — Delete user (admin only)

**JWT Claims Update:**
- Включити у JWT token: `ClaimTypes.Name`, `ClaimTypes.Email`, `ClaimTypes.Role`, custom claim `"permissions"` (JSON array)
- FE сможе читати permissions прямо з токену без доп. запиту

### 5. Frontend: Models (FE)

**User Interface:**
```typescript
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  createdAtUtc: string;
}
```

**Registration Request/Response:**
```typescript
export interface RegisterRequest {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAtUtc: string;
}
```

### 6. Frontend: Services (FE)

**Розширення AuthService:**
- Додати `currentUser: signal<User | null>(null)` — зберігати logged-in user
- Додати `permissions: computed(() => this.currentUser()?.permissions ?? [])`
- Додати `hasPermission(permission: string): boolean` — для role-based UI
- Оновити `login()`: Після отримання JWT, викликати `GET /api/users/me` та popolate `currentUser`
- Додати `register(request: RegisterRequest): Observable<RegisterResponse>`

**UserService (новий):**
- `getMe(): Observable<User>` — GET /api/users/me
- `getAll(): Observable<User[]>` — GET /api/users (admin only)
- `update(id: string, updates: Partial<User>): Observable<User>`
- `delete(id: string): Observable<void>`

### 7. Frontend: Components (FE)

**RegisterForm (новий компонент):**
- Паттерн як LoginForm + ProductForm (reactive form, signals, validation)
- Поля: username, email, firstName, lastName, password, confirmPassword
- Валідація: Required, Email format, Password strength (min 8 chars, uppercase, number), Confirm password match
- On submit: `AuthService.register()` → На успіх: `AuthService.login(username, password)` + navigate to `/products`
- Маршрут: `POST /auth/register` (public, no auth required)

**UserProfileComponent (опціонально):**
- Show current user info (from `AuthService.currentUser`)
- Link до profile edit form, logout button

**Permissions UI pattern:**
- Directive або pipe для `*appHasPermission="'products:create'"` — приховувати/показувати UI на базі permission

---

## План реалізації: Phase 4 (User Management)

### Етап 1: BE Database & Domain (2-3 години)

1. **Создати User Entity:**
   - Файл: `BE/src/ProductCatalog.Domain/Entities/User.cs`
   - Sealed class, factory constructor, private setters, domain validation
   - Properties: Id, Username, Email, FirstName, LastName, PasswordHash, RoleId, CreatedAtUtc, UpdatedAtUtc

2. **Создати Role Entity:**
   - Файл: `BE/src/ProductCatalog.Domain/Entities/Role.cs`
   - Sealed class, properties: Id, Name, Permissions (JSON)
   - Relationship: User has one Role, Role has many Users

3. **Оновити AppDbContext:**
   - Файл: `BE/src/ProductCatalog.Infrastructure/Persistence/AppDbContext.cs`
   - Додати `DbSet<User>` та `DbSet<Role>`
   - Model configuration: FK constraint, unique indexes (Username, Email), JSON serialization

4. **Seed default roles:**
   - У EnsureCreatedAsync: Додати Admin та User ролі із дефолтними permissions

### Етап 2: BE Services & Repositories (2 години)

1. **Створити IUserRepository + UserRepository:**
   - Файли: `BE/src/ProductCatalog.Application/Repositories/IUserRepository.cs` та Infrastructure impl
   - Methods: FindByUsernameAsync, FindByEmailAsync, FindByIdAsync, CreateAsync, UpdateAsync

2. **Створити RegisterUserService:**
   - Файл: `BE/src/ProductCatalog.Application/Users/RegisterUserService.cs`
   - DI: IUserRepository, IUnitOfWork
   - Logic: Валідація, перевірка унікальності, bcrypt hashing (using `BCrypt.Net-Next` NuGet), create User entity

3. **Розширити AuthService:**
   - Файл: `BE/src/ProductCatalog.Application/Auth/AuthService.cs` (новий або розширення existing)
   - Method: `AuthenticateAsync(username, password)` — знайти User, перевірити пароль, згенерувати JWT з permissions claim

### Етап 3: BE API Endpoints (1.5 години)

1. **POST /api/auth/register:**
   - Файл: `BE/src/ProductCatalog.Api/Controllers/AuthController.cs`
   - Action: `Register(RegisterRequest request)` → call RegisterUserService → return 201 Created or 400

2. **GET /api/users/me:**
   - File: Новий `BE/src/ProductCatalog.Api/Controllers/UsersController.cs` або додати до AuthController
   - Action: `GetProfile()` — читає claims з JWT, повертає User data
   - Authorization: `[Authorize]`

3. **GET /api/users (опціонально для Phase 4):**
   - Action: `GetAll()` — requires Admin role
   - Pagination: Опціонально

### Етап 4: FE Models & Services (1 година)

1. **Додати User models:**
   - Файл: `FE/src/app/features/models/user.ts`
   - Interfaces: User, RegisterRequest, RegisterResponse

2. **Розширити AuthService:**
   - Файл: `FE/src/app/features/services/auth-service.ts`
   - Додати: currentUser signal, permissions computed, hasPermission(), register() method, getProfile() call після login

3. **Створити UserService (опціонально):**
   - Файл: `FE/src/app/features/services/user-service.ts` (для admin features)

### Етап 5: FE Registration Component (1.5 години)

1. **Створити RegisterForm:**
   - Файл: `FE/src/app/features/auth/register.ts`, `.html`, `.scss`, `.spec.ts`
   - Паттерн: Як LoginComponent + ProductForm (reactive form, signals, validation)
   - Маршрут: `/auth/register` (public)
   - On submit: register → auto login → navigate to /products

2. **Оновити app routing:**
   - Додати маршрут `/auth/register` (public, не потребує guard)

3. **Оновити Login маршрут:**
   - Додати link до "Register" на Login page

### Етап 6: Optional — FE Permissions UI (1 година)

1. **Створити `*appHasPermission` directive:**
   - Файл: `FE/src/app/shared/directives/has-permission.directive.ts`
   - Usage: `<button *appHasPermission="'products:create'">Create</button>` — приховує якщо permission відсутня

2. **Додати User profile display:**
   - Розширити header (або навіваціонну панель) — показувати username + logout link

---

## Порядок виконання Phase 4

| # | Завдання | Час | Статус |
|---|----------|-----|--------|
| **BE** | | | |
| 1 | User Entity + Role Entity | 1 год | - |
| 2 | AppDbContext + migrations | 1 год | - |
| 3 | IUserRepository + seed | 0.5 год | - |
| 4 | RegisterUserService | 1 год | - |
| 5 | POST /api/auth/register endpoint | 0.5 год | - |
| 6 | GET /api/users/me endpoint | 0.5 год | - |
| 7 | JWT claims + permissions | 0.5 год | - |
| **FE** | | | |
| 8 | User models (User, RegisterRequest) | 0.5 год | - |
| 9 | Розширити AuthService + UserService | 1 год | - |
| 10 | RegisterForm component + tests | 1.5 год | - |
| 11 | Routing + Login → Register link | 0.5 год | - |
| 12 | *appHasPermission directive (опціонально) | 1 год | - |
| **Integration & Testing** | | | |
| 13 | E2E: Register → Login → Access protected | 1 год | - |
| 14 | Unit & integration tests | 1.5 год | - |

**Загальний час:** ~12 годин розробки + тестування

---

## Дизайн Permissions: Гнучкий для розширення

### Current Design: Resource:Action Format

```json
{
  "Admin": ["*"],  // all permissions
  "User": ["products:read", "products:comment"],
  "ProductManager": ["products:*", "users:read"]
}
```

Формат дозволяє:
- **RBAC** (Role-Based Access Control) — перевірка конкретної ролі
- **PBAC** (Permission-Based Access Control) — перевірка конкретного дозволу
- **Wildcards** — `"products:*"` дозволяє всі дії на продукти
- **Custom roles** — легко додавати нові ролі без зміни коду
- **FE validation** — AuthService.hasPermission() для UI

### Future Extensions:

1. **Атрибути-based Access Control (ABAC):**
   ```json
   {
     "permission": "products:update",
     "conditions": {
       "owner": true,  // може змінювати тільки свої продукти
       "status": "draft"  // тільки draft продукти
     }
   }
   ```

2. **Dynamic permissions:**
   - Endpoint: `GET /api/roles/{roleId}/permissions` — завантажити динамічно
   - Refresh permissions в AuthService після login

3. **Resource ownership:**
   - Коли перевіряєш `products:update`, додати логіку "owned by user"

---

## Успіх критерії Phase 4

- [ ] User Entity створена, мігрована на SQL Server
- [ ] Role Entity створена з дефолтними ролями (Admin, User)
- [ ] POST /api/auth/register → 201 Created (користувач зареєстрований, може логінитися)
- [ ] RegisterForm на FE → заповнити форму → submit → автоматичний login → redirect до /products
- [ ] GET /api/users/me повертає поточного користувача із permissions
- [ ] AuthService.currentUser() содержит logged-in user info
- [ ] AuthService.hasPermission('products:create') повертає true/false на базі JWT permissions
- [ ] FE: Login page має link на Register
- [ ] FE: Реєстрація з невалідними даними показує помилки (username taken, weak password, etc.)
- [ ] Усі unit тести проходять (BE + FE)
- [ ] E2E: Register → Login → Access /products → View protected endpoint
