import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { User } from '@features/models/user';
import { AuthService } from '@features/services/auth.service';
import { UserService } from '@features/services/user.service';
import { UsersComponent } from './users.component';

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'id',
    username: 'user',
    email: 'user@example.com',
    firstName: 'First',
    lastName: 'Last',
    roles: ['User'],
    permissions: ['products:read'],
    isActive: true,
    createdAtUtc: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const ADMIN = makeUser({
  id: 'a1',
  username: 'admin',
  email: 'admin@example.com',
  firstName: 'Ada',
  lastName: 'Admin',
  roles: ['Admin'],
  permissions: ['*'],
});
const ALICE = makeUser({
  id: 'u1',
  username: 'alice',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  permissions: ['products:read', 'products:create'],
});
const BOB = makeUser({
  id: 'u2',
  username: 'bob',
  email: 'bob@example.com',
  firstName: 'Bob',
  lastName: 'Brown',
  permissions: [],
  isActive: false,
});

describe('UsersComponent', () => {
  let fixture: ComponentFixture<UsersComponent>;
  let element: HTMLElement;
  let loader: HarnessLoader;
  let userService: jasmine.SpyObj<UserService>;
  let overlayContainer: OverlayContainer;

  function query<T extends Element>(selector: string, root: ParentNode = element): T {
    const found = root.querySelector<T>(selector);
    if (!found) {
      throw new Error(`Element "${selector}" not found`);
    }
    return found;
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(element.querySelectorAll<HTMLTableRowElement>('[data-testid="user-row"]'));
  }

  function rowOf(username: string): HTMLTableRowElement {
    const row = rows().find((r) => query('[data-testid="user-username"]', r).textContent?.includes(username));
    if (!row) {
      throw new Error(`Row for "${username}" not found`);
    }
    return row;
  }

  function cellTexts(selector: string): string[] {
    return rows().map((row) => query(selector, row).textContent?.trim() ?? '');
  }

  function triggerOf(username: string): HTMLButtonElement {
    return query<HTMLButtonElement>('[data-testid="user-actions"]', rowOf(username));
  }

  function overlay(): HTMLElement {
    return overlayContainer.getContainerElement();
  }

  async function openMenu(username: string): Promise<MatMenuHarness> {
    const menu = await loader.getHarness(MatMenuHarness.with({ selector: `[aria-label="Actions for ${username}"]` }));
    await menu.open();
    return menu;
  }

  function menuLabels(): string[] {
    return Array.from(overlay().querySelectorAll('.mat-mdc-menu-item-text')).map((el) => el.textContent?.trim() ?? '');
  }

  async function clickMenuItem(label: string): Promise<void> {
    const item = Array.from(overlay().querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')).find(
      (el) => query('.mat-mdc-menu-item-text', el).textContent?.trim() === label,
    );
    if (!item) {
      throw new Error(`Menu item "${label}" not found`);
    }
    item.click();
    await fixture.whenStable();
  }

  function dialogText(): string {
    return query('mat-dialog-container', overlay()).textContent ?? '';
  }

  async function clickDialogButton(testId: 'confirm-dialog-confirm' | 'confirm-dialog-cancel'): Promise<void> {
    query<HTMLButtonElement>(`[data-testid="${testId}"]`, overlay()).click();
    await fixture.whenStable();
  }

  function create(users$: Observable<User[]>): void {
    userService.getAll.and.returnValue(users$);
    fixture = TestBed.createComponent(UsersComponent);
    element = fixture.nativeElement;
    loader = TestbedHarnessEnvironment.loader(fixture);
  }

  async function setup(users$: Observable<User[]> = of([ADMIN, ALICE, BOB])): Promise<void> {
    create(users$);
    await fixture.whenStable();
  }

  beforeEach(() => {
    userService = jasmine.createSpyObj<UserService>('UserService', ['getAll', 'activate', 'deactivate', 'delete']);
    const authStub: Pick<AuthService, 'currentUser'> = { currentUser: signal<User | null>(ADMIN).asReadonly() };

    TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: authStub },
        // Without animations the menu and the dialog open/close synchronously.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(async () => {
    TestBed.inject(MatDialog).closeAll();
    await fixture.whenStable();
  });

  describe('table', () => {
    beforeEach(async () => {
      await setup();
    });

    it('should render the column headers in order', () => {
      const headers = Array.from(element.querySelectorAll('thead th')).map((th) => th.textContent?.trim());

      expect(headers).toEqual(['#', 'Username', 'Full Name', 'Email', 'Role', 'Permissions', 'Actions']);
    });

    it('should give the table an accessible name and column scopes', () => {
      expect(query('table caption').textContent?.trim()).toBe('Users');
      expect(Array.from(element.querySelectorAll('thead th')).every((th) => th.getAttribute('scope') === 'col')).toBe(
        true,
      );
    });

    it('should render one row per user', () => {
      expect(rows().length).toBe(3);
    });

    it('should number rows from 1 in display order instead of using ids', () => {
      expect(cellTexts('[data-testid="user-position"]')).toEqual(['1', '2', '3']);
    });

    it('should render the full name as first and last name', () => {
      expect(cellTexts('[data-testid="user-full-name"]')).toEqual(['Ada Admin', 'Alice Smith', 'Bob Brown']);
    });

    it('should render the roles', () => {
      expect(cellTexts('[data-testid="user-roles"]')).toEqual(['Admin', 'User', 'User']);
    });

    it('should render each permission as a list item', () => {
      const items = Array.from(rowOf('alice').querySelectorAll('[data-testid="user-permissions"] li')).map((li) =>
        li.textContent?.trim(),
      );

      expect(items).toEqual(['products:read', 'products:create']);
    });

    it('should render "None" when the user has no permissions', () => {
      expect(rowOf('bob').querySelector('[data-testid="user-permissions"]')).toBeNull();
      expect(rowOf('bob').textContent).toContain('None');
    });

    it('should mark only deactivated users as inactive', () => {
      expect(rowOf('bob').querySelector('[data-testid="user-inactive"]')?.textContent?.trim()).toBe('Inactive');
      expect(rowOf('alice').querySelector('[data-testid="user-inactive"]')).toBeNull();
    });

    it('should show the "You" badge only on the current user\'s row', () => {
      expect(rowOf('admin').querySelector('.badge--self')?.textContent?.trim()).toBe('You');
      expect(rowOf('alice').querySelector('.badge--self')).toBeNull();
      expect(rowOf('bob').querySelector('.badge--self')).toBeNull();
    });

    it('should not show the action error initially', () => {
      expect(element.querySelector('[data-testid="users-action-error"]')).toBeNull();
    });
  });

  describe('loading states', () => {
    it('should show the loading state while users are being fetched', async () => {
      // A loading resource keeps the app unstable, so render without awaiting whenStable().
      const response = new Subject<User[]>();
      create(response);
      fixture.detectChanges();

      expect(query('[data-testid="users-loading"]').getAttribute('role')).toBe('status');
      expect(element.querySelector('table')).toBeNull();

      response.next([ALICE]);
      response.complete();
      await fixture.whenStable();

      expect(element.querySelector('[data-testid="users-loading"]')).toBeNull();
      expect(rows().length).toBe(1);
    });

    it('should show an error with a retry button when loading fails', async () => {
      await setup(throwError(() => new HttpErrorResponse({ status: 500 })));

      expect(query('[data-testid="users-error"]').getAttribute('role')).toBe('alert');
      expect(query('[data-testid="users-error"]').textContent).toContain('Failed to load users.');
      expect(element.querySelector('table')).toBeNull();
    });

    it('should reload users when Retry is clicked', async () => {
      await setup(throwError(() => new HttpErrorResponse({ status: 500 })));
      userService.getAll.and.returnValue(of([ALICE]));

      query<HTMLButtonElement>('[data-testid="users-error"] button').click();
      await fixture.whenStable();

      expect(userService.getAll).toHaveBeenCalledTimes(2);
      expect(rows().length).toBe(1);
    });

    it('should show the empty state when there are no users', async () => {
      await setup(of([]));

      expect(query('[data-testid="users-empty"]').textContent?.trim()).toBe('No users found.');
      expect(element.querySelector('table')).toBeNull();
    });
  });

  describe('actions menu', () => {
    beforeEach(async () => {
      await setup();
    });

    it('should label each actions button with the username', () => {
      const button = query<HTMLButtonElement>('[data-testid="user-actions"]', rowOf('alice'));

      expect(button.getAttribute('aria-label')).toBe('Actions for alice');
      expect(button.textContent?.trim()).toBe('more_vert');
    });

    it('should offer Deactivate and Delete for an active user', async () => {
      await openMenu('alice');

      expect(menuLabels()).toEqual(['Deactivate', 'Delete']);
    });

    it('should offer Activate and Delete for a deactivated user', async () => {
      await openMenu('bob');

      expect(menuLabels()).toEqual(['Activate', 'Delete']);
    });

    it('should disable actions for the current user\'s own row', async () => {
      const button = query<HTMLButtonElement>('[data-testid="user-actions"]', rowOf('admin'));

      expect(button.disabled || button.getAttribute('aria-disabled') === 'true').toBe(true);
      expect(button.getAttribute('aria-label')).toBe('Actions unavailable for your own account');
      expect(await loader.getAllHarnesses(MatMenuHarness)).toHaveSize(2);
    });
  });

  describe('activate', () => {
    beforeEach(async () => {
      await setup();
    });

    it('should activate without a confirmation dialog and update the row in place', async () => {
      userService.activate.and.returnValue(of(undefined));
      await openMenu('bob');

      await clickMenuItem('Activate');

      expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0);
      expect(userService.activate).toHaveBeenCalledOnceWith('u2');
      expect(rowOf('bob').querySelector('[data-testid="user-inactive"]')).toBeNull();
      expect(userService.getAll).toHaveBeenCalledTimes(1);
      await openMenu('bob');
      expect(menuLabels()).toEqual(['Deactivate', 'Delete']);
    });

    it('should announce the activation and reset the announcement when the next action starts', async () => {
      userService.activate.and.returnValue(of(undefined));
      await openMenu('bob');
      await clickMenuItem('Activate');
      expect(query('[data-testid="users-action-status"]').textContent?.trim()).toBe('User bob activated.');

      await openMenu('alice');
      await clickMenuItem('Delete');

      expect(query('[data-testid="users-action-status"]').textContent?.trim()).toBe('');
    });

    it('should mark the row as busy while the activation is pending', async () => {
      const response = new Subject<void>();
      userService.activate.and.returnValue(response);
      await openMenu('bob');

      await clickMenuItem('Activate');
      const button = query<HTMLButtonElement>('[data-testid="user-actions"]', rowOf('bob'));

      // Not natively disabled, so the trigger keeps focus after the menu closes.
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.getAttribute('aria-busy')).toBe('true');

      response.next();
      response.complete();
      await fixture.whenStable();

      expect(button.getAttribute('aria-busy')).toBe('false');
      expect(button.getAttribute('aria-disabled')).toBeNull();
    });

    it('should not send a second request when the action is triggered again for a pending row', async () => {
      userService.activate.and.returnValue(new Subject<void>());
      await openMenu('bob');
      const activateItem = Array.from(overlay().querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')).find(
        (el) => el.textContent?.includes('Activate'),
      );
      if (!activateItem) {
        throw new Error('Menu item "Activate" not found');
      }

      // A fast double click: both clicks land before change detection closes the menu.
      activateItem.click();
      activateItem.click();
      await fixture.whenStable();

      expect(userService.activate).toHaveBeenCalledOnceWith('u2');
    });

    it('should show a fallback message when activation fails without a server message', async () => {
      userService.activate.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      await openMenu('bob');

      await clickMenuItem('Activate');

      expect(query('[data-testid="users-action-error"]').textContent?.trim()).toBe('Failed to activate user bob.');
      expect(rowOf('bob').querySelector('[data-testid="user-inactive"]')).not.toBeNull();
    });
  });

  describe('deactivate', () => {
    beforeEach(async () => {
      await setup();
      await openMenu('alice');
      await clickMenuItem('Deactivate');
    });

    it('should ask for confirmation naming the user', () => {
      expect(dialogText()).toContain('Deactivate user');
      expect(dialogText()).toContain('alice');
      expect(userService.deactivate).not.toHaveBeenCalled();
    });

    it('should deactivate and update the row when confirmed', async () => {
      userService.deactivate.and.returnValue(of(undefined));

      await clickDialogButton('confirm-dialog-confirm');

      expect(userService.deactivate).toHaveBeenCalledOnceWith('u1');
      expect(rowOf('alice').querySelector('[data-testid="user-inactive"]')).not.toBeNull();
      expect(userService.getAll).toHaveBeenCalledTimes(1);
      await openMenu('alice');
      expect(menuLabels()).toEqual(['Activate', 'Delete']);
    });

    it('should not call the service when cancelled', async () => {
      await clickDialogButton('confirm-dialog-cancel');

      expect(userService.deactivate).not.toHaveBeenCalled();
      expect(rowOf('alice').querySelector('[data-testid="user-inactive"]')).toBeNull();
    });

    it('should return focus to the row actions trigger when cancelled', async () => {
      await clickDialogButton('confirm-dialog-cancel');

      expect(document.activeElement).toBe(triggerOf('alice'));
    });

    it('should return focus to the row actions trigger after a successful deactivation', async () => {
      userService.deactivate.and.returnValue(of(undefined));

      await clickDialogButton('confirm-dialog-confirm');

      expect(document.activeElement).toBe(triggerOf('alice'));
    });

    it('should block the row actions while the request is pending', async () => {
      const response = new Subject<void>();
      userService.deactivate.and.returnValue(response);

      await clickDialogButton('confirm-dialog-confirm');
      const button = query<HTMLButtonElement>('[data-testid="user-actions"]', rowOf('alice'));
      const menu = await loader.getHarness(MatMenuHarness.with({ selector: '[aria-label="Actions for alice"]' }));

      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(query('[data-testid="user-actions"]', rowOf('bob')).getAttribute('aria-busy')).toBe('false');

      await menu.open();
      expect(await menu.isOpen()).toBe(false);

      response.next();
      response.complete();
      await fixture.whenStable();

      expect(button.getAttribute('aria-busy')).toBe('false');
      expect(button.getAttribute('aria-disabled')).toBeNull();
    });

    it('should mark the row as busy while the confirmation dialog is open', () => {
      expect(query('[data-testid="user-actions"]', rowOf('alice')).getAttribute('aria-busy')).toBe('true');
    });

    it('should announce the result in the status live region', async () => {
      userService.deactivate.and.returnValue(of(undefined));

      await clickDialogButton('confirm-dialog-confirm');

      const status = query('[data-testid="users-action-status"]');
      expect(status.getAttribute('role')).toBe('status');
      expect(status.textContent?.trim()).toBe('User alice deactivated.');
    });

    it('should show the server message when the backend rejects the action', async () => {
      userService.deactivate.and.returnValue(
        throwError(
          () => new HttpErrorResponse({ status: 400, error: { message: 'Cannot deactivate the last active admin.' } }),
        ),
      );

      await clickDialogButton('confirm-dialog-confirm');
      const alert = query('[data-testid="users-action-error"]');

      expect(alert.getAttribute('role')).toBe('alert');
      expect(alert.textContent?.trim()).toBe('Cannot deactivate the last active admin.');
      expect(rowOf('alice').querySelector('[data-testid="user-inactive"]')).toBeNull();
      expect(query('[data-testid="user-actions"]', rowOf('alice')).getAttribute('aria-busy')).toBe('false');
      expect(query('[data-testid="users-action-status"]').textContent?.trim()).toBe('');
    });

    it('should show a fallback message when the error has no server message', async () => {
      userService.deactivate.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

      await clickDialogButton('confirm-dialog-confirm');

      expect(query('[data-testid="users-action-error"]').textContent?.trim()).toBe('Failed to deactivate user alice.');
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await setup();
      await openMenu('alice');
      await clickMenuItem('Delete');
    });

    it('should ask for confirmation naming the user', () => {
      expect(dialogText()).toContain('Delete user alice? This cannot be undone.');
      expect(userService.delete).not.toHaveBeenCalled();
    });

    it('should delete and remove the row when confirmed', async () => {
      userService.delete.and.returnValue(of(undefined));

      await clickDialogButton('confirm-dialog-confirm');

      expect(userService.delete).toHaveBeenCalledOnceWith('u1');
      expect(rows().length).toBe(2);
      expect(cellTexts('[data-testid="user-position"]')).toEqual(['1', '2']);
      expect(element.textContent).not.toContain('alice@example.com');
      expect(userService.getAll).toHaveBeenCalledTimes(1);
    });

    it('should not call the service when cancelled', async () => {
      await clickDialogButton('confirm-dialog-cancel');

      expect(userService.delete).not.toHaveBeenCalled();
      expect(rows().length).toBe(3);
    });

    it('should allow only one flow per row and release the row after cancel', async () => {
      // Bypasses the UI on purpose: the trigger cannot open the menu while the row is busy.
      fixture.componentInstance['delete'](ALICE);
      await fixture.whenStable();

      expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);

      await clickDialogButton('confirm-dialog-cancel');

      expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0);
      expect(query('[data-testid="user-actions"]', rowOf('alice')).getAttribute('aria-busy')).toBe('false');
      expect(userService.delete).not.toHaveBeenCalled();
    });

    it('should move focus to the page heading after a successful delete', async () => {
      userService.delete.and.returnValue(of(undefined));

      await clickDialogButton('confirm-dialog-confirm');

      expect(document.activeElement).toBe(query('h1'));
    });

    it('should announce the deletion in the status live region', async () => {
      userService.delete.and.returnValue(of(undefined));

      await clickDialogButton('confirm-dialog-confirm');

      expect(query('[data-testid="users-action-status"]').textContent?.trim()).toBe('User alice deleted.');
    });

    it('should show the server error and keep the row when deletion fails', async () => {
      userService.delete.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'User not found.' } })),
      );

      await clickDialogButton('confirm-dialog-confirm');

      expect(query('[data-testid="users-action-error"]').textContent?.trim()).toBe('User not found.');
      expect(rows().length).toBe(3);
    });

    it('should return focus to the row actions trigger when deletion fails', async () => {
      userService.delete.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400 })));

      await clickDialogButton('confirm-dialog-confirm');

      expect(document.activeElement).toBe(triggerOf('alice'));
    });

    it('should clear the previous error when the next action starts', async () => {
      userService.delete.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      await clickDialogButton('confirm-dialog-confirm');
      expect(element.querySelector('[data-testid="users-action-error"]')).not.toBeNull();
      userService.activate.and.returnValue(of(undefined));

      await openMenu('bob');
      await clickMenuItem('Activate');

      expect(element.querySelector('[data-testid="users-action-error"]')).toBeNull();
    });
  });
});
