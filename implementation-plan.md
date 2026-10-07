# План реалізації інтеграції FE та BE

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
