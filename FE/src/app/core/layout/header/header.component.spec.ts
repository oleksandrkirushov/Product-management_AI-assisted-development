import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@features/services/auth.service';
import { User } from '@features/models/user';
import { HeaderComponent } from './header.component';

const user: User = {
  id: 'u1',
  username: 'jdoe',
  email: 'jdoe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  roles: ['user'],
  permissions: [],
  isActive: true,
  createdAtUtc: '2024-01-01T00:00:00Z',
};

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;
  let currentUser: ReturnType<typeof signal<User | null>>;

  function username(): string | null {
    return fixture.nativeElement.querySelector('.app-header__username')?.textContent ?? null;
  }

  function logoutButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.app-header__logout');
  }

  function adminLink(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector('a[href="/admin"]');
  }

  function productsLink(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector('a[href="/products"]');
  }

  function requireLink(link: HTMLAnchorElement | null, name: string): HTMLAnchorElement {
    if (!link) {
      throw new Error(`${name} link not found`);
    }
    return link;
  }

  beforeEach(async () => {
    currentUser = signal<User | null>(null);
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout', 'hasPermission'], {
      currentUser: currentUser.asReadonly(),
    });
    authService.hasPermission.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([
          { path: 'admin', children: [] },
          {
            path: 'products',
            children: [
              { path: '', children: [] },
              { path: 'new', children: [] },
            ],
          },
        ]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(HeaderComponent);
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

  it('should expose the full username in the title when it may be truncated', async () => {
    currentUser.set(user);
    await fixture.whenStable();

    const element = fixture.nativeElement.querySelector('.app-header__username');
    expect(element?.getAttribute('title')).toBe('jdoe');
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

  it('should show the Admin link when the user has the users:read permission', async () => {
    authService.hasPermission.and.callFake((permission) => permission === 'users:read');
    currentUser.set(user);
    await fixture.whenStable();

    expect(requireLink(adminLink(), 'Admin').textContent?.trim()).toBe('Admin');
    expect(authService.hasPermission).toHaveBeenCalledWith('users:read');
  });

  it('should hide the Admin link when the user lacks the users:read permission', async () => {
    currentUser.set(user);
    await fixture.whenStable();

    expect(adminLink()).toBeNull();
    expect(authService.hasPermission).toHaveBeenCalledWith('users:read');
  });

  it('should show the Products link when the user has the users:read permission', async () => {
    authService.hasPermission.and.callFake((permission) => permission === 'users:read');
    currentUser.set(user);
    await fixture.whenStable();

    expect(requireLink(productsLink(), 'Products').textContent?.trim()).toBe('Products');
  });

  it('should show the Products link when the user has no permissions', async () => {
    currentUser.set(user);
    await fixture.whenStable();

    expect(requireLink(productsLink(), 'Products').textContent?.trim()).toBe('Products');
  });

  it('should render the Products link before the Admin link', async () => {
    authService.hasPermission.and.callFake((permission) => permission === 'users:read');
    currentUser.set(user);
    await fixture.whenStable();

    const links = Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('nav a'));
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Products', 'Admin']);
  });

  it('should hide the Admin link when the current user loses the users:read permission', async () => {
    authService.hasPermission.and.callFake(
      (permission) => currentUser()?.permissions.includes(permission) ?? false
    );
    currentUser.set({ ...user, permissions: ['users:read'] });
    await fixture.whenStable();
    expect(adminLink()).not.toBeNull();

    currentUser.set({ ...user, permissions: [] });
    await fixture.whenStable();

    expect(adminLink()).toBeNull();
    expect(productsLink()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('nav')).not.toBeNull();
    expect(username()).toContain('jdoe');
  });

  it('should label the navigation as Primary', async () => {
    currentUser.set(user);
    await fixture.whenStable();

    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Primary');
  });

  it('should mark the Admin link with aria-current="true" when the /admin route is active', async () => {
    authService.hasPermission.and.callFake((permission) => permission === 'users:read');
    currentUser.set(user);
    await fixture.whenStable();

    await router.navigateByUrl('/admin');
    await fixture.whenStable();

    const link = requireLink(adminLink(), 'Admin');
    expect(link.getAttribute('aria-current')).toBe('true');
    expect(link.classList).toContain('app-header__link--active');
  });

  it('should not mark the Admin link as current when another route is active', async () => {
    authService.hasPermission.and.callFake((permission) => permission === 'users:read');
    currentUser.set(user);
    await fixture.whenStable();

    await router.navigateByUrl('/products');
    await fixture.whenStable();

    const link = requireLink(adminLink(), 'Admin');
    expect(link.hasAttribute('aria-current')).toBeFalse();
    expect(link.classList).not.toContain('app-header__link--active');
  });

  it('should mark the Products link as current when the /products route is active', async () => {
    currentUser.set(user);
    await fixture.whenStable();

    await router.navigateByUrl('/products');
    await fixture.whenStable();

    const link = requireLink(productsLink(), 'Products');
    expect(link.getAttribute('aria-current')).toBe('true');
    expect(link.classList).toContain('app-header__link--active');
  });

  it('should keep the Products link current on a nested /products route', async () => {
    currentUser.set(user);
    await fixture.whenStable();

    await router.navigateByUrl('/products/new');
    await fixture.whenStable();

    const link = requireLink(productsLink(), 'Products');
    expect(link.getAttribute('aria-current')).toBe('true');
    expect(link.classList).toContain('app-header__link--active');
  });

  it('should not mark the Products link as current when the /admin route is active', async () => {
    authService.hasPermission.and.callFake((permission) => permission === 'users:read');
    currentUser.set(user);
    await fixture.whenStable();

    await router.navigateByUrl('/admin');
    await fixture.whenStable();

    const link = requireLink(productsLink(), 'Products');
    expect(link.hasAttribute('aria-current')).toBeFalse();
    expect(link.classList).not.toContain('app-header__link--active');
  });
});
