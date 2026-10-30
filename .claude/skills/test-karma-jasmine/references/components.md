# Components, directives, pipes

## Component: inputs, outputs, DOM, host

Component:

```ts
@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe],
  host: { '[class.product-card--sold-out]': 'soldOut()' },
  template: `
    <h3>{{ product().name }}</h3>
    <p>{{ product().price | currency }}</p>
    <button type="button" [disabled]="soldOut()" (click)="addToCart.emit(product().id)">Add to cart</button>
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly addToCart = output<string>();
  protected readonly soldOut = computed(() => this.product().stock === 0);
}
```

Test:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductCardComponent } from './product-card.component';
import { Product } from '@features/models/product';

describe('ProductCardComponent', () => {
  const product: Product = { id: 'p1', name: 'Book', price: 10, stock: 3 };

  let fixture: ComponentFixture<ProductCardComponent>;
  let el: HTMLElement;

  // Factory with overrides — instead of duplicating setup in every test
  async function setup(overrides: Partial<Product> = {}): Promise<void> {
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', { ...product, ...overrides });
    await fixture.whenStable();
    el = fixture.nativeElement;
  }

  // Throws if the element is missing — so the test doesn't "pass" by accident
  function button(): HTMLButtonElement {
    const btn = el.querySelector<HTMLButtonElement>('button');
    if (!btn) throw new Error('Button not found');
    return btn;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProductCardComponent] }).compileComponents();
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

Key points:
- `setInput()` + `await fixture.whenStable()` — after every state change, before checking the DOM.
- `fixture.nativeElement` is the host element: host classes and attributes are checked on it.
- `protected` members (like `soldOut`) are not checked directly — only their effect on the DOM.

## Component with dependencies (smart / container)

Mock services via DI and check that the component calls them and displays the result:

```ts
let store: jasmine.SpyObj<ProductStore>;

beforeEach(async () => {
  store = jasmine.createSpyObj<ProductStore>('ProductStore', ['load'], {
    products: signal<Product[]>([book]).asReadonly(),   // signal properties — as the third argument
  });
  await TestBed.configureTestingModule({
    imports: [ProductListPageComponent],
    providers: [{ provide: ProductStore, useValue: store }],
  }).compileComponents();
});
```

If child components are heavy, they can be replaced with stubs:
`TestBed.overrideComponent(ProductListPageComponent, { remove: { imports: [ChartComponent] }, add: { imports: [ChartStubComponent] } })`.

## Directive — through a test host

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
class TestHostComponent {
  readonly on = signal(false);
}

describe('Highlight', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let paragraph: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestHostComponent);
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

## Pipe — without TestBed

A pure pipe without dependencies is a plain class:

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

If the pipe uses `inject()` — create it inside `TestBed.runInInjectionContext(() => new MyPipe())`.
