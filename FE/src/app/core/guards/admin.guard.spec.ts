import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from '@features/services/auth.service';

describe('adminGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'hasPermission']);
    authService.isAuthenticated.and.returnValue(false);
    authService.hasPermission.and.returnValue(false);

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    });

    router = TestBed.inject(Router);
  });

  function callAdminGuard(): MaybeAsync<GuardResult> {
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = { url: '/admin/users' } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));
  }

  function redirectUrl(result: MaybeAsync<GuardResult>): string {
    if (!(result instanceof UrlTree)) {
      throw new Error(`Expected the guard to return a UrlTree, got: ${String(result)}`);
    }
    return router.serializeUrl(result);
  }

  it('should redirect to /login when the user is not authenticated', () => {
    const result = callAdminGuard();

    expect(redirectUrl(result)).toBe('/login');
  });

  it('should not check permissions when the user is not authenticated', () => {
    callAdminGuard();

    expect(authService.hasPermission).not.toHaveBeenCalled();
  });

  it('should redirect to /products when the user is authenticated without the users:read permission', () => {
    authService.isAuthenticated.and.returnValue(true);

    const result = callAdminGuard();

    expect(redirectUrl(result)).toBe('/products');
  });

  it('should allow access when the user is authenticated and has the users:read permission', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.hasPermission.and.returnValue(true);

    const result = callAdminGuard();

    expect(result).toBeTrue();
  });

  it('should request exactly the users:read permission', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.hasPermission.and.returnValue(true);

    callAdminGuard();

    expect(authService.hasPermission).toHaveBeenCalledOnceWith('users:read');
  });
});
