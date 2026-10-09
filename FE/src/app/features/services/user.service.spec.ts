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
});
