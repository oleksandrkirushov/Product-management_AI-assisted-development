import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
  NonNullableFormBuilder,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@features/services/auth.service';
import { RegisterRequest } from '@features/models/user';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { getServerErrorMessage } from '@core/utils/http-error';

/**
 * Cross-field validator applied at the form group level: confirms that
 * `password` and `confirmPassword` controls hold the same value.
 */
function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly autoLoginFailed = signal(false);

  readonly form = this.fb.group(
    {
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );

  readonly usernameControl = computed(() => this.form.get('username'));
  readonly emailControl = computed(() => this.form.get('email'));
  readonly firstNameControl = computed(() => this.form.get('firstName'));
  readonly lastNameControl = computed(() => this.form.get('lastName'));
  readonly passwordControl = computed(() => this.form.get('password'));
  readonly confirmPasswordControl = computed(() => this.form.get('confirmPassword'));

  constructor() {
    this.setupFormErrorClearing();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.autoLoginFailed.set(false);

    const { username, email, firstName, lastName, password } = this.form.getRawValue();
    const request: RegisterRequest = { username, email, firstName, lastName, password };
    let registered = false;

    this.authService
      .register(request)
      .pipe(
        switchMap(() => {
          registered = true;
          return this.authService.login(username, password);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/products']);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.handleError(error, registered);
        },
      });
  }

  private handleError(error: unknown, registered: boolean): void {
    if (registered) {
      // Registration succeeded but the follow-up auto-login request failed:
      // guide the user to the login page instead of leaving them in limbo.
      this.autoLoginFailed.set(true);
      this.errorMessage.set(
        'Registration succeeded, but automatic sign-in failed. Please log in manually.',
      );
      return;
    }

    this.errorMessage.set(
      getServerErrorMessage(error) ?? 'Registration failed. Please check your details and try again.',
    );
  }

  private setupFormErrorClearing(): void {
    this.form.statusChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.form.valid && this.errorMessage()) {
        this.errorMessage.set(null);
        this.autoLoginFailed.set(false);
      }
    });
  }
}
