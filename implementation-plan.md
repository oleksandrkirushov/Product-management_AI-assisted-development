<!-- # FE and BE integration implementation plan

**Date:** 2026-10-07
**Project:** Products Audit (Angular 22 FE + ASP.NET Core 10 BE)
**Status:** Under review

---

## Current state analysis

### Frontend (FE/)
- **Framework:** Angular 22 (standalone, zoneless)
- **HTTP:** Doesn't use `HttpClient` — `ProductService` returns mock data via `of(MOCK_PRODUCTS).pipe(delay())`
- **Models:** `Product` (id: string, name: string, price: number)
- **Configuration:** `src/environments/environment.ts` — empty, no API URL
- **Components:** the `List` component uses `rxResource` to load data
- **Tests:** Karma + Jasmine, with mock data for testing

### Backend (BE/)
- **Framework:** ASP.NET Core 10 (Clean Architecture)
- **DB:** SQL Server (EF Core)
- **Authentication:** JWT Bearer
- **Running:** Docker Compose (port 8080)
- **Endpoints:**
  - `POST /api/auth/login` — login (demo credentials: admin/Admin123!)
  - `POST /api/products` — create (requires the Admin role)
  - `GET /api/products/{id}` — get by ID
  - `PUT /api/products/{id}` — update (requires the Admin role)
- **Models:**
  - `ProductDto`: `{ Id: Guid, Name: string, Price: decimal, CreatedAtUtc: DateTime }`
  - `CreateProductRequest`: `{ Name: string, Price: decimal }`
  - `UpdateProductRequest`: `{ Name: string, Price: decimal }`
- **Documentation:** Swagger is available at `/swagger`

---

## Problems to solve

1. **Model mismatch:** FE uses `id: string`, BE returns `Id: Guid`
2. **Price type mismatch:** FE uses `number`, BE returns `decimal`
3. **Missing extra fields:** FE has no `CreatedAtUtc`
4. **No HTTP client:** FE isn't set up for HTTP requests
5. **No API configuration:** No base API URL
6. **No authentication on FE:** No JWT token, no login service
7. **No CORS:** BE needs CORS configured to allow requests from FE
8. **No error handling:** No global error handler for HTTP errors

---

## Implementation plan

### Phase 1: Infrastructure preparation (BE)

#### 1.1 CORS setup
- **File:** `BE/src/ProductCatalog.Api/Program.cs`
- **Action:** Add CORS middleware for the FE port (http://localhost:4200)
- **Reason:** Allow requests from FE to BE
- **Complexity:** Low (3-5 lines of code)

#### 1.2 Adding the GET /api/products endpoint (product list)
- **File:** `BE/src/ProductCatalog.Api/Controllers/ProductsController.cs`
- **Action:** Add a `GetAll()` method to get the list of all products
- **Returns:** `List<ProductDto>`
- **Complexity:** Low (the logic already exists in `ProductService`)

#### 1.3 Exporting OpenAPI/Swagger JSON
- **File:** `BE/src/ProductCatalog.Api/Program.cs`
- **Action:** Configure Swagger to generate the OpenAPI schema
- **Reason:** Use it for code generation on FE or for manually writing HTTP services
- **Complexity:** Low (already configured)

---

### Phase 2: Configuration setup (FE + BE)

#### 2.1 API URL configuration (FE)
- **Files:**
  - `FE/src/environments/environment.ts`
  - `FE/src/environments/environment.development.ts`
- **Action:** Add `apiUrl` to each environment file
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
- **Complexity:** Very low

#### 2.2 CORS URL synchronization (BE)
- **File:** `BE/src/ProductCatalog.Api/Program.cs`
- **Action:** Make sure CORS allows http://localhost:4200
- **Complexity:** Very low

---

### Phase 3: Authentication implementation (FE)

#### 3.1 Creating authentication models
- **New file:** `FE/src/app/features/models/auth.ts`
- **Model:**
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
- **Complexity:** Very low

#### 3.2 Creating the authentication service
- **New file:** `FE/src/app/features/services/auth-service.ts`
- **Functionality:**
  - `login(username, password): Observable<LoginResponse>`
  - `logout(): void`
  - `getToken(): string | null`
  - `setToken(token: string): void`
  - `isAuthenticated(): boolean`
  - Storing the token in `localStorage` or `sessionStorage`
- **Dependencies:** `HttpClient`, `environment`
- **Complexity:** Medium (8-15 lines of code)

#### 3.3 Creating an HTTP interceptor for JWT
- **New file:** `FE/src/app/core/interceptors/auth.interceptor.ts`
- **Functionality:**
  - Add `Authorization: Bearer {token}` to all HTTP requests
  - Handle 401 errors (invalid token)
  - Redirect to the login page on 401
- **Dependencies:** `HttpInterceptorFn`, `AuthService`
- **Complexity:** Medium

#### 3.4 Adding the interceptor to `program.ts`
- **File:** `FE/src/main.ts`
- **Action:** Register the interceptor in `provideHttpClient()`
- **Complexity:** Very low

---

### Phase 4: Updating data models (FE)

#### 4.1 Updating the Product model
- **File:** `FE/src/app/features/models/product.ts`
- **New structure:**
  ```typescript
  export interface Product {
    id: string; // UUID from the backend (Guid)
    name: string;
    price: number; // decimal from the backend (treated as number in JS)
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
- **Complexity:** Very low

#### 4.2 Adding a type converter
- **New file:** `FE/src/app/features/services/product-mapper.ts` (optional)
- **Functionality:** Converting the backend DTO to the FE model (if a transformation is needed)
- **Complexity:** Very low

---

### Phase 5: Updating the product service (FE)

#### 5.1 Rewriting ProductService
- **File:** `FE/src/app/features/services/product-service.ts`
- **New methods:**
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
- **Dependencies:** `HttpClient`, `environment`
- **Removal:** `MOCK_DELAY_MS`, `of()`, `delay()`
- **Complexity:** Low

#### 5.2 Updating ProductService tests
- **File:** `FE/src/app/features/services/product-service.spec.ts`
- **New tests:**
  - Mocking HttpClient (instead of of/delay)
  - Testing requests to each endpoint
  - Testing HTTP errors
- **Tools:** `HttpClientTestingModule`, `HttpTestingController`
- **Complexity:** Medium

---

### Phase 6: Updating components (FE)

#### 6.1 Updating the List component
- **File:** `FE/src/app/features/list/list.ts`
- **Actions:**
  - Use the updated `ProductService.getAll()`
  - Add error handling (error state)
  - Add a loading state (if needed)
- **Complexity:** Low (3-5 changes)

#### 6.2 Creating a Login component (optional)
- **New file:** `FE/src/app/features/auth/login.ts`
- **Functionality:**
  - Login form (username, password)
  - Calling `AuthService.login()`
  - Redirecting to List after a successful login
- **Complexity:** Medium

#### 6.3 Route protection
- **File:** `FE/src/app/features/list/list.routes.ts` (or other routes)
- **Action:** Add `canActivate: [authGuard]` to protected routes
- **New file:** `FE/src/app/core/guards/auth.guard.ts`
- **Complexity:** Medium

---

### Phase 7: Error handling and edge cases (FE)

#### 7.1 Global error handler
- **New file:** `FE/src/app/core/error-handler/global-error-handler.ts`
- **Functionality:**
  - Intercepting and logging HTTP errors
  - Showing user-friendly messages
- **Complexity:** Medium

#### 7.2 Error handling in components
- **Files:** `list.ts` and others
- **Action:** Add an error state to `rxResource`
- **Complexity:** Low

---

### Phase 8: Integration testing

#### 8.1 End-to-end testing (E2E)
- **Environment:** Docker Compose (API + DB running)
- **Scenarios:**
  1. Login → get a JWT
  2. GET /api/products (no data) → empty list
  3. POST /api/products → create a product
  4. GET /api/products/{id} → get the created product
  5. PUT /api/products/{id} → update the product
  6. Invalid token → 401 Unauthorized → redirect to Login
- **Tools:** Playwright or Protractor
- **Complexity:** High (20-40 lines of spec code)

#### 8.2 Integration tests (API)
- **File:** `FE/src/app/features/services/product-service.integration.spec.ts`
- **Action:** Run real HTTP requests against the BE (if available)
- **Complexity:** Medium

---

## Execution order

### Sprint 1: Basic infrastructure
- [x] **1.1** BE: CORS setup → 30 min
- [x] **1.2** BE: GET /api/products endpoint → 30 min
- [x] **2.1** FE: API URL configuration → 15 min

### Sprint 2: Authentication
- [x] **3.1** FE: Authentication models → 20 min
- [x] **3.2** FE: AuthService → 60 min
- [x] **3.3** FE: JWT Interceptor → 45 min
- [x] **3.4** FE: Registering the interceptor → 10 min

### Sprint 3: Updating models and services
- [x] **4.1** FE: Updating the Product model → 15 min
- [x] **5.1** FE: Rewriting ProductService → 45 min
- [x] **5.2** FE: Updating tests → 60 min

### Sprint 4: Components and navigation
- [x] **6.1** FE: Updating the List component → 30 min
- [x] **6.2** FE: Login component (optional) → 60 min
- [x] **6.3** FE: Auth Guard → 45 min

### Sprint 5: Error handling and testing
- [x] **7.1** FE: Global error handler → 45 min
- [x] **7.2** FE: Error states in components → 30 min
- [x] **8.1** E2E testing → 120 min
- [x] **8.2** Integration tests → 60 min

**Total time:** ~12 hours of development

---

## Dependencies and risks

### Dependencies
- ✅ BE is running and available at localhost:8080
- ✅ SqlServer container is running
- ✅ FE dev server is running at localhost:4200

### Risks
1. **CORS errors** → Solution: Check the configuration on the BE
2. **JWT expiration** → Solution: Add a refresh token flow (future)
3. **Guid vs string types** → Solution: Use string on the FE for IDs
4. **Decimal precision** → Solution: Use number with rounding on the FE
5. **No BE migrations** → Solution: Use EnsureCreatedAsync (already implemented)

---

## Tools and libraries

### FE
- `@angular/common/http` — HttpClient for requests
- `rxjs` — Observable, delay, tap, catchError
- Karma + Jasmine — testing
- Playwright — E2E testing (optional)

### BE
- `Microsoft.AspNetCore.Cors` — CORS
- `Microsoft.IdentityModel.Tokens` — JWT validation (already used)
- Swagger/Swashbuckle — API documentation (already configured)

---

## Success criteria

- [ ] BE CORS is configured, requests from localhost:4200 go through
- [ ] FE successfully authenticates via `/api/auth/login`
- [ ] FE receives the JWT token and stores it in localStorage
- [ ] FE adds the JWT to all HTTP requests via the interceptor
- [ ] FE successfully loads the product list from `/api/products`
- [ ] FE successfully creates a new product via `/api/products`
- [ ] FE successfully gets a product by ID via `/api/products/{id}`
- [ ] Invalid token → 401 → redirect to Login
- [ ] All unit tests pass (FE)
- [ ] E2E testing passed successfully

---

## Additional considerations (future)

- [ ] Refresh token flow
- [ ] Logout functionality
- [ ] Delete endpoint for products
- [ ] Product search and filtering
- [ ] Pagination
- [ ] Role-based authorization (Admin vs User)
- [ ] Loading skeletons in the UI
- [ ] Toast error messages
- [ ] State management (NgRx, Akita, or signals)

--- -->


