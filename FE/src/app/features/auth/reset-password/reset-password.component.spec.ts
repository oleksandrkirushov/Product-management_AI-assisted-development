import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, filter, firstValueFrom, of, throwError } from 'rxjs';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '@features/services/auth.service';

describe('ResetPasswordComponent', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;
  let harness: RouterTestingHarness;
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

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, ResetPasswordComponent);
    const root = harness.routeNativeElement;
    if (!root) {
      throw new Error('Route element not rendered');
    }
    el = root;
  }

  async function submit(): Promise<void> {
    query<HTMLButtonElement>('button[type="submit"]').click();
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  function submitButton(): HTMLButtonElement {
    return query<HTMLButtonElement>('button[type="submit"]');
  }

  function httpError(status: number, error: unknown = null): HttpErrorResponse {
    return new HttpErrorResponse({ status, error });
  }

  async function fillValidForm(): Promise<void> {
    typeInField('#newPassword', 'Password1');
    typeInField('#confirmPassword', 'Password1');
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['resetPassword']);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'reset-password', component: ResetPasswordComponent }]),
        { provide: AuthService, useValue: authService },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('should show the invalid link message with a link to forgot-password when the token is missing', async () => {
    await open('/reset-password');

    expect(el.querySelector('form')).toBeNull();
    expect(query<HTMLAnchorElement>('a[href="/forgot-password"]').textContent?.trim()).toBe('Request a new link');
  });

  it('should show a mismatch error and not submit when the passwords differ', async () => {
    await open('/reset-password?token=abc');
    typeInField('#newPassword', 'Password1');
    typeInField('#confirmPassword', 'Password2');

    await submit();

    expect(query<HTMLElement>('#confirmPassword-error').textContent?.trim()).toBe('Passwords do not match');
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('should reset the password and navigate to login with reset=success', async () => {
    authService.resetPassword.and.returnValue(of(undefined));
    await open('/reset-password?token=abc');
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    typeInField('#newPassword', 'Password1');
    typeInField('#confirmPassword', 'Password1');

    await submit();

    expect(authService.resetPassword).toHaveBeenCalledWith('abc', 'Password1');
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reset: 'success' } });
  });

  it('should show the server message and a request-new-link link on 400', async () => {
    authService.resetPassword.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'Reset link is invalid or has expired.' },
          }),
      ),
    );
    await open('/reset-password?token=abc');
    typeInField('#newPassword', 'Password1');
    typeInField('#confirmPassword', 'Password1');

    await submit();

    const banner = query<HTMLElement>('.error-banner');
    expect(banner.textContent).toContain('Reset link is invalid or has expired.');
    expect(query<HTMLAnchorElement>('.error-banner a[href="/forgot-password"]')).toBeTruthy();
  });
  describe('Token from the query string', () => {
    it('should show the invalid link message when the token is empty', async () => {
      await open('/reset-password?token=');

      expect(el.querySelector('form')).toBeNull();
      expect(query<HTMLElement>('.info-panel').getAttribute('role')).toBe('alert');
      expect(query<HTMLElement>('.info-panel').textContent).toContain('This password reset link is invalid or incomplete.');
    });

    it('should show the invalid link message when the token is only whitespace', async () => {
      await open('/reset-password?token=%20%20');

      expect(el.querySelector('form')).toBeNull();
      expect(el.querySelector('.info-panel')).not.toBeNull();
    });

    it('should render the form and a back-to-login link when a token is present', async () => {
      await open('/reset-password?token=abc');

      expect(query<HTMLFormElement>('form').getAttribute('aria-label')).toBe('Reset password form');
      expect(el.querySelector('.info-panel')).toBeNull();
      expect(query<HTMLAnchorElement>('a[href="/login"]').textContent?.trim()).toBe('Back to login');
    });

    it('should submit the latest token when the token query param changes', async () => {
      authService.resetPassword.and.returnValue(of(undefined));
      await open('/reset-password?token=abc');
      spyOn(router, 'navigate').and.resolveTo(true);

      await harness.navigateByUrl('/reset-password?token=xyz', ResetPasswordComponent);
      await fillValidForm();
      await submit();

      expect(authService.resetPassword).toHaveBeenCalledOnceWith('xyz', 'Password1');
    });

    it('should remove the token from the address bar and keep showing the form', async () => {
      await open('/reset-password?token=abc');
      await harness.fixture.whenStable();

      expect(router.url).toBe('/reset-password');
      expect(el.querySelector('form')).not.toBeNull();
      expect(el.querySelector('.info-panel')).toBeNull();
    });

    it('should keep other query params when removing the token from the address bar', async () => {
      await open('/reset-password?token=abc&lang=en');
      await harness.fixture.whenStable();

      expect(router.url).toBe('/reset-password?lang=en');
    });

    it('should keep the URL fragment when removing the token from the address bar', async () => {
      await open('/reset-password?token=abc#top');
      await harness.fixture.whenStable();

      expect(router.url).toBe('/reset-password#top');
    });

    it('should submit the token read before it was removed from the address bar', async () => {
      authService.resetPassword.and.returnValue(of(undefined));
      await open('/reset-password?token=abc');
      spyOn(router, 'navigate').and.resolveTo(true);
      await fillValidForm();

      await submit();

      expect(authService.resetPassword).toHaveBeenCalledOnceWith('abc', 'Password1');
    });

    it('should keep the token when it is removed from the URL before the first render', async () => {
      authService.resetPassword.and.returnValue(of(undefined));
      harness = await RouterTestingHarness.create();
      const tokenRemoved = firstValueFrom(
        router.events.pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
          filter((event) => event.urlAfterRedirects === '/reset-password'),
        ),
      );

      // Navigate without the harness so nothing renders (or reads the component's signals)
      // until the follow-up navigation that strips the token has completed.
      await router.navigateByUrl('/reset-password?token=abc');
      await tokenRemoved;
      expect(router.url).toBe('/reset-password');

      harness.detectChanges();
      await harness.fixture.whenStable();
      const root = harness.routeNativeElement;
      if (!root) {
        throw new Error('Route element not rendered');
      }
      el = root;
      spyOn(router, 'navigate').and.resolveTo(true);

      expect(el.querySelector('.info-panel')).toBeNull();
      expect(el.querySelector('form')).not.toBeNull();

      await fillValidForm();
      await submit();

      expect(authService.resetPassword).toHaveBeenCalledOnceWith('abc', 'Password1');
    });

    it('should keep the stored token when navigating to the page without a token', async () => {
      authService.resetPassword.and.returnValue(of(undefined));
      await open('/reset-password?token=abc');
      spyOn(router, 'navigate').and.resolveTo(true);

      await harness.navigateByUrl('/reset-password?token=%20', ResetPasswordComponent);
      await fillValidForm();
      await submit();

      expect(el.querySelector('.info-panel')).toBeNull();
      expect(authService.resetPassword).toHaveBeenCalledOnceWith('abc', 'Password1');
    });

    it('should clear the error and the request-new-link link when a new token arrives', async () => {
      authService.resetPassword.and.returnValue(throwError(() => httpError(400)));
      await open('/reset-password?token=abc');
      await fillValidForm();
      await submit();
      expect(el.querySelector('.error-banner__link')).not.toBeNull();

      await harness.navigateByUrl('/reset-password?token=xyz', ResetPasswordComponent);

      expect(el.querySelector('.error-banner')).toBeNull();
      expect(el.querySelector('.error-banner__link')).toBeNull();
      expect(el.querySelector('form')).not.toBeNull();
    });

    it('should keep the error when the same token is opened again', async () => {
      authService.resetPassword.and.returnValue(throwError(() => httpError(400)));
      await open('/reset-password?token=abc');
      await fillValidForm();
      await submit();

      await harness.navigateByUrl('/reset-password?token=abc', ResetPasswordComponent);

      expect(query<HTMLElement>('.error-banner').textContent).toContain('Reset link is invalid or has expired.');
    });
  });

  describe('Validation', () => {
    beforeEach(async () => {
      await open('/reset-password?token=abc');
    });

    it('should not show validation errors before the fields are touched', () => {
      expect(el.querySelectorAll('.error-message').length).toBe(0);
      expect(query<HTMLInputElement>('#newPassword').getAttribute('aria-describedby')).toBeNull();
    });

    it('should mark all fields as touched and show required errors when submitting an empty form', async () => {
      await submit();

      expect(query<HTMLElement>('#newPassword-error').textContent?.trim()).toBe('New password is required');
      expect(query<HTMLElement>('#confirmPassword-error').textContent?.trim()).toBe(
        'Please confirm your new password',
      );
      expect(authService.resetPassword).not.toHaveBeenCalled();
    });

    it('should link the inputs to their errors via aria attributes when invalid and touched', async () => {
      await submit();

      const newPassword = query<HTMLInputElement>('#newPassword');
      const confirmPassword = query<HTMLInputElement>('#confirmPassword');
      expect(newPassword.getAttribute('aria-invalid')).toBe('true');
      expect(newPassword.getAttribute('aria-describedby')).toBe('newPassword-error');
      expect(confirmPassword.getAttribute('aria-invalid')).toBe('true');
      expect(confirmPassword.getAttribute('aria-describedby')).toBe('confirmPassword-error');
    });

    it('should show a minlength error when the new password has 7 characters', async () => {
      typeInField('#newPassword', 'Passwo1');
      harness.detectChanges();
      await harness.fixture.whenStable();

      expect(query<HTMLElement>('#newPassword-error').textContent?.trim()).toBe(
        'Password must be at least 8 characters long',
      );
    });

    it('should accept a new password of exactly 8 characters', async () => {
      typeInField('#newPassword', 'Passwor1');
      harness.detectChanges();
      await harness.fixture.whenStable();

      const input = query<HTMLInputElement>('#newPassword');
      expect(el.querySelector('#newPassword-error')).toBeNull();
      expect(input.getAttribute('aria-invalid')).toBe('false');
      expect(input.getAttribute('aria-describedby')).toBeNull();
    });

    it('should mark the confirm field invalid via aria attributes when the passwords differ', async () => {
      typeInField('#newPassword', 'Password1');
      typeInField('#confirmPassword', 'Password2');
      harness.detectChanges();
      await harness.fixture.whenStable();

      const confirmPassword = query<HTMLInputElement>('#confirmPassword');
      expect(confirmPassword.getAttribute('aria-invalid')).toBe('true');
      expect(confirmPassword.getAttribute('aria-describedby')).toBe('confirmPassword-error');
    });

    it('should hide the mismatch error once the passwords match', async () => {
      typeInField('#newPassword', 'Password1');
      typeInField('#confirmPassword', 'Password2');
      harness.detectChanges();
      await harness.fixture.whenStable();

      typeInField('#confirmPassword', 'Password1');
      harness.detectChanges();
      await harness.fixture.whenStable();

      expect(el.querySelector('#confirmPassword-error')).toBeNull();
      expect(query<HTMLInputElement>('#confirmPassword').getAttribute('aria-describedby')).toBeNull();
    });
  });

  describe('Loading state', () => {
    let response: Subject<void>;

    beforeEach(async () => {
      response = new Subject<void>();
      authService.resetPassword.and.returnValue(response);
      await open('/reset-password?token=abc');
      spyOn(router, 'navigate').and.resolveTo(true);
      await fillValidForm();
    });

    it('should disable the button, set aria-busy and show the saving label while the request is pending', async () => {
      await submit();

      const button = submitButton();
      expect(button.disabled).toBeTrue();
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.textContent?.trim()).toBe('Saving…');
    });

    it('should not send a second request when the button is clicked again while loading', async () => {
      await submit();

      await submit();

      expect(authService.resetPassword).toHaveBeenCalledTimes(1);
    });

    it('should restore the button after the request fails', async () => {
      await submit();

      response.error(httpError(500));
      harness.detectChanges();
      await harness.fixture.whenStable();

      const button = submitButton();
      expect(button.disabled).toBeFalse();
      expect(button.getAttribute('aria-busy')).toBe('false');
      expect(button.textContent?.trim()).toBe('Set new password');
    });
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      await open('/reset-password?token=abc');
    });

    it('should show the rate limit message without a request-new-link link on 429', async () => {
      authService.resetPassword.and.returnValue(throwError(() => httpError(429)));
      await fillValidForm();

      await submit();

      const banner = query<HTMLElement>('.error-banner');
      expect(banner.textContent?.trim()).toBe('Too many requests. Please wait a minute and try again.');
      expect(banner.getAttribute('role')).toBe('alert');
      expect(el.querySelector('.error-banner__link')).toBeNull();
      expect(el.querySelector('form')).not.toBeNull();
    });

    it('should show the fallback invalid link message with a request-new-link link on 400 without a server message', async () => {
      authService.resetPassword.and.returnValue(throwError(() => httpError(400)));
      await fillValidForm();

      await submit();

      expect(query<HTMLElement>('.error-banner').textContent).toContain('Reset link is invalid or has expired.');
      expect(query<HTMLAnchorElement>('.error-banner__link').getAttribute('href')).toBe('/forgot-password');
    });

    it('should show a generic message without a request-new-link link on a server error', async () => {
      authService.resetPassword.and.returnValue(throwError(() => httpError(500)));
      await fillValidForm();

      await submit();

      expect(query<HTMLElement>('.error-banner').textContent?.trim()).toBe(
        'Something went wrong. Please try again later.',
      );
      expect(el.querySelector('.error-banner__link')).toBeNull();
    });

    it('should show a generic message on a network error', async () => {
      authService.resetPassword.and.returnValue(throwError(() => httpError(0)));
      await fillValidForm();

      await submit();

      expect(query<HTMLElement>('.error-banner').textContent?.trim()).toBe(
        'Something went wrong. Please try again later.',
      );
    });

    it('should show a generic message when the error is not an HTTP error', async () => {
      authService.resetPassword.and.returnValue(throwError(() => new Error('boom')));
      await fillValidForm();

      await submit();

      expect(query<HTMLElement>('.error-banner').textContent?.trim()).toBe(
        'Something went wrong. Please try again later.',
      );
      expect(el.querySelector('.error-banner__link')).toBeNull();
    });

    it('should clear the previous error and the request-new-link link when submitting again', async () => {
      const retry = new Subject<void>();
      authService.resetPassword.and.returnValues(throwError(() => httpError(400)), retry);
      await fillValidForm();
      await submit();
      expect(el.querySelector('.error-banner')).not.toBeNull();

      await submit();

      expect(el.querySelector('.error-banner')).toBeNull();
      expect(el.querySelector('.error-banner__link')).toBeNull();
    });

    it('should hide the request-new-link link when a retry after 400 fails with 429', async () => {
      authService.resetPassword.and.returnValues(
        throwError(() => httpError(400)),
        throwError(() => httpError(429)),
      );
      await fillValidForm();
      await submit();

      await submit();

      expect(query<HTMLElement>('.error-banner').textContent).toContain('Too many requests');
      expect(el.querySelector('.error-banner__link')).toBeNull();
    });
  });
});
