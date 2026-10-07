import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { AuthService } from './auth-service';
import { LoginResponse } from '@features/models/auth';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should send login request to correct endpoint', () => {
    const mockResponse: LoginResponse = {
      accessToken: 'test-token',
      tokenType: 'Bearer',
      expiresAtUtc: '2024-01-01T23:59:59Z',
    };

    service.login('admin', 'pass').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.username).toBe('admin');
    req.flush(mockResponse);
  });

  it('should store token on successful login', () => {
    const mockResponse: LoginResponse = {
      accessToken: 'my-token',
      tokenType: 'Bearer',
      expiresAtUtc: '2024-01-01T23:59:59Z',
    };

    service.login('user', 'pass').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    req.flush(mockResponse);

    expect(service.getToken()).toBe('my-token');
  });

  it('should remove token on logout', () => {
    service.setToken('token');
    service.logout();
    expect(service.getToken()).toBeNull();
  });

  it('should return authenticated status correctly', () => {
    expect(service.isAuthenticated()).toBeFalse();
    service.setToken('token');
    expect(service.isAuthenticated()).toBeTrue();
    service.logout();
    expect(service.isAuthenticated()).toBeFalse();
  });
});
