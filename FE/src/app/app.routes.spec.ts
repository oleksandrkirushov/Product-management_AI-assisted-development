import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from './app.routes';
import { ProductService } from '@features/services/product.service';
import { AuthService } from '@features/services/auth.service';
import { List } from './features/list/list';

describe('app routes', () => {
  beforeEach(() => {
    const productService = jasmine.createSpyObj<ProductService>('ProductService', ['getAll']);
    productService.getAll.and.returnValue(of([]));
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']);
    authService.isAuthenticated.and.returnValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: ProductService, useValue: productService },
        { provide: AuthService, useValue: authService },
      ],
    });
  });

  it('should open the List page with the "Product list" title on /products', async () => {
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/products', List);

    expect(page).toBeInstanceOf(List);
    expect(TestBed.inject(Title).getTitle()).toBe('Product list');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe('Product list');
  });

  it('should redirect the root URL to /products', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/', List);

    expect(TestBed.inject(Router).url).toBe('/products');
  });

  it('should redirect an unknown URL to /products', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/does/not/exist', List);

    expect(TestBed.inject(Router).url).toBe('/products');
  });
});
