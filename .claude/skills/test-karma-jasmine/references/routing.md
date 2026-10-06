# Guards, маршрути, сторінки з httpResource

## Функціональний guard

```ts
export const authGuard: CanActivateFn = () =>
  inject(AuthStore).isLoggedIn() || inject(Router).createUrlTree(['/login']);
```

```ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

describe('authGuard', () => {
  // Guard використовує inject() — викликаємо його в injection context
  const runGuard = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('should allow navigation for a logged-in user', () => {
    TestBed.inject(AuthStore).login('token');

    expect(runGuard()).toBeTrue();
  });

  it('should redirect an anonymous user to /login', () => {
    const result = runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });
});
```

- Порожні `{} as ActivatedRouteSnapshot` — нормально, якщо guard не читає маршрут.
  Якщо читає — передай потрібні поля: `{ params: { id: '42' } } as unknown as ActivatedRouteSnapshot`.
- Так само тестуються `ResolveFn`, `CanMatchFn`, `CanDeactivateFn`.

## Сторінка: параметр маршруту → input → httpResource

```ts
@Component({
  selector: 'app-product-details-page',
  template: `
    @if (product.isLoading()) {
      <p>Завантаження…</p>
    } @else if (product.error()) {
      <p role="alert">Помилка завантаження</p>
    } @else if (product.hasValue()) {
      <h2>{{ product.value().name }}</h2>
    }
  `,
})
export class ProductDetailsPage {
  readonly id = input.required<string>();
  protected readonly product = httpResource<Product>(() => `/api/products/${this.id()}`);
}
```

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

describe('ProductDetailsPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'products/:id', component: ProductDetailsPage }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should bind the route param to the id input and render the loaded product', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/products/42', ProductDetailsPage);

    expect(page.id()).toBe('42');
    expect(harness.routeNativeElement?.textContent).toContain('Завантаження');

    httpMock.expectOne('/api/products/42').flush({ id: '42', name: 'Book', price: 10, stock: 1 });
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelector('h2')?.textContent).toContain('Book');
  });

  it('should show an error when the request fails', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/products/42', ProductDetailsPage);

    httpMock.expectOne('/api/products/42').flush('Not found', { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelector('[role="alert"]')).not.toBeNull();
  });
});
```

Ключове:
- `RouterTestingHarness` проходить справжню навігацію: guards, resolvers, `withComponentInputBinding()`.
  Це надійніше, ніж мокати `ActivatedRoute`.
- `navigateByUrl(url, Component)` повертає екземпляр компонента (і перевіряє його тип).
- Після `navigateByUrl` запит `httpResource` уже відправлено — можна одразу `expectOne`.
  **Не викликай `await whenStable()` до `flush()`**: незавершений запит тримає застосунок «нестабільним», і тест зависне.
- Після `flush()` — `await harness.fixture.whenStable()`, потім перевіряй DOM.

## Навігація з компонента
Перевіряй результат, а не виклик `router.navigate`:

```ts
const harness = await RouterTestingHarness.create('/products');
// ... клік по посиланню / кнопці
await harness.fixture.whenStable();
expect(TestBed.inject(Router).url).toBe('/products/42');
```
