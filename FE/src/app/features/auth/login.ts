import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@features/services/auth-service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loginSuccess = output<void>();

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

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
        error: (error) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            error?.error?.message ?? 'Login failed. Please check your credentials and try again.',
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
