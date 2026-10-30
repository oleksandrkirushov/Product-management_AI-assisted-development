# Components

## Reference component

```ts
import { Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Product } from '@features/models/product';

@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe],
  host: {
    class: 'product-card',
    '[class.product-card--sold-out]': 'soldOut()',
  },
  template: `
    <h3>{{ product().name }}</h3>
    <p>{{ product().price | currency }}</p>
    <button type="button" [disabled]="soldOut()" (click)="addToCart.emit(product().id)">
      Add to cart
    </button>
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly addToCart = output<string>();

  protected readonly soldOut = computed(() => this.product().stock === 0);
}
```

## Rules

- **Standalone by default.** Don't add `standalone: true`. Don't create an `NgModule` for new features.
- **Always OnPush.** In Angular 22+ it's the default — we don't specify `changeDetection` (the example above is for v22+).
  In versions before 22 — explicitly `changeDetection: ChangeDetectionStrategy.OnPush`. Together with signals this gives predictable and fast updates.
- **Inputs/outputs as functions:**
  - `input<T>()` / `input.required<T>()` — instead of `@Input()`.
  - `input(..., { transform: booleanAttribute })` — for boolean attributes.
  - `output<T>()` — instead of `@Output() new EventEmitter()`.
  - `model<T>()` — for two-way binding `[(value)]`.
- **Queries as signals:** `viewChild()`, `viewChild.required()`, `viewChildren()`, `contentChild()`.
- **Host bindings** — in the `host` object, not `@HostBinding` / `@HostListener`.
- **Members used only in the template** are `protected`; inputs/outputs/queries are `readonly`.
- **Template:** inline for small components (up to ~10 lines), otherwise `templateUrl`/`styleUrl` with relative paths.
- **Separate responsibilities:**
  - *Presentational* — receives data via inputs, communicates via outputs, doesn't inject data services.
  - *Smart / container* (usually a page) — injects services, holds state, passes data down.
- **Lifecycle:**
  - DOM work after rendering — `afterNextRender()` / `afterRenderEffect()`, not `ngAfterViewInit` + `setTimeout`.
  - Unsubscribing — `takeUntilDestroyed()` or `DestroyRef.onDestroy()`, not a manual `ngOnDestroy` + `Subject`.
- **Don't access the DOM directly** (`document.querySelector`) — use `viewChild` and `Renderer2` / bindings.
