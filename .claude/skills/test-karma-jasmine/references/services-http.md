# Services, signal stores, HTTP, interceptors

## API service with HttpClient

```ts
@Injectable({ providedIn: 'root' })
export class ProductApi {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<Product[]>('/api/products');
  }

  update(product: Product) {
    return this.http.put<Product>(`/api/products/${product.id}`, product);
  }
}
```

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

describe('ProductApi', () => {
  const product: Product = { id: 'p1', name: 'Book', price: 10, stock: 3 };

  let api: ProductApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()], // order matters: provideHttpClient first
    });
    api = TestBed.inject(ProductApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify()); // fails if unexpected / unhandled requests remain

  it('should GET all products', async () => {
    const result = firstValueFrom(api.getAll());

    const req = httpMock.expectOne('/api/products');
    expect(req.request.method).toBe('GET');
    req.flush([product]);

    expect(await result).toEqual([product]);
  });

  it('should PUT the product to its url', async () => {
    const result = firstValueFrom(api.update(product));

    const req = httpMock.expectOne({ method: 'PUT', url: '/api/products/p1' });
    expect(req.request.body).toEqual(product);
    req.flush(product);

    expect(await result).toEqual(product);
  });

  it('should propagate server errors', async () => {
    const result = firstValueFrom(api.getAll());

    httpMock.expectOne('/api/products').flush('Boom', { status: 500, statusText: 'Server Error' });

    await expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ status: 500 }));
  });
});
```

Key points:
- `firstValueFrom()` turns an Observable into a Promise — no manual `subscribe` and `done`.
- The subscription (or `firstValueFrom`) must happen **before** `expectOne` — otherwise the request hasn't been sent yet.
- Errors — `flush(body, { status, statusText })`; network failures — `req.error(new ProgressEvent('error'))`.
- Several requests to one URL — `httpMock.match(url)`; checking that there was no request — `httpMock.expectNone(url)`.

## Signal store with a dependency

We replace the dependency with a spy — testing the store logic, not HTTP:

```ts
@Injectable({ providedIn: 'root' })
export class ProductStore {
  private readonly api = inject(ProductApi);
  private readonly _products = signal<Product[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly products = this._products.asReadonly();
  readonly error = this._error.asReadonly();
  readonly inStock = computed(() => this._products().filter((p) => p.stock > 0));

  load(): void {
    this.api.getAll().subscribe({
      next: (products) => this._products.set(products),
      error: () => this._error.set('Failed to load products'),
    });
  }
}
```

```ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

describe('ProductStore', () => {
  const book: Product = { id: 'p1', name: 'Book', price: 10, stock: 3 };
  const pen: Product = { id: 'p2', name: 'Pen', price: 2, stock: 0 };

  let store: ProductStore;
  let api: jasmine.SpyObj<ProductApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ProductApi>('ProductApi', ['getAll']);
    TestBed.configureTestingModule({
      providers: [{ provide: ProductApi, useValue: api }],
    });
    store = TestBed.inject(ProductStore);
  });

  it('should load products and expose only in-stock ones via inStock', () => {
    api.getAll.and.returnValue(of([book, pen]));

    store.load();

    expect(api.getAll).toHaveBeenCalledTimes(1);
    expect(store.products()).toEqual([book, pen]);
    expect(store.inStock()).toEqual([book]);
    expect(store.error()).toBeNull();
  });

  it('should set an error when loading fails', () => {
    api.getAll.and.returnValue(throwError(() => new Error('500')));

    store.load();

    expect(store.products()).toEqual([]);
    expect(store.error()).toBe('Failed to load products');
  });
});
```

- `computed` is read synchronously — `TestBed.tick()` isn't needed for it.
- `of(...)` is synchronous, so no `await` is needed after `load()`. For async responses see [async.md](async.md).

## Functional interceptor

```ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};
```

```ts
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should add the Authorization header when a token exists', () => {
    TestBed.inject(AuthStore).login('abc'); // a real simple store instead of a mock

    http.get('/api/data').subscribe();

    const req = httpMock.expectOne('/api/data');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    req.flush({});
  });

  it('should not add the header without a token', () => {
    http.get('/api/data').subscribe();

    const req = httpMock.expectOne('/api/data');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
```

We test the interceptor through a real `HttpClient` with it in the chain — this verifies the real behavior rather than calling the function with fake `req`/`next`.
