import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@features/services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getServerErrorMessage } from '@core/utils/http-error';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly loginSuccess = output<void>();

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** Shown after a successful password reset (`/login?reset=success`). */
  readonly showResetSuccess = signal(this.route.snapshot.queryParamMap.get('reset') === 'success');

  readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  readonly usernameControl = computed(() => this.form.get('username'));
  readonly passwordControl = computed(() => this.form.get('password'));

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
    this.showResetSuccess.set(false);

    const { username, password } = this.form.getRawValue();
    this.authService
      .login(username, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.loginSuccess.emit();
          this.router.navigate(['/products']);
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            getServerErrorMessage(error) ?? 'Login failed. Please check your credentials and try again.',
          );
        },
      });
  }

  private setupFormErrorClearing(): void {
    this.form.statusChanges
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(() => {
      if (this.form.valid && this.errorMessage()) {
        this.errorMessage.set(null);
      }
    });
  }
}
