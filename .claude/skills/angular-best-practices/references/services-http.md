# Сервіси, DI та HTTP

## Dependency injection

- `inject()` замість ін'єкції через конструктор:
  ```ts
  export class UserPage {
    private readonly userApi = inject(UserApi);
    private readonly router = inject(Router);
  }
  ```
- `@Injectable({ providedIn: 'root' })` для singleton-сервісів (tree-shakable).
- Сервіс із локальним станом компонента — у `providers: [...]` цього компонента.
- Конфігурація та не-класові залежності — через `InjectionToken`:
  ```ts
  export const API_URL = new InjectionToken<string>('API_URL');
  ```
- Один сервіс — одна відповідальність: `UserApi` (HTTP), `UserStore` (стан), а не один `UserService` на все.

## HTTP

- Налаштування в `app.config.ts`:
  ```ts
  provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor]))
  ```
- Interceptors — функціональні (`HttpInterceptorFn`), не класові:
  ```ts
  export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const token = inject(AuthStore).token();
    return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
  };
  ```
- Завжди типізуй відповіді: `http.get<User[]>(...)`. Опиши моделі API в окремих файлах у `features/models/`.
- Компоненти не викликають `HttpClient` напряму — лише через API-сервіси.
- URL бекенду не хардкодь — бери з `environment` або `InjectionToken`.
- Обробка помилок: загальна (401, 5xx) — в interceptor; специфічна для екрана — у місці виклику.
