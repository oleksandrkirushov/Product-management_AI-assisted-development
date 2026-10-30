import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By, Title } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from './app.routes';
import { ProductService } from '@features/services/product.service';
import { AuthService } from '@features/services/auth.service';
import { UserService } from '@features/services/user.service';
import { ListComponent } from '@features/list/list.component';
import { LoginComponent } from '@features/auth/login/login.component';
import { RegisterComponent } from '@features/auth/register/register.component';
import { UsersComponent } from '@features/admin/users/users.component';
import { AdminLayoutComponent } from '@features/admin/admin-layout/admin-layout.component';

describe('app routes', () => {
  let authService: jasmine.SpyObj<AuthService>;

  function usersPage(harness: RouterTestingHarness): UsersComponent | null {
    return harness.routeDebugElement?.query(By.directive(UsersComponent))?.componentInstance ?? null;
  }

  beforeEach(() => {
    const productService = jasmine.createSpyObj<ProductService>('ProductService', ['getAll']);
    productService.getAll.and.returnValue(of([]));
    const userService = jasmine.createSpyObj<UserService>('UserService', ['getAll']);
    userService.getAll.and.returnValue(of([]));
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'hasPermission'], {
      currentUser: signal(null).asReadonly(),
    });
    authService.isAuthenticated.and.returnValue(true);
    authService.hasPermission.and.returnValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: ProductService, useValue: productService },
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: authService },
      ],
    });
  });

  it('should open the List page with the "Product list" title on /products', async () => {
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/products', ListComponent);

    expect(page).toBeInstanceOf(ListComponent);
    expect(TestBed.inject(Title).getTitle()).toBe('Product list');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe('Product list');
  });

  it('should redirect the root URL to /products', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/', ListComponent);

    expect(TestBed.inject(Router).url).toBe('/products');
  });

  it('should redirect an unknown URL to /products', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/does/not/exist', ListComponent);

    expect(TestBed.inject(Router).url).toBe('/products');
  });

  it('should redirect /admin to /admin/users and open the Users page inside the admin layout', async () => {
    const harness = await RouterTestingHarness.create();

    const layout = await harness.navigateByUrl('/admin', AdminLayoutComponent);

    expect(layout).toBeInstanceOf(AdminLayoutComponent);
    expect(TestBed.inject(Router).url).toBe('/admin/users');
    expect(usersPage(harness)).toBeInstanceOf(UsersComponent);
  });

  it('should open the Users page with the "Users" title on /admin/users when the user has users:read', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/admin/users', AdminLayoutComponent);

    expect(usersPage(harness)).toBeInstanceOf(UsersComponent);
    expect(authService.hasPermission).toHaveBeenCalledWith('users:read');
    expect(TestBed.inject(Title).getTitle()).toBe('Users');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe('Users');
  });

  it('should redirect /admin to /products when the user lacks users:read', async () => {
    authService.hasPermission.and.callFake((permission) => permission !== 'users:read');
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/admin', ListComponent);

    expect(TestBed.inject(Router).url).toBe('/products');
  });

  it('should redirect /admin/users to /products when the user lacks users:read', async () => {
    authService.hasPermission.and.callFake((permission) => permission !== 'users:read');
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/admin/users', ListComponent);

    expect(TestBed.inject(Router).url).toBe('/products');
  });

  it('should open the Login page on /login', async () => {
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/login', LoginComponent);

    expect(page).toBeInstanceOf(LoginComponent);
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('should open the Register page on /register', async () => {
    const harness = await RouterTestingHarness.create();

    const page = await harness.navigateByUrl('/register', RegisterComponent);

    expect(page).toBeInstanceOf(RegisterComponent);
    expect(TestBed.inject(Router).url).toBe('/register');
  });

  it('should redirect /admin to /login when the user is not authenticated', async () => {
    authService.isAuthenticated.and.returnValue(false);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/admin', LoginComponent);

    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
