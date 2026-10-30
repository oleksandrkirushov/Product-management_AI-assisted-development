# Guards, routes, pages with httpResource

## Functional guard

```ts
export const authGuard: CanActivateFn = () =>
  inject(AuthStore).isLoggedIn() || inject(Router).createUrlTree(['/login']);
```

```ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

describe('authGuard', () => {
  // The guard uses inject() — so we call it in an injection context
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

- Empty `{} as ActivatedRouteSnapshot` is fine if the guard doesn't read the route.
  If it does — pass the needed fields: `{ params: { id: '42' } } as unknown as ActivatedRouteSnapshot`.
- `ResolveFn`, `CanMatchFn`, `CanDeactivateFn` are tested the same way.

## Page: route parameter → input → httpResource

```ts
@Component({
  selector: 'app-product-details-page',
  template: `
    @if (product.isLoading()) {
      <p>Loading…</p>
    } @else if (product.error()) {
      <p role="alert">Failed to load</p>
    } @else if (product.hasValue()) {
      <h2>{{ product.value().name }}</h2>
    }
  `,
})
export class ProductDetailsPageComponent {
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

describe('ProductDetailsPageComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'products/:id', component: ProductDetailsPageComponent }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should bind the route param to the id input and render the loaded product', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/products/42', ProductDetailsPageComponent);

    expect(page.id()).toBe('42');
    expect(harness.routeNativeElement?.textContent).toContain('Loading');

    httpMock.expectOne('/api/products/42').flush({ id: '42', name: 'Book', price: 10, stock: 1 });
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelector('h2')?.textContent).toContain('Book');
  });

  it('should show an error when the request fails', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/products/42', ProductDetailsPageComponent);

    httpMock.expectOne('/api/products/42').flush('Not found', { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelector('[role="alert"]')).not.toBeNull();
  });
});
```

Key points:
- `RouterTestingHarness` goes through real navigation: guards, resolvers, `withComponentInputBinding()`.
  This is more reliable than mocking `ActivatedRoute`.
- `navigateByUrl(url, Component)` returns the component instance (and checks its type).
- After `navigateByUrl` the `httpResource` request has already been sent — you can `expectOne` right away.
  **Don't call `await whenStable()` before `flush()`**: a pending request keeps the app "unstable" and the test will hang.
- After `flush()` — `await harness.fixture.whenStable()`, then check the DOM.

## Navigation from a component
Check the result, not the `router.navigate` call:

```ts
const harness = await RouterTestingHarness.create('/products');
// ... click on a link / button
await harness.fixture.whenStable();
expect(TestBed.inject(Router).url).toBe('/products/42');
```
