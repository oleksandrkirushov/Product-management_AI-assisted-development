import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '@features/services/auth.service';

describe('ForgotPasswordComponent', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let el: HTMLElement;

  function query<T extends Element>(selector: string): T {
    const element = el.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Element "${selector}" not found`);
    }
    return element;
  }

  function typeInField(selector: string, value: string): void {
    const input = query<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  async function submit(): Promise<void> {
    query<HTMLButtonElement>('button[type="submit"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['forgotPassword']);

    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    });

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should render the email field and a link back to login', () => {
    expect(query<HTMLInputElement>('#email').type).toBe('email');
    expect(query<HTMLAnchorElement>('a[href="/login"]').textContent?.trim()).toBe('Back to login');
  });

  it('should show an email format error and not submit when the email is invalid', async () => {
    typeInField('#email', 'not-an-email');

    await submit();

    expect(query<HTMLElement>('#email-error').textContent?.trim()).toBe('Enter a valid email address');
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });

  it('should hide the form and show the neutral message when the request succeeds', async () => {
    authService.forgotPassword.and.returnValue(of(undefined));
    typeInField('#email', 'user@example.com');

    await submit();

    expect(authService.forgotPassword).toHaveBeenCalledWith('user@example.com');
    expect(el.querySelector('form')).toBeNull();
    expect(query<HTMLElement>('[role="status"]').textContent?.trim()).toBe(
      "If an account with this email exists, we've sent a password reset link.",
    );
  });

  it('should move focus to the neutral message when the request succeeds', async () => {
    authService.forgotPassword.and.returnValue(of(undefined));
    typeInField('#email', 'user@example.com');

    await submit();

    const panel = query<HTMLElement>('.info-panel');
    expect(panel.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(panel);
  });

  it('should not move focus to a message when the request fails', async () => {
    authService.forgotPassword.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const button = query<HTMLButtonElement>('button[type="submit"]');
    typeInField('#email', 'user@example.com');
    button.focus();

    await submit();

    expect(document.activeElement).toBe(button);
  });

  it('should show an error banner and keep the form when the request is rate limited', async () => {
    authService.forgotPassword.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' })),
    );
    typeInField('#email', 'user@example.com');

    await submit();

    expect(query<HTMLElement>('.error-banner').textContent).toContain('Too many requests');
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('should show a generic error banner on a network error', async () => {
    authService.forgotPassword.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' })),
    );
    typeInField('#email', 'user@example.com');

    await submit();

    expect(query<HTMLElement>('.error-banner').textContent).toContain('Something went wrong');
  });
  it('should not show validation errors before the field is touched', () => {
    expect(el.querySelector('#email-error')).toBeNull();
    expect(query<HTMLInputElement>('#email').getAttribute('aria-describedby')).toBeNull();
  });

  it('should mark the field as touched and show a required error when submitting an empty form', async () => {
    await submit();

    const input = query<HTMLInputElement>('#email');
    expect(query<HTMLElement>('#email-error').textContent?.trim()).toBe('Email is required');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('email-error');
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });

  it('should clear the error and aria attributes once a valid email is entered', async () => {
    typeInField('#email', 'not-an-email');
    fixture.detectChanges();
    await fixture.whenStable();

    typeInField('#email', 'user@example.com');
    fixture.detectChanges();
    await fixture.whenStable();

    const input = query<HTMLInputElement>('#email');
    expect(el.querySelector('#email-error')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  describe('Loading state', () => {
    let response: Subject<void>;

    beforeEach(() => {
      response = new Subject<void>();
      authService.forgotPassword.and.returnValue(response);
      typeInField('#email', 'user@example.com');
    });

    it('should disable the button, set aria-busy and show the sending label while the request is pending', async () => {
      await submit();

      const button = query<HTMLButtonElement>('button[type="submit"]');
      expect(button.disabled).toBeTrue();
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.textContent?.trim()).toBe('Sending…');
    });

    it('should not send a second request when the button is clicked again while loading', async () => {
      await submit();

      await submit();

      expect(authService.forgotPassword).toHaveBeenCalledTimes(1);
    });

    it('should restore the button after the request fails', async () => {
      await submit();

      response.error(new HttpErrorResponse({ status: 500 }));
      fixture.detectChanges();
      await fixture.whenStable();

      const button = query<HTMLButtonElement>('button[type="submit"]');
      expect(button.disabled).toBeFalse();
      expect(button.getAttribute('aria-busy')).toBe('false');
      expect(button.textContent?.trim()).toBe('Send reset link');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      typeInField('#email', 'user@example.com');
    });

    it('should show the server message and keep the form on 400', async () => {
      authService.forgotPassword.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Email is invalid.' } })),
      );

      await submit();

      const banner = query<HTMLElement>('.error-banner');
      expect(banner.textContent?.trim()).toBe('Email is invalid.');
      expect(banner.getAttribute('role')).toBe('alert');
      expect(el.querySelector('form')).not.toBeNull();
      expect(el.querySelector('.info-panel')).toBeNull();
    });

    it('should show the exact rate limit message on 429 even when the server sends a message', async () => {
      authService.forgotPassword.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 429, error: { message: 'Rate limited' } })),
      );

      await submit();

      expect(query<HTMLElement>('.error-banner').textContent?.trim()).toBe(
        'Too many requests. Please wait a minute and try again.',
      );
    });

    it('should show a generic message on a server error without a message', async () => {
      authService.forgotPassword.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      await submit();

      expect(query<HTMLElement>('.error-banner').textContent?.trim()).toBe(
        'Something went wrong. Please try again later.',
      );
      expect(el.querySelector('form')).not.toBeNull();
    });

    it('should show a generic message when the error is not an HTTP error', async () => {
      authService.forgotPassword.and.returnValue(throwError(() => new Error('boom')));

      await submit();

      expect(query<HTMLElement>('.error-banner').textContent?.trim()).toBe(
        'Something went wrong. Please try again later.',
      );
    });

    it('should hide the error banner and show the neutral message when a retry succeeds', async () => {
      authService.forgotPassword.and.returnValues(
        throwError(() => new HttpErrorResponse({ status: 0 })),
        of(undefined),
      );
      await submit();
      expect(el.querySelector('.error-banner')).not.toBeNull();

      await submit();

      expect(el.querySelector('.error-banner')).toBeNull();
      expect(el.querySelector('form')).toBeNull();
      expect(query<HTMLElement>('.info-panel').getAttribute('role')).toBe('status');
    });
  });
});
