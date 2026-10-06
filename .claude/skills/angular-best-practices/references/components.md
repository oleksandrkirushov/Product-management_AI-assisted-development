# Компоненти

## Еталонний компонент

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
      Додати в кошик
    </button>
  `,
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly addToCart = output<string>();

  protected readonly soldOut = computed(() => this.product().stock === 0);
}
```

## Правила

- **Standalone за замовчуванням.** Не додавай `standalone: true`. Не створюй `NgModule` для нових фіч.
- **OnPush завжди.** В Angular 22+ це дефолт — `changeDetection` не вказуємо (приклад вище — для v22+).
  У версіях до 22 — явно `changeDetection: ChangeDetectionStrategy.OnPush`. Разом із signals це дає передбачуване й швидке оновлення.
- **Inputs/outputs як функції:**
  - `input<T>()` / `input.required<T>()` — замість `@Input()`.
  - `input(..., { transform: booleanAttribute })` — для boolean-атрибутів.
  - `output<T>()` — замість `@Output() new EventEmitter()`.
  - `model<T>()` — для двостороннього зв'язування `[(value)]`.
- **Queries як сигнали:** `viewChild()`, `viewChild.required()`, `viewChildren()`, `contentChild()`.
- **Host-біндинги** — в об'єкті `host`, не `@HostBinding` / `@HostListener`.
- **Члени, які використовуються лише в шаблоні,** — `protected`; inputs/outputs/queries — `readonly`.
- **Шаблон:** inline для маленьких компонентів (до ~10 рядків), інакше `templateUrl`/`styleUrl` з відносними шляхами.
- **Розділяй відповідальність:**
  - *Presentational* — отримує дані через inputs, повідомляє через outputs, не інжектить data-сервіси.
  - *Smart / container* (зазвичай сторінка) — інжектить сервіси, тримає стан, передає дані вниз.
- **Життєвий цикл:**
  - Робота з DOM після рендера — `afterNextRender()` / `afterRenderEffect()`, а не `ngAfterViewInit` + `setTimeout`.
  - Відписки — `takeUntilDestroyed()` або `DestroyRef.onDestroy()`, а не ручний `ngOnDestroy` + `Subject`.
- **Не звертайся до DOM напряму** (`document.querySelector`) — використовуй `viewChild` і `Renderer2` / біндинги.
