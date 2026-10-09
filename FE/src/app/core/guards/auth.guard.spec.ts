import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { authGuard } from './auth.guard';
import { AuthService } from '@features/services/auth.service';
import { User } from '@features/models/user';
import { LoginResponse } from '@features/models/auth';

describe('authGuard', () => {
  let authService: AuthService;
  let router: Router;
  let httpMock: HttpTestingController;

  const mockUser: User = {
    id: '1',
    username: 'admin',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['Admin'],
    permissions: ['*'],
    createdAtUtc: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClientTesting(), { provide: Router, useValue: routerSpy }],
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);

    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function callAuthGuard() {
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = { url: '/products' } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
  }

  function authenticate(): void {
    const mockResponse: LoginResponse = {
      accessToken: 'test-token',
      tokenType: 'Bearer',
      expiresAtUtc: '2024-01-01T23:59:59Z',
    };

    authService.login('admin', 'pass').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush(mockResponse);
    httpMock.expectOne(`${environment.apiUrl}/users/me`).flush(mockUser);
  }

  it('should allow access if user is authenticated', () => {
    authenticate();

    const result = callAuthGuard();

    expect(result).toBeTrue();
  });

  it('should block access if user is not authenticated', () => {
    const result = callAuthGuard();

    expect(result).toBeFalse();
  });

  it('should block access if a token exists but the profile was not loaded yet', () => {
    authService.setToken('test-token');

    const result = callAuthGuard();

    expect(result).toBeFalse();
  });

  it('should navigate to login if user is not authenticated', () => {
    callAuthGuard();

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should not navigate if user is authenticated', () => {
    authenticate();

    callAuthGuard();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should navigate to login after logout', () => {
    authenticate();
    authService.logout();

    callAuthGuard();

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
