# Компоненти, директиви, пайпи

## Компонент: inputs, outputs, DOM, host

Компонент:

```ts
@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe],
  host: { '[class.product-card--sold-out]': 'soldOut()' },
  template: `
    <h3>{{ product().name }}</h3>
    <p>{{ product().price | currency }}</p>
    <button type="button" [disabled]="soldOut()" (click)="addToCart.emit(product().id)">Додати в кошик</button>
  `,
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly addToCart = output<string>();
  protected readonly soldOut = computed(() => this.product().stock === 0);
}
```

Тест:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductCard } from './product-card';
import { Product } from '@features/models/product';

describe('ProductCard', () => {
  const product: Product = { id: 'p1', name: 'Book', price: 10, stock: 3 };

  let fixture: ComponentFixture<ProductCard>;
  let el: HTMLElement;

  // Фабрика з перевизначеннями — замість дублювання налаштувань у кожному тесті
  async function setup(overrides: Partial<Product> = {}): Promise<void> {
    fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', { ...product, ...overrides });
    await fixture.whenStable();
    el = fixture.nativeElement;
  }

  // Кидає помилку, якщо елемента немає — тест не «пройде» випадково
  function button(): HTMLButtonElement {
    const btn = el.querySelector<HTMLButtonElement>('button');
    if (!btn) throw new Error('Button not found');
    return btn;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProductCard] }).compileComponents();
  });

  it('should render name and formatted price', async () => {
    await setup();

    expect(el.querySelector('h3')?.textContent).toContain('Book');
    expect(el.querySelector('p')?.textContent).toContain('$10.00');
  });

  it('should emit product id when the button is clicked', async () => {
    await setup();
    const emitted: string[] = [];
    fixture.componentInstance.addToCart.subscribe((id) => emitted.push(id));

    button().click();

    expect(emitted).toEqual(['p1']);
  });

  it('should disable the button and mark host as sold out when stock is 0', async () => {
    await setup({ stock: 0 });

    expect(button().disabled).toBeTrue();
    expect(el.classList.contains('product-card--sold-out')).toBeTrue();
  });

  it('should re-render when the input changes', async () => {
    await setup();

    fixture.componentRef.setInput('product', { ...product, name: 'Pen' });
    await fixture.whenStable();

    expect(el.querySelector('h3')?.textContent).toContain('Pen');
  });
});
```

Ключове:
- `setInput()` + `await fixture.whenStable()` — після кожної зміни стану, перед перевіркою DOM.
- `fixture.nativeElement` — це host-елемент: на ньому перевіряються host-класи та атрибути.
- `protected` члени (як `soldOut`) не перевіряємо напряму — лише їхній вплив на DOM.

## Компонент із залежностями (smart / container)

Мокай сервіси через DI і перевіряй, що компонент їх викликає й відображає результат:

```ts
let store: jasmine.SpyObj<ProductStore>;

beforeEach(async () => {
  store = jasmine.createSpyObj<ProductStore>('ProductStore', ['load'], {
    products: signal<Product[]>([book]).asReadonly(),   // властивості-сигнали — третім аргументом
  });
  await TestBed.configureTestingModule({
    imports: [ProductListPage],
    providers: [{ provide: ProductStore, useValue: store }],
  }).compileComponents();
});
```

Якщо дочірні компоненти важкі, їх можна замінити заглушками:
`TestBed.overrideComponent(ProductListPage, { remove: { imports: [Chart] }, add: { imports: [ChartStub] } })`.

## Директива — через тестовий host

```ts
@Directive({
  selector: '[appHighlight]',
  host: { '[class.highlighted]': 'appHighlight()' },
})
export class Highlight {
  readonly appHighlight = input(false, { transform: booleanAttribute });
}
```

```ts
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Highlight } from './highlight';

@Component({
  imports: [Highlight],
  template: `<p [appHighlight]="on()">text</p>`,
})
class TestHost {
  readonly on = signal(false);
}

describe('Highlight', () => {
  let fixture: ComponentFixture<TestHost>;
  let paragraph: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();
    paragraph = fixture.nativeElement.querySelector('p');
  });

  it('should not highlight by default', () => {
    expect(paragraph.classList.contains('highlighted')).toBeFalse();
  });

  it('should highlight when the input becomes true', async () => {
    fixture.componentInstance.on.set(true);
    await fixture.whenStable();

    expect(paragraph.classList.contains('highlighted')).toBeTrue();
  });
});
```

## Пайп — без TestBed

Чистий пайп без залежностей — звичайний клас:

```ts
describe('TruncatePipe', () => {
  const pipe = new TruncatePipe();

  it('should keep short strings unchanged', () => {
    expect(pipe.transform('short', 10)).toBe('short');
  });

  it('should cut long strings and add an ellipsis', () => {
    expect(pipe.transform('a very long title', 6)).toBe('a very…');
  });

  it('should not cut a string exactly at the limit', () => {
    expect(pipe.transform('12345', 5)).toBe('12345');
  });
});
```

Якщо пайп використовує `inject()` — створюй його в `TestBed.runInInjectionContext(() => new MyPipe())`.
