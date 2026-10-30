# Testing

## Test runner

Check `angular.json` (`test` target) and `package.json`. New Angular 21+ projects default to Vitest,
older ones — Karma + Jasmine. Write tests with the runner that is already configured.

**In this project (FE/) it's Karma + Jasmine.** Detailed rules and proven templates are in the `test-karma-jasmine` skill;
it takes precedence over the examples below.

## Component test

```ts
describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProductCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', { id: '1', name: 'Book', price: 10, stock: 0 });
    await fixture.whenStable();
  });

  it('disables the button when sold out', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
  });
});
```

## Rules

- **Test behavior, not implementation:** what the user sees and does (DOM, emitted outputs), not private methods.
- Signal inputs — only via `fixture.componentRef.setInput()`.
- Zoneless: after changes, wait for `await fixture.whenStable()` instead of relying on `fixture.detectChanges()`.
- Outputs — subscribe to `fixture.componentInstance.someOutput.subscribe(...)` or check the result in a parent test host.
- HTTP: `provideHttpClient()` + `provideHttpClientTesting()` and `HttpTestingController`; at the end — `httpMock.verify()`.
- For Angular Material / CDK components — Component Harnesses (`TestbedHarnessEnvironment`).
- Mock dependencies via `providers: [{ provide: UserApi, useValue: mock }]`, not by patching prototypes.
- Every new component, service, guard, pipe gets a test in a file next to it (`*.spec.ts`).
