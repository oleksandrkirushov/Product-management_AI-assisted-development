import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '@features/services/auth.service';
import { getServerErrorMessage } from '@core/utils/http-error';
import { passwordsMatchValidator } from '@shared/validators/passwords-match.validator';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** Raw `?token=` query param of the email link (`null` when absent). */
  private readonly tokenFromUrl = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('token'))),
    { requireSync: true },
  );

  /**
   * One-time reset token kept in component state. A new non-blank token in the URL replaces it;
   * an absent/blank param keeps the previous value, so removing the token from the address bar
   * (see the constructor) doesn't turn the page into "invalid link".
   */
  private readonly token = linkedSignal<string | null, string>({
    source: this.tokenFromUrl,
    computation: (fromUrl, previous) =>
      fromUrl && fromUrl.trim().length > 0 ? fromUrl : (previous?.value ?? ''),
  });
  readonly hasToken = computed(() => this.token().length > 0);

  readonly isLoading = signal(false);
  /** Error of the last submit; reset whenever a new token arrives. */
  readonly errorMessage = linkedSignal<string, string | null>({
    source: this.token,
    computation: () => null,
  });
  /** True when the server rejected the token/password (400): offer to request a new link. */
  readonly showRequestNewLink = linkedSignal<string, boolean>({
    source: this.token,
    computation: () => false,
  });

  readonly form = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator('newPassword', 'confirmPassword') },
  );

  readonly newPasswordControl = computed(() => this.form.get('newPassword'));
  readonly confirmPasswordControl = computed(() => this.form.get('confirmPassword'));

  constructor() {
    // Keep the secret token out of the address bar, browser history and Referer once it's read.
    // Waits for NavigationEnd: navigating while the current navigation is still activating this
    // route would supersede it before the router state is committed.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        filter(() => this.route.snapshot.queryParamMap.has('token')),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { token: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.showRequestNewLink.set(false);

    const { newPassword } = this.form.getRawValue();
    this.authService
      .resetPassword(this.token(), newPassword)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/login'], { queryParams: { reset: 'success' } });
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.handleError(error);
        },
      });
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      this.errorMessage.set('Too many requests. Please wait a minute and try again.');
      return;
    }

    const isBadRequest = error instanceof HttpErrorResponse && error.status === 400;
    this.showRequestNewLink.set(isBadRequest);
    this.errorMessage.set(
      getServerErrorMessage(error) ??
        (isBadRequest
          ? 'Reset link is invalid or has expired.'
          : 'Something went wrong. Please try again later.'),
    );
  }
}
