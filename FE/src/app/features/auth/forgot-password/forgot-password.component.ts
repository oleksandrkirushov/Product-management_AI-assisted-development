import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '@features/services/auth.service';
import { getServerErrorMessage } from '@core/utils/http-error';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Success panel; receives focus after submit because the focused form disappears. */
  private readonly infoPanel = viewChild<ElementRef<HTMLElement>>('infoPanel');

  readonly isLoading = signal(false);
  readonly isSubmitted = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly emailControl = computed(() => this.form.get('email'));

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { email } = this.form.getRawValue();
    this.authService
      .forgotPassword(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.isSubmitted.set(true);
          this.focusInfoPanel();
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.errorMessage.set(this.toErrorMessage(error));
        },
      });
  }

  private focusInfoPanel(): void {
    afterNextRender({ write: () => this.infoPanel()?.nativeElement.focus() }, { injector: this.injector });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      return 'Too many requests. Please wait a minute and try again.';
    }

    return getServerErrorMessage(error) ?? 'Something went wrong. Please try again later.';
  }
}
