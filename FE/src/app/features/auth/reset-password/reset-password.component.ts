import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, ParamMap, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

  /**
   * One-time reset token kept in component state. Captured eagerly from the route snapshot at
   * construction time (not lazily on first render): in a zoneless app the first change detection
   * may run only after the token has already been removed from the URL (see the constructor).
   * A new non-blank token in the URL replaces it; an absent/blank param keeps the current value.
   */
  private readonly token = signal(nonBlankToken(this.route.snapshot.queryParamMap) ?? '');
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
    this.route.queryParamMap
      .pipe(
        map(nonBlankToken),
        filter((token): token is string => token !== null),
        takeUntilDestroyed(),
      )
      .subscribe((token) => this.token.set(token));

    // Once the token is captured, strip it from the address bar. `replaceUrl` overwrites the
    // current session-history entry, so it also won't be sent as Referer or restored by
    // back/forward; any copy made before this point (e.g. global browser history) is unaffected.
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
          preserveFragment: true,
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

/** The `token` query param, or `null` when it is absent or blank. */
function nonBlankToken(params: ParamMap): string | null {
  const token = params.get('token');
  return token && token.trim().length > 0 ? token : null;
}
