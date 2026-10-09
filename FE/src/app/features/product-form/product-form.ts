import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '@features/services/product.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule],
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
})
export class ProductForm {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    price: [0, [Validators.required, Validators.min(0.01)]],
  });

  readonly nameControl = computed(() => this.form.get('name'));
  readonly priceControl = computed(() => this.form.get('price'));

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.productService
      .create(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.router.navigate(['/products']);
        },
        error: (error) => {
          this.isSaving.set(false);
          this.errorMessage.set(
            error?.error?.title ?? error?.error?.message ?? 'Failed to save product. Please try again.',
          );
        },
      });
  }

  protected goBack(): void {
    this.router.navigate(['/products']);
  }
}
