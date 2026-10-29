import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AdminLayout } from './admin-layout';

@Component({ template: '<h1 class="dummy-users">Users page</h1>' })
class DummyUsersPage {}

@Component({ template: '<h1 class="dummy-other">Other page</h1>' })
class DummyOtherPage {}

describe('AdminLayout', () => {
  let harness: RouterTestingHarness;

  function host(): HTMLElement {
    const element = harness.routeNativeElement;
    if (!element) {
      throw new Error('Routed component is not rendered');
    }
    return element;
  }

  function query<T extends Element>(selector: string): T {
    const element = host().querySelector<T>(selector);
    if (!element) {
      throw new Error(`Element "${selector}" not found`);
    }
    return element;
  }

  /**
   * RouterLinkActive оновлює стан у microtask після навігації й лише тоді викликає markForCheck,
   * тому після навігації чекаємо ще один цикл стабілізації.
   */
  async function navigate(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
  }

  function usersLink(): HTMLAnchorElement {
    return query<HTMLAnchorElement>('nav a[href="/admin/users"]');
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'admin',
            component: AdminLayout,
            children: [
              { path: 'users', component: DummyUsersPage },
              { path: 'other', component: DummyOtherPage },
            ],
          },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  it('should render the Users nav item linking to /admin/users inside a labelled nav', async () => {
    await navigate('/admin/other');

    const nav = query<HTMLElement>('nav');
    const link = usersLink();

    expect(nav.getAttribute('aria-label')).toBe('Admin sections');
    expect(link.textContent).toContain('Users');
    expect(link.getAttribute('href')).toBe('/admin/users');
  });

  it('should render the configured icon next to the title of the Users nav item', async () => {
    await navigate('/admin/other');

    const icon = usersLink().querySelector<HTMLElement>('mat-icon[matListItemIcon]');

    expect(icon).not.toBeNull();
    expect(icon?.textContent?.trim()).toBe('group');
    expect(usersLink().querySelector('[matListItemTitle]')?.textContent?.trim()).toBe('Users');
  });

  it('should highlight the Users item and set aria-current when /admin/users is active', async () => {
    await navigate('/admin/users');

    const link = usersLink();

    expect(link.classList).toContain('mdc-list-item--activated');
    expect(link.getAttribute('aria-current')).toBe('page');
  });

  it('should not highlight the Users item when another admin page is active', async () => {
    await navigate('/admin/other');

    const link = usersLink();

    expect(link.classList).not.toContain('mdc-list-item--activated');
    expect(link.hasAttribute('aria-current')).toBeFalse();
  });

  it('should render the active child route inside the sidenav content', async () => {
    await navigate('/admin/users');

    const content = query<HTMLElement>('mat-sidenav-content');

    expect(content.querySelector('.dummy-users')?.textContent).toBe('Users page');
  });

  it('should navigate to /admin/users and highlight the item when the link is clicked', async () => {
    await navigate('/admin/other');

    usersLink().click();
    await harness.fixture.whenStable();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/admin/users');
    expect(usersLink().getAttribute('aria-current')).toBe('page');
    expect(usersLink().classList).toContain('mdc-list-item--activated');
    expect(query<HTMLElement>('mat-sidenav-content .dummy-users')).toBeTruthy();
  });

  it('should keep the sidenav opened in side mode', async () => {
    await navigate('/admin/users');

    const sidenav = query<HTMLElement>('mat-sidenav');

    expect(sidenav.classList).toContain('mat-drawer-side');
    expect(sidenav.classList).toContain('mat-drawer-opened');
  });
});
