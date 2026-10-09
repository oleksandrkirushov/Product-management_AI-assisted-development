import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '@features/services/auth.service';
import { Router } from '@angular/router';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let authService: AuthService;
  let router: Router;
  let http: HttpClient;

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpClient);

    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should add Authorization header with Bearer token', () => {
    const token = 'test-token-123';
    authService.setToken(token);

    http.get('/api/products').subscribe();

    const req = httpMock.expectOne('/api/products');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush({});
  });

  it('should not add Authorization header if no token', () => {
    http.get('/api/public').subscribe();

    const req = httpMock.expectOne('/api/public');
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({});
  });

  it('should logout and navigate on 401 error', () => {
    authService.setToken('expired-token');

    http.get('/api/products').subscribe({
      next: () => fail('should have errored'),
      error: () => {
        expect(authService.isAuthenticated()).toBeFalse();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
      },
    });

    const req = httpMock.expectOne('/api/products');
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
  });
});
