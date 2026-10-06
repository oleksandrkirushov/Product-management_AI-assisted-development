# Тестування

## Тест-раннер

Перевір `angular.json` (`test` target) і `package.json`. У нових проєктах Angular 21+ за замовчуванням Vitest,
у старіших — Karma + Jasmine. Пиши тести на тому раннері, що вже налаштований.

## Тест компонента

```ts
describe('ProductCard', () => {
  let fixture: ComponentFixture<ProductCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProductCard] }).compileComponents();
    fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', { id: '1', name: 'Book', price: 10, stock: 0 });
    await fixture.whenStable();
  });

  it('disables the button when sold out', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
  });
});
```

## Правила

- **Тестуй поведінку, а не реалізацію:** що бачить і що робить користувач (DOM, emitted outputs), а не приватні методи.
- Signal inputs — тільки через `fixture.componentRef.setInput()`.
- Zoneless: після змін чекай `await fixture.whenStable()` замість покладання на `fixture.detectChanges()`.
- Outputs — підписуйся на `fixture.componentInstance.someOutput.subscribe(...)` або перевіряй результат у батьківському test host.
- HTTP: `provideHttpClient()` + `provideHttpClientTesting()` і `HttpTestingController`; наприкінці — `httpMock.verify()`.
- Для компонентів Angular Material / CDK — Component Harnesses (`TestbedHarnessEnvironment`).
- Мокай залежності через `providers: [{ provide: UserApi, useValue: mock }]`, а не через патчинг прототипів.
- Кожен новий компонент, сервіс, guard, pipe отримує тест у файлі поруч (`*.spec.ts`).
