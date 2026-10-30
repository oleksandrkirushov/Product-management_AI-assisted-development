# Services, DI and HTTP

## Dependency injection

- `inject()` instead of constructor injection:
  ```ts
  export class UserPageComponent {
    private readonly userApi = inject(UserApi);
    private readonly router = inject(Router);
  }
  ```
- `@Injectable({ providedIn: 'root' })` for singleton services (tree-shakable).
- A service with component-local state goes in that component's `providers: [...]`.
- Configuration and non-class dependencies — via `InjectionToken`:
  ```ts
  export const API_URL = new InjectionToken<string>('API_URL');
  ```
- One service — one responsibility: `UserApi` (HTTP), `UserStore` (state), rather than one `UserService` for everything.

## HTTP

- Setup in `app.config.ts`:
  ```ts
  provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor]))
  ```
- Interceptors are functional (`HttpInterceptorFn`), not class-based:
  ```ts
  export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const token = inject(AuthStore).token();
    return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
  };
  ```
- Always type responses: `http.get<User[]>(...)`. Describe API models in separate files in `features/models/`.
- Components don't call `HttpClient` directly — only through API services.
- Don't hard-code the backend URL — take it from `environment` or an `InjectionToken`.
- Error handling: general (401, 5xx) — in an interceptor; screen-specific — at the call site.
