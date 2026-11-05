import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { User } from '@features/models/user';
import { AuthService } from '@features/services/auth.service';
import { ProfileMenuComponent } from './profile-menu.component';

const user: User = {
  id: 'u1',
  username: 'jdoe',
  email: 'jdoe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  roles: ['admin', 'user'],
  permissions: [],
  isActive: true,
  createdAtUtc: '2024-01-01T00:00:00Z',
};

describe('ProfileMenuComponent', () => {
  let fixture: ComponentFixture<ProfileMenuComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;

  function query<T extends Element>(selector: string, root: HTMLElement = fixture.nativeElement): T {
    const element = root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`${selector} not found`);
    }
    return element;
  }

  function trigger(): HTMLButtonElement {
    return query<HTMLButtonElement>('.profile-menu__trigger');
  }

  function panel(): HTMLElement {
    return query<HTMLElement>('[popover]');
  }

  async function render(value: User): Promise<void> {
    fixture.componentRef.setInput('user', value);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);

    await TestBed.configureTestingModule({
      imports: [ProfileMenuComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(ProfileMenuComponent);
  });

  it('should label the trigger with the full name and point it at the panel', async () => {
    await render(user);

    const button = trigger();
    expect(button.getAttribute('aria-label')).toBe('Account: John Doe');
    expect(button.getAttribute('title')).toBe('John Doe');
    expect(button.getAttribute('popovertarget')).toBe(panel().id);
  });

  it('should show the initials in the avatar', async () => {
    await render(user);

    expect(query<HTMLElement>('app-avatar').textContent?.trim()).toBe('JD');
  });

  it('should expose the panel as a dialog named Account', async () => {
    await render(user);

    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-label')).toBe('Account');
  });

  it('should open the panel with the full name and roles when the trigger is clicked', async () => {
    await render(user);

    trigger().click();
    await fixture.whenStable();

    expect(panel().matches(':popover-open')).toBeTrue();
    expect(query<HTMLElement>('.profile-menu__name').textContent?.trim()).toBe('John Doe');
    expect(query<HTMLElement>('.profile-menu__roles').textContent?.trim()).toBe('admin, user');
  });

  it('should fall back to the username when the full name is empty', async () => {
    await render({ ...user, firstName: '', lastName: ' ' });

    expect(query<HTMLElement>('.profile-menu__name').textContent?.trim()).toBe('jdoe');
    expect(trigger().getAttribute('aria-label')).toBe('Account: jdoe');
  });

  it('should hide the role line when the user has no roles', async () => {
    await render({ ...user, roles: [] });

    expect(fixture.nativeElement.querySelector('.profile-menu__roles')).toBeNull();
  });

  it('should show only the first name without a trailing space when the last name is empty', async () => {
    await render({ ...user, firstName: ' John ', lastName: '' });

    expect(query<HTMLElement>('.profile-menu__name').textContent?.trim()).toBe('John');
    expect(trigger().getAttribute('aria-label')).toBe('Account: John');
  });

  it('should update the name, label and initials when the user input changes', async () => {
    await render(user);

    await render({ ...user, firstName: 'Jane', lastName: 'Smith', roles: ['viewer'] });

    expect(query<HTMLElement>('.profile-menu__name').textContent?.trim()).toBe('Jane Smith');
    expect(query<HTMLElement>('.profile-menu__roles').textContent?.trim()).toBe('viewer');
    expect(trigger().getAttribute('aria-label')).toBe('Account: Jane Smith');
    expect(query<HTMLElement>('app-avatar').textContent?.trim()).toBe('JS');
  });

  it('should give each instance its own panel id so every trigger opens its own panel', async () => {
    await render(user);
    const other = TestBed.createComponent(ProfileMenuComponent);
    other.componentRef.setInput('user', user);
    await other.whenStable();
    const otherPanel = query<HTMLElement>('[popover]', other.nativeElement);
    const otherTrigger = query<HTMLButtonElement>('.profile-menu__trigger', other.nativeElement);

    expect(otherPanel.id).not.toBe(panel().id);
    expect(otherTrigger.getAttribute('popovertarget')).toBe(otherPanel.id);
    expect(trigger().getAttribute('popovertarget')).toBe(panel().id);
  });

  it('should return focus to the trigger when the panel is closed from inside', async () => {
    await render(user);
    trigger().focus();
    trigger().click();
    await fixture.whenStable();
    query<HTMLButtonElement>('.profile-menu__logout').focus();

    panel().hidePopover();

    expect(document.activeElement).toBe(trigger());
  });

  it('should log out and navigate to login when Logout is clicked', async () => {
    await render(user);

    query<HTMLButtonElement>('.profile-menu__logout').click();

    expect(authService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
