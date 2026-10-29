import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@features/services/auth.service';
import { HasPermission } from './has-permission.directive';

class FakeAuthService {
  readonly permissions = signal<string[]>([]);

  hasPermission(permission: string): boolean {
    const granted = this.permissions();
    if (granted.includes('*')) {
      return true;
    }

    const [resource] = permission.split(':');
    return granted.includes(permission) || granted.includes(`${resource}:*`);
  }
}

@Component({
  imports: [HasPermission],
  template: `<button *appHasPermission="permission()">Action</button>`,
})
class TestHostComponent {
  readonly permission = signal('products:create');
}

describe('HasPermission', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let authService: FakeAuthService;

  function button(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button');
  }

  beforeEach(async () => {
    authService = new FakeAuthService();

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should hide the content when the user has no matching permission', () => {
    expect(button()).toBeNull();
  });

  it('should show the content when the user has the exact permission', async () => {
    authService.permissions.set(['products:create']);
    await fixture.whenStable();

    expect(button()).not.toBeNull();
  });

  it('should show the content when the user has the global wildcard permission', async () => {
    authService.permissions.set(['*']);
    await fixture.whenStable();

    expect(button()).not.toBeNull();
  });

  it('should show the content when the user has a resource-level wildcard permission', async () => {
    authService.permissions.set(['products:*']);
    await fixture.whenStable();

    expect(button()).not.toBeNull();
  });

  it('should hide the content again when the permission is revoked after being granted', async () => {
    authService.permissions.set(['products:create']);
    await fixture.whenStable();
    expect(button()).not.toBeNull();

    authService.permissions.set([]);
    await fixture.whenStable();

    expect(button()).toBeNull();
  });

  it('should react to the permission input changing', async () => {
    authService.permissions.set(['orders:view']);
    await fixture.whenStable();
    expect(button()).toBeNull();

    fixture.componentInstance.permission.set('orders:view');
    await fixture.whenStable();

    expect(button()).not.toBeNull();
  });
});
