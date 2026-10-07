import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '@features/services/auth-service';

describe('authGuard', () => {
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
      ],
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);

    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function callAuthGuard() {
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = { url: '/products' } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
  }

  it('should allow access if user is authenticated', () => {
    authService.setToken('test-token');

    const result = callAuthGuard();

    expect(result).toBeTrue();
  });

  it('should block access if user is not authenticated', () => {
    const result = callAuthGuard();

    expect(result).toBeFalse();
  });

  it('should navigate to login if user is not authenticated', () => {
    callAuthGuard();

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should not navigate if user is authenticated', () => {
    authService.setToken('test-token');

    callAuthGuard();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should navigate to login after logout', () => {
    authService.setToken('token');
    authService.logout();

    callAuthGuard();

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
