# Jasmine: шпаргалка

## Матчери

| Перевірка | Матчер |
|---|---|
| Строга рівність (`===`), примітиви | `toBe(5)`, `toBeTrue()`, `toBeFalse()`, `toBeNull()`, `toBeUndefined()` |
| Глибока рівність об'єктів / масивів | `toEqual({ id: 'p1' })` |
| Частковий збіг | `toEqual(jasmine.objectContaining({ status: 500 }))`, `jasmine.arrayContaining([...])`, `jasmine.stringContaining('x')` |
| Будь-яке значення типу | `jasmine.any(Number)`, `jasmine.anything()` |
| Рядок / масив містить | `toContain('Book')` |
| Регулярний вираз | `toMatch(/^\$10/)` |
| Числа | `toBeGreaterThan(0)`, `toBeCloseTo(0.3, 5)` |
| Тип / клас | `toBeInstanceOf(UrlTree)` |
| Виняток | `expect(() => fn()).toThrowError(TypeError, 'msg')` |
| Довжина | `toHaveSize(3)` |
| Заперечення | `.not.toBeNull()` |
| DOM-клас | `toHaveClass('active')` (на `Element`) |

Асинхронні (Promise):

```ts
await expectAsync(promise).toBeResolvedTo(value);
await expectAsync(promise).toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
await expectAsync(promise).toBeRejectedWithError(Error, 'Not found');
```

## Шпигуни (spies)

```ts
// Мок цілого сервісу — типізований, без any
const api = jasmine.createSpyObj<ProductApi>('ProductApi', ['getAll', 'update']);
api.getAll.and.returnValue(of([book]));
api.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

// Мок із властивостями (третій аргумент) — для сигналів стору
const store = jasmine.createSpyObj<ProductStore>('ProductStore', ['load'], {
  products: signal<Product[]>([]).asReadonly(),
});

// Шпигун на метод існуючого об'єкта
spyOn(router, 'navigate').and.resolveTo(true);
spyOn(console, 'error'); // приглушити очікувану помилку + перевірити, що її залоговано

// Окрема функція-шпигун
const callback = jasmine.createSpy('callback');
```

Поведінка: `and.returnValue(v)`, `and.returnValues(a, b)`, `and.resolveTo(v)`, `and.rejectWith(err)`,
`and.callFake((x) => ...)`, `and.throwError('msg')`, `and.callThrough()`.

Перевірки викликів:

```ts
expect(api.getAll).toHaveBeenCalled();
expect(api.getAll).toHaveBeenCalledTimes(1);
expect(api.update).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'p1' }));
expect(api.update).toHaveBeenCalledOnceWith(book);
expect(api.update).not.toHaveBeenCalled();
expect(api.update.calls.mostRecent().args[0]).toEqual(book);
```

## Структура

```ts
describe('ProductStore', () => {          // що тестуємо
  describe('load()', () => {              // групування за методом / сценарієм
    beforeEach(() => { /* Arrange спільне */ });
    afterEach(() => { /* прибирання */ });

    it('should ... when ...', () => {});
  });
});
```

- Порядок тестів **випадковий** (налаштування Jasmine за замовчуванням) — тести не мають залежати один від одного.
  Щоб відтворити падіння, візьми `seed` із виводу Karma і задай його в `karma.conf.js` → `client.jasmine.seed`.
- `fdescribe` / `fit` / `xdescribe` / `xit` — лише локально для налагодження, ніколи в коміт.
- `pending('причина')` — явно позначити незавершений тест (краще, ніж `xit` без пояснення).
