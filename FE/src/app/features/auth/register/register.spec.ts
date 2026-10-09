import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { Register } from './register';
import { AuthService } from '@features/services/auth.service';
import { LoginResponse } from '@features/models/auth';
import { RegisterResponse } from '@features/models/user';

describe('Register', () => {
  const mockRegisterResponse: RegisterResponse = {
    id: 'user-1',
    username: 'john_doe',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    createdAtUtc: '2026-10-09T00:00:00Z',
  };

  const mockLoginResponse: LoginResponse = {
    accessToken: 'test-token-123',
    tokenType: 'Bearer',
    expiresAtUtc: '2026-10-09T00:00:00Z',
  };

  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;
  let fixture: ComponentFixture<Register>;
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

  function fillValidForm(): void {
    typeInField('#username', 'john_doe');
    typeInField('#email', 'john@example.com');
    typeInField('#firstName', 'John');
    typeInField('#lastName', 'Doe');
    typeInField('#password', 'Password1');
    typeInField('#confirmPassword', 'Password1');
  }

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'register',
      'login',
      'isAuthenticated',
    ]);

    TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(Register);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  describe('Form Rendering', () => {
    it('should render the registration heading', () => {
      const heading = query<HTMLHeadingElement>('h1');
      expect(heading.textContent?.trim()).toBe('Register');
    });

    it('should render all form fields', () => {
      expect(query<HTMLInputElement>('#username')).not.toBeNull();
      expect(query<HTMLInputElement>('#email')).not.toBeNull();
      expect(query<HTMLInputElement>('#firstName')).not.toBeNull();
      expect(query<HTMLInputElement>('#lastName')).not.toBeNull();
      expect(query<HTMLInputElement>('#password').type).toBe('password');
      expect(query<HTMLInputElement>('#confirmPassword').type).toBe('password');
    });

    it('should render a link to the login page', () => {
      const link = query<HTMLAnchorElement>('a[routerLink="/login"]');
      expect(link.textContent?.trim()).toBe('Log in');
    });
  });

  describe('Form Validation', () => {
    it('should show required errors for empty fields when touched', async () => {
      typeInField('#username', '');
      typeInField('#email', '');
      typeInField('#firstName', '');
      typeInField('#lastName', '');
      typeInField('#password', '');
      typeInField('#confirmPassword', '');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(queryAll('#username-error').length).toBe(1);
      expect(queryAll('#email-error').length).toBe(1);
      expect(queryAll('#firstName-error').length).toBe(1);
      expect(queryAll('#lastName-error').length).toBe(1);
      expect(queryAll('#password-error').length).toBe(1);
      expect(queryAll('#confirmPassword-error').length).toBe(1);
    });

    it('should show an email format error for an invalid email', async () => {
      typeInField('#email', 'not-an-email');
      fixture.detectChanges();
      await fixture.whenStable();

      const error = query<HTMLElement>('#email-error');
      expect(error.textContent?.trim()).toBe('Enter a valid email address');
    });

    it('should show a minlength error when password is shorter than 8 characters', async () => {
      typeInField('#password', 'short1');
      fixture.detectChanges();
      await fixture.whenStable();

      const error = query<HTMLElement>('#password-error');
      expect(error.textContent?.trim()).toBe('Password must be at least 8 characters long');
    });

    it('should show a mismatch error when confirmPassword differs from password', async () => {
      typeInField('#password', 'Password1');
      typeInField('#confirmPassword', 'Different1');
      fixture.detectChanges();
      await fixture.whenStable();

      const error = query<HTMLElement>('#confirmPassword-error');
      expect(error.textContent?.trim()).toBe('Passwords do not match');
    });

    it('should not show a mismatch error when passwords match', async () => {
      typeInField('#password', 'Password1');
      typeInField('#confirmPassword', 'Password1');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(queryAll('#confirmPassword-error').length).toBe(0);
    });

    it('should not submit when form is invalid', async () => {
      typeInField('#username', 'john_doe');

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(authService.register).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('should disable the submit button while the request is pending', async () => {
      const registerSubject = new Subject<RegisterResponse>();
      authService.register.and.returnValue(registerSubject);

      fillValidForm();
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();

      const submitButton = query<HTMLButtonElement>('button[type="submit"]');
      expect(submitButton.disabled).toBe(true);
      expect(fixture.componentInstance.isLoading()).toBe(true);

      registerSubject.next(mockRegisterResponse);
      registerSubject.complete();
      await fixture.whenStable();
    });

    it('should call register with the form values', async () => {
      authService.register.and.returnValue(of(mockRegisterResponse));
      authService.login.and.returnValue(of(mockLoginResponse));

      fillValidForm();
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(authService.register).toHaveBeenCalledWith({
        username: 'john_doe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Password1',
      });
    });
  });

  describe('Successful Registration', () => {
    it('should auto-login and navigate to /products on success', async () => {
      authService.register.and.returnValue(of(mockRegisterResponse));
      authService.login.and.returnValue(of(mockLoginResponse));

      fillValidForm();
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(authService.login).toHaveBeenCalledWith('john_doe', 'Password1');
      expect(router.navigate).toHaveBeenCalledWith(['/products']);
    });

    it('should show a message and login link when auto-login fails after registration', async () => {
      authService.register.and.returnValue(of(mockRegisterResponse));
      authService.login.and.returnValue(throwError(() => new Error('login failed')));

      fillValidForm();
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const errorBanner = query<HTMLElement>('.error-banner');
      expect(errorBanner.textContent).toContain(
        'Registration succeeded, but automatic sign-in failed',
      );
      expect(query<HTMLAnchorElement>('.error-banner__link').getAttribute('routerLink')).toBe(
        '/login',
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Registration Errors', () => {
    it('should show the server message on a 409 duplicate error', async () => {
      const errorResponse = { error: { message: 'Username is already taken' } };
      authService.register.and.returnValue(throwError(() => errorResponse));

      fillValidForm();
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const errorBanner = query<HTMLElement>('.error-banner');
      expect(errorBanner.textContent?.trim()).toBe('Username is already taken');
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should show the server message on a 400 validation error', async () => {
      const errorResponse = { error: { message: 'Password is too weak' } };
      authService.register.and.returnValue(throwError(() => errorResponse));

      fillValidForm();
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const errorBanner = query<HTMLElement>('.error-banner');
      expect(errorBanner.textContent?.trim()).toBe('Password is too weak');
    });

    it('should show a default error message when the server does not provide one', async () => {
      authService.register.and.returnValue(throwError(() => new Error('Network error')));

      fillValidForm();
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const errorBanner = query<HTMLElement>('.error-banner');
      expect(errorBanner.textContent).toContain('Registration failed');
    });

    it('should clear the error message when the form becomes valid again', async () => {
      const errorResponse = { error: { message: 'Username is already taken' } };
      authService.register.and.returnValue(throwError(() => errorResponse));

      fillValidForm();
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(queryAll('.error-banner').length).toBe(1);

      typeInField('#username', 'jane_doe');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(queryAll('.error-banner').length).toBe(0);
    });
  });
});
