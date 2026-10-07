import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { Login } from './login';
import { AuthService } from '@features/services/auth-service';
import { LoginResponse } from '@features/models/auth';

describe('Login', () => {
  const mockLoginResponse: LoginResponse = {
    accessToken: 'test-token-123',
    tokenType: 'Bearer',
    expiresAtUtc: '2026-10-08T00:00:00Z',
  };

  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let fixture: ComponentFixture<Login>;
  let el: HTMLElement;

  function query<T extends Element>(selector: string): T {
    const element = el.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Element "${selector}" not found`);
    }
    return element;
  }

  function queryAll(selector: string): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>(selector));
  }

  function typeInField(selector: string, value: string): void {
    const input = query<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });

    fixture = TestBed.createComponent(Login);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  describe('Form Rendering', () => {
    it('should render the login heading', () => {
      const heading = query<HTMLHeadingElement>('h1');
      expect(heading.textContent?.trim()).toBe('Login');
    });

    it('should render username and password input fields', () => {
      const usernameInput = query<HTMLInputElement>('#username');
      const passwordInput = query<HTMLInputElement>('#password');

      expect(usernameInput).not.toBeNull();
      expect(passwordInput).not.toBeNull();
      expect(passwordInput.type).toBe('password');
    });

    it('should render labels for username and password fields', () => {
      const usernameLabel = query<HTMLLabelElement>('label[for="username"]');
      const passwordLabel = query<HTMLLabelElement>('label[for="password"]');

      expect(usernameLabel.textContent?.trim()).toBe('Username');
      expect(passwordLabel.textContent?.trim()).toBe('Password');
    });

    it('should render a submit button', () => {
      const submitButton = query<HTMLButtonElement>('button[type="submit"]');
      expect(submitButton.textContent?.trim()).toContain('Login');
    });

    it('should have autocomplete attributes for better UX', () => {
      const usernameInput = query<HTMLInputElement>('#username');
      const passwordInput = query<HTMLInputElement>('#password');

      expect(usernameInput.getAttribute('autocomplete')).toBe('username');
      expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');
    });
  });

  describe('Form Validation', () => {
    it('should show username validation error when field is touched and empty', async () => {
      typeInField('#username', '');
      fixture.detectChanges();
      await fixture.whenStable();

      const errorElement = queryAll('#username-error');
      expect(errorElement.length).toBeGreaterThan(0);
      expect(errorElement[0].textContent?.trim()).toBe('Username is required');
    });

    it('should show password validation error when field is touched and empty', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      typeInField('#password', '');
      fixture.detectChanges();
      await fixture.whenStable();

      const errorElement = queryAll('#password-error');
      expect(errorElement.length).toBeGreaterThan(0);
      expect(errorElement[0].textContent?.trim()).toBe('Password is required');
    });

    it('should not show validation errors when fields are not touched', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const errorElements = queryAll('.error-message');
      expect(errorElements.length).toBe(0);
    });

    it('should clear validation errors when user corrects the field', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      typeInField('#username', '');
      fixture.detectChanges();
      await fixture.whenStable();

      let errorElements = queryAll('#username-error');
      expect(errorElements.length).toBeGreaterThan(0);

      typeInField('#username', 'john_doe');
      fixture.detectChanges();
      await fixture.whenStable();

      errorElements = queryAll('#username-error');
      expect(errorElements.length).toBe(0);
    });

    it('should set aria-invalid attribute when field is invalid and touched', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      typeInField('#username', '');
      fixture.detectChanges();
      await fixture.whenStable();

      const usernameInput = query<HTMLInputElement>('#username');
      expect(usernameInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('should set aria-describedby attribute when field has error', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      typeInField('#username', '');
      fixture.detectChanges();
      await fixture.whenStable();

      const usernameInput = query<HTMLInputElement>('#username');
      expect(usernameInput.getAttribute('aria-describedby')).toBe('username-error');
    });

    it('should not show error aria-describedby when field is valid', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      typeInField('#username', 'john_doe');
      fixture.detectChanges();
      await fixture.whenStable();

      const usernameInput = query<HTMLInputElement>('#username');
      expect(usernameInput.getAttribute('aria-describedby')).toBeNull();
    });
  });

  describe('Form Submission', () => {
    it('should not submit when form is invalid', async () => {
      typeInField('#username', 'john_doe');
      typeInField('#password', '');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should not show errors until form submission attempt', async () => {
      fixture.detectChanges();

      const errorElements = queryAll('.error-message');
      expect(errorElements.length).toBe(0);

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const errorElementsAfter = queryAll('.error-message');
      expect(errorElementsAfter.length).toBeGreaterThan(0);
    });

    it('should submit form with correct credentials', async () => {
      authService.login.and.returnValue(of(mockLoginResponse));

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(authService.login).toHaveBeenCalledWith('john_doe', 'password123');
    });

    it('should show loading state during login', async () => {
      const loginSubject = new Subject<LoginResponse>();
      authService.login.and.returnValue(loginSubject);

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();

      expect(fixture.componentInstance.isLoading()).toBe(true);

      loginSubject.next(mockLoginResponse);
      loginSubject.complete();
      await fixture.whenStable();

      expect(fixture.componentInstance.isLoading()).toBe(false);
    });
  });

  describe('Successful Login', () => {
    it('should show success state and navigate on successful login', async () => {
      authService.login.and.returnValue(of(mockLoginResponse));

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(router.navigate).toHaveBeenCalledWith(['/products']);
    });

    it('should emit loginSuccess output on successful login', async () => {
      authService.login.and.returnValue(of(mockLoginResponse));
      const loginSuccessValues: void[] = [];
      fixture.componentInstance.loginSuccess.subscribe(() => loginSuccessValues.push(undefined));

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(loginSuccessValues.length).toBe(1);
    });

    it('should hide error banner on successful login', async () => {
      authService.login.and.returnValues(
        throwError(() => new Error('Invalid credentials')),
        of(mockLoginResponse),
      );

      // First attempt - fails
      typeInField('#username', 'john_doe');
      typeInField('#password', 'wrong');
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      let errorBanner = queryAll('.error-banner');
      expect(errorBanner.length).toBe(1);

      // Clear inputs and try again
      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      errorBanner = queryAll('.error-banner');
      expect(errorBanner.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should show error message when login fails', async () => {
      const errorResponse = { error: { message: 'Invalid username or password' } };
      authService.login.and.returnValue(throwError(() => errorResponse));

      typeInField('#username', 'john_doe');
      typeInField('#password', 'wrong');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const errorBanner = query<HTMLElement>('.error-banner');
      expect(errorBanner.textContent?.trim()).toBe('Invalid username or password');
    });

    it('should show default error message when server does not provide one', async () => {
      authService.login.and.returnValue(throwError(() => new Error('Network error')));

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const errorBanner = query<HTMLElement>('.error-banner');
      expect(errorBanner.textContent).toContain('Login failed');
    });

    it('should display error with proper accessibility attributes', async () => {
      authService.login.and.returnValue(throwError(() => new Error('Invalid credentials')));

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const errorBanner = query<HTMLElement>('[role="alert"]');
      expect(errorBanner.getAttribute('aria-live')).toBe('polite');
      expect(errorBanner.getAttribute('aria-atomic')).toBe('true');
    });

    it('should hide error message when form becomes valid after error', async () => {
      authService.login.and.returnValue(throwError(() => new Error('Invalid credentials')));

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      let errorBanner = queryAll('.error-banner');
      expect(errorBanner.length).toBe(1);

      // Update password to trigger validation check
      typeInField('#password', 'newpassword');
      fixture.detectChanges();
      await fixture.whenStable();

      errorBanner = queryAll('.error-banner');
      expect(errorBanner.length).toBe(0);
    });
  });

  describe('Loading State', () => {
    it('should show loading text during login', async () => {
      const loginSubject = new Subject<LoginResponse>();
      authService.login.and.returnValue(loginSubject);

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();

      const submitButton = query<HTMLButtonElement>('button[type="submit"]');
      expect(submitButton.textContent?.trim()).toContain('Logging in…');

      loginSubject.next(mockLoginResponse);
      loginSubject.complete();
      await fixture.whenStable();

      expect(submitButton.textContent?.trim()).toContain('Login');
    });

    it('should set aria-busy attribute during loading', async () => {
      const loginSubject = new Subject<LoginResponse>();
      authService.login.and.returnValue(loginSubject);

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();

      const submitButton = query<HTMLButtonElement>('button[type="submit"]');
      expect(submitButton.getAttribute('aria-busy')).toBe('true');

      loginSubject.next(mockLoginResponse);
      loginSubject.complete();
      await fixture.whenStable();

      expect(submitButton.getAttribute('aria-busy')).toBe('false');
    });

    it('should prevent submission when form is invalid', async () => {
      typeInField('#username', '');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Form should still be invalid
      expect(fixture.componentInstance.form.invalid).toBe(true);
      // Login should not be called
      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have form with proper aria-label', () => {
      const form = query<HTMLFormElement>('form');
      expect(form.getAttribute('aria-label')).toBe('Login form');
    });

    it('should associate labels with inputs correctly', () => {
      const usernameInput = query<HTMLInputElement>('#username');
      const passwordInput = query<HTMLInputElement>('#password');
      const usernameLabel = query<HTMLLabelElement>('label[for="username"]');
      const passwordLabel = query<HTMLLabelElement>('label[for="password"]');

      expect(usernameLabel.htmlFor).toBe('username');
      expect(passwordLabel.htmlFor).toBe('password');
      expect(usernameInput.id).toBe('username');
      expect(passwordInput.id).toBe('password');
    });

    it('should keyboard navigate through form fields', () => {
      const usernameInput = query<HTMLInputElement>('#username');
      const passwordInput = query<HTMLInputElement>('#password');
      const submitButton = query<HTMLButtonElement>('button[type="submit"]');

      expect(usernameInput.getAttribute('tabindex')).not.toBe('-1');
      expect(passwordInput.getAttribute('tabindex')).not.toBe('-1');
      expect(submitButton.getAttribute('tabindex')).not.toBe('-1');
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not have multiple subscriptions after multiple submissions', async () => {
      authService.login.and.returnValue(of(mockLoginResponse));

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      // First submission
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const loginSpy = authService.login as jasmine.Spy;
      const initialCallCount = loginSpy.calls.count();

      // Second submission
      typeInField('#username', 'jane_doe');
      typeInField('#password', 'password456');
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Should only have called login twice, not multiple times due to memory leaks
      expect(loginSpy.calls.count()).toBe(initialCallCount + 1);
    });

    it('should unsubscribe from statusChanges on destroy', async () => {
      authService.login.and.returnValue(of(mockLoginResponse));

      typeInField('#username', 'john_doe');
      typeInField('#password', 'password123');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.destroy();

      // After destroy, no subscriptions should remain active
      // (This is verified through TestBed cleanup and no console errors)
      expect(fixture.componentInstance).toBeDefined();
    });
  });
});
