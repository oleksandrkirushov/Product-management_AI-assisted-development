import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { User } from '@features/models/user';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UserService, provideHttpClientTesting()],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getMe', () => {
    it('should fetch the current user profile', () => {
      service.getMe().subscribe((user) => {
        expect(user).toEqual(mockUser);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/users/me`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);
    });
  });

  describe('getAll', () => {
    it('should fetch all users from the API', () => {
      const mockUsers: User[] = [mockUser];

      service.getAll().subscribe((users) => {
        expect(users).toEqual(mockUsers);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/users`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUsers);
    });

    it('should return empty array when no users exist', () => {
      service.getAll().subscribe((users) => {
        expect(users).toEqual([]);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/users`);
      req.flush([]);
    });
  });

  describe('getById', () => {
    it('should fetch a single user by ID', () => {
      service.getById('1').subscribe((user) => {
        expect(user).toEqual(mockUser);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/users/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);
    });
  });

  describe('activate', () => {
    it('should send PATCH to the activate endpoint and complete on 204', () => {
      const next = jasmine.createSpy('next');
      const complete = jasmine.createSpy('complete');

      service.activate('1').subscribe({ next, complete });
      const req = httpMock.expectOne(`${environment.apiUrl}/users/1/activate`);
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it('should propagate a 400 error with the server message', () => {
      const body = { message: 'You cannot modify your own account.' };
      let error: HttpErrorResponse | undefined;

      service.activate('1').subscribe({
        next: () => fail('expected an error'),
        error: (e: HttpErrorResponse) => (error = e),
      });
      httpMock
        .expectOne(`${environment.apiUrl}/users/1/activate`)
        .flush(body, { status: 400, statusText: 'Bad Request' });

      expect(error?.status).toBe(400);
      expect(error?.error).toEqual(body);
    });
  });

  describe('deactivate', () => {
    it('should send PATCH to the deactivate endpoint and complete on 204', () => {
      const next = jasmine.createSpy('next');
      const complete = jasmine.createSpy('complete');

      service.deactivate('1').subscribe({ next, complete });
      const req = httpMock.expectOne(`${environment.apiUrl}/users/1/deactivate`);
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it('should propagate a 400 error with the server message', () => {
      const body = { message: 'The last active administrator cannot be deactivated.' };
      let error: HttpErrorResponse | undefined;

      service.deactivate('1').subscribe({
        next: () => fail('expected an error'),
        error: (e: HttpErrorResponse) => (error = e),
      });
      httpMock
        .expectOne(`${environment.apiUrl}/users/1/deactivate`)
        .flush(body, { status: 400, statusText: 'Bad Request' });

      expect(error?.status).toBe(400);
      expect(error?.error).toEqual(body);
    });
  });

  describe('delete', () => {
    it('should send DELETE to the user endpoint and complete on 204', () => {
      const next = jasmine.createSpy('next');
      const complete = jasmine.createSpy('complete');

      service.delete('1').subscribe({ next, complete });
      const req = httpMock.expectOne(`${environment.apiUrl}/users/1`);
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(req.request.method).toBe('DELETE');
      expect(next).toHaveBeenCalledTimes(1);
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it('should propagate a 400 error with the server message', () => {
      const body = { message: 'The last active administrator cannot be deleted.' };
      let error: HttpErrorResponse | undefined;

      service.delete('1').subscribe({
        next: () => fail('expected an error'),
        error: (e: HttpErrorResponse) => (error = e),
      });
      httpMock
        .expectOne(`${environment.apiUrl}/users/1`)
        .flush(body, { status: 400, statusText: 'Bad Request' });

      expect(error?.status).toBe(400);
      expect(error?.error).toEqual(body);
    });
  });
});
