import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import { LoginResponse } from '@features/models/auth';
import { RegisterRequest, RegisterResponse, User } from '@features/models/user';

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

  const mockUser: User = {
    id: '1',
    username: 'admin',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['Admin'],
    permissions: ['*'],
    isActive: true,
    createdAtUtc: '2024-01-01T00:00:00Z',
  };

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

    httpMock.expectOne(`${environment.apiUrl}/users/me`).flush(mockUser);
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
    httpMock.expectOne(`${environment.apiUrl}/users/me`).flush(mockUser);

    expect(service.getToken()).toBe('my-token');
  });

  it('should load current user profile on successful login', () => {
    const mockResponse: LoginResponse = {
      accessToken: 'my-token',
      tokenType: 'Bearer',
      expiresAtUtc: '2024-01-01T23:59:59Z',
    };

    service.login('admin', 'pass').subscribe();

    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush(mockResponse);
    httpMock.expectOne(`${environment.apiUrl}/users/me`).flush(mockUser);

    expect(service.currentUser()).toEqual(mockUser);
    expect(service.permissions()).toEqual(['*']);
  });

  it('should clear current user on logout', () => {
    const mockResponse: LoginResponse = {
      accessToken: 'my-token',
      tokenType: 'Bearer',
      expiresAtUtc: '2024-01-01T23:59:59Z',
    };

    service.login('admin', 'pass').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush(mockResponse);
    httpMock.expectOne(`${environment.apiUrl}/users/me`).flush(mockUser);

    service.logout();

    expect(service.currentUser()).toBeNull();
  });

  it('should propagate error and not set token when login request fails', () => {
    let error: unknown;

    service.login('admin', 'wrong-pass').subscribe({
      error: (err) => (error = err),
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(error).toBeTruthy();
    expect(service.getToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('should propagate error and leave currentUser unset when fetching profile fails after successful login', () => {
    const mockResponse: LoginResponse = {
      accessToken: 'my-token',
      tokenType: 'Bearer',
      expiresAtUtc: '2024-01-01T23:59:59Z',
    };
    let error: unknown;
    let nextValue: LoginResponse | undefined;

    service.login('admin', 'pass').subscribe({
      next: (value) => (nextValue = value),
      error: (err) => (error = err),
    });

    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush(mockResponse);
    httpMock
      .expectOne(`${environment.apiUrl}/users/me`)
      .flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

    expect(error).toBeTruthy();
    expect(nextValue).toBeUndefined();
    expect(service.currentUser()).toBeNull();
  });

  it('should return register response on successful registration', () => {
    const mockRequest: RegisterRequest = {
      username: 'newuser',
      email: 'new@test.com',
      firstName: 'New',
      lastName: 'User',
      password: 'Password123!',
    };
    const mockResponse: RegisterResponse = {
      id: '2',
      username: 'newuser',
      email: 'new@test.com',
      firstName: 'New',
      lastName: 'User',
      createdAtUtc: '2024-01-01T00:00:00Z',
    };
    let result: RegisterResponse | undefined;

    service.register(mockRequest).subscribe((response) => (result = response));

    httpMock.expectOne(`${environment.apiUrl}/auth/register`).flush(mockResponse);

    expect(result).toEqual(mockResponse);
  });

  it('should propagate error when registration fails due to duplicate username (409)', () => {
    const mockRequest: RegisterRequest = {
      username: 'existinguser',
      email: 'existing@test.com',
      firstName: 'Existing',
      lastName: 'User',
      password: 'Password123!',
    };
    let error: unknown;

    service.register(mockRequest).subscribe({ error: (err) => (error = err) });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
    req.flush({ message: 'Username already exists' }, { status: 409, statusText: 'Conflict' });

    expect((error as { status: number }).status).toBe(409);
  });

  it('should propagate error when registration fails due to invalid data (400)', () => {
    const mockRequest: RegisterRequest = {
      username: '',
      email: 'invalid-email',
      firstName: '',
      lastName: '',
      password: '',
    };
    let error: unknown;

    service.register(mockRequest).subscribe({ error: (err) => (error = err) });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
    req.flush({ message: 'Validation failed' }, { status: 400, statusText: 'Bad Request' });

    expect((error as { status: number }).status).toBe(400);
  });

  it('should send register request to correct endpoint', () => {
    const mockRequest: RegisterRequest = {
      username: 'newuser',
      email: 'new@test.com',
      firstName: 'New',
      lastName: 'User',
      password: 'Password123!',
    };
    const mockResponse: RegisterResponse = {
      id: '2',
      username: 'newuser',
      email: 'new@test.com',
      firstName: 'New',
      lastName: 'User',
      createdAtUtc: '2024-01-01T00:00:00Z',
    };

    service.register(mockRequest).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mockRequest);
    req.flush(mockResponse);
  });

  describe('hasPermission', () => {
    function setPermissions(permissions: string[]): void {
      const mockResponse: LoginResponse = {
        accessToken: 'my-token',
        tokenType: 'Bearer',
        expiresAtUtc: '2024-01-01T23:59:59Z',
      };

      service.login('admin', 'pass').subscribe();
      httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush(mockResponse);
      httpMock.expectOne(`${environment.apiUrl}/users/me`).flush({ ...mockUser, permissions });
    }

    it('should grant access to everything when permission is wildcard "*"', () => {
      setPermissions(['*']);

      expect(service.hasPermission('products:read')).toBeTrue();
      expect(service.hasPermission('orders:delete')).toBeTrue();
    });

    it('should grant access to all actions on a resource when resource wildcard is present', () => {
      setPermissions(['products:*']);

      expect(service.hasPermission('products:read')).toBeTrue();
      expect(service.hasPermission('products:create')).toBeTrue();
      expect(service.hasPermission('orders:read')).toBeFalse();
    });

    it('should grant access only for exact permission match', () => {
      setPermissions(['products:read']);

      expect(service.hasPermission('products:read')).toBeTrue();
      expect(service.hasPermission('products:create')).toBeFalse();
    });

    it('should deny access when no permissions are set', () => {
      expect(service.hasPermission('products:read')).toBeFalse();
    });

    it('should grant access for a permission without a colon when it matches exactly', () => {
      setPermissions(['admin']);

      expect(service.hasPermission('admin')).toBeTrue();
      expect(service.hasPermission('user')).toBeFalse();
    });
  });

  it('should remove token on logout', () => {
    service.setToken('token');
    service.logout();
    expect(service.getToken()).toBeNull();
  });

  it('should return authenticated status based on currentUser, not just the token', () => {
    const mockResponse: LoginResponse = {
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresAtUtc: '2024-01-01T23:59:59Z',
    };

    expect(service.isAuthenticated()).toBeFalse();

    service.setToken('token');
    expect(service.isAuthenticated()).toBeFalse();

    service.login('admin', 'pass').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush(mockResponse);
    httpMock.expectOne(`${environment.apiUrl}/users/me`).flush(mockUser);
    expect(service.isAuthenticated()).toBeTrue();

    service.logout();
    expect(service.isAuthenticated()).toBeFalse();
  });

  describe('rehydrate', () => {
    it('should resolve without requests when no token is stored', async () => {
      let called = false;

      await service.rehydrate().forEach(() => (called = true));

      httpMock.expectNone(`${environment.apiUrl}/users/me`);
      expect(called).toBeTrue();
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('should load the current user profile when a valid token is stored', async () => {
      service.setToken('stored-token');

      const rehydratePromise = service.rehydrate().forEach(() => undefined);
      httpMock.expectOne(`${environment.apiUrl}/users/me`).flush(mockUser);
      await rehydratePromise;

      expect(service.currentUser()).toEqual(mockUser);
      expect(service.isAuthenticated()).toBeTrue();
    });

    it('should clear the token and logout when the stored token is invalid', async () => {
      service.setToken('invalid-token');

      const rehydratePromise = service.rehydrate().forEach(() => undefined);
      httpMock
        .expectOne(`${environment.apiUrl}/users/me`)
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
      await rehydratePromise;

      expect(service.getToken()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
    });
  });

  describe('password reset', () => {
    it('should POST the email to /auth/forgot-password and complete on 202', () => {
      let completed = false;

      service.forgotPassword('user@example.com').subscribe({ complete: () => (completed = true) });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'user@example.com' });
      req.flush(
        { message: 'If an account with this email exists, a reset link has been sent.' },
        { status: 202, statusText: 'Accepted' },
      );
      expect(completed).toBe(true);
    });

    it('should POST token and newPassword to /auth/reset-password and complete on 204', () => {
      let completed = false;

      service.resetPassword('abc', 'NewPass123').subscribe({ complete: () => (completed = true) });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/reset-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ token: 'abc', newPassword: 'NewPass123' });
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(completed).toBe(true);
    });
  });
});
