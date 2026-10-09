import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@features/services/auth.service';
import { User } from '@features/models/user';
import { Header } from './header';

const user: User = {
  id: 'u1',
  username: 'jdoe',
  email: 'jdoe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  roles: ['user'],
  permissions: [],
  createdAtUtc: '2024-01-01T00:00:00Z',
};

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let currentUser: ReturnType<typeof signal<User | null>>;

  function username(): string | null {
    return fixture.nativeElement.querySelector('.app-header__username')?.textContent ?? null;
  }

  function logoutButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.app-header__logout');
  }

  beforeEach(async () => {
    currentUser = signal<User | null>(null);
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout'], {
      currentUser: currentUser.asReadonly(),
    });
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
  });

  it('should render nothing when no user is logged in', () => {
    expect(fixture.nativeElement.querySelector('.app-header')).toBeNull();
  });

  it('should show the username when a user is logged in', async () => {
    currentUser.set(user);
    await fixture.whenStable();

    expect(username()).toContain('jdoe');
  });

  it('should log out and navigate to login when the logout button is clicked', async () => {
    currentUser.set(user);
    await fixture.whenStable();

    const button = logoutButton();
    if (!button) {
      throw new Error('Logout button not found');
    }
    button.click();

    expect(authService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
