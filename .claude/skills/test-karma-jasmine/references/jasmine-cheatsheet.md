# Jasmine: cheat sheet

## Matchers

| Check | Matcher |
|---|---|
| Strict equality (`===`), primitives | `toBe(5)`, `toBeTrue()`, `toBeFalse()`, `toBeNull()`, `toBeUndefined()` |
| Deep equality of objects / arrays | `toEqual({ id: 'p1' })` |
| Partial match | `toEqual(jasmine.objectContaining({ status: 500 }))`, `jasmine.arrayContaining([...])`, `jasmine.stringContaining('x')` |
| Any value of a type | `jasmine.any(Number)`, `jasmine.anything()` |
| String / array contains | `toContain('Book')` |
| Regular expression | `toMatch(/^\$10/)` |
| Numbers | `toBeGreaterThan(0)`, `toBeCloseTo(0.3, 5)` |
| Type / class | `toBeInstanceOf(UrlTree)` |
| Exception | `expect(() => fn()).toThrowError(TypeError, 'msg')` |
| Length | `toHaveSize(3)` |
| Negation | `.not.toBeNull()` |
| DOM class | `toHaveClass('active')` (on an `Element`) |

Async (Promise):

```ts
await expectAsync(promise).toBeResolvedTo(value);
await expectAsync(promise).toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
await expectAsync(promise).toBeRejectedWithError(Error, 'Not found');
```

## Spies

```ts
// Mock of a whole service — typed, no any
const api = jasmine.createSpyObj<ProductApi>('ProductApi', ['getAll', 'update']);
api.getAll.and.returnValue(of([book]));
api.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

// Mock with properties (third argument) — for store signals
const store = jasmine.createSpyObj<ProductStore>('ProductStore', ['load'], {
  products: signal<Product[]>([]).asReadonly(),
});

// Spy on a method of an existing object
spyOn(router, 'navigate').and.resolveTo(true);
spyOn(console, 'error'); // silence an expected error + check that it was logged

// Standalone spy function
const callback = jasmine.createSpy('callback');
```

Behavior: `and.returnValue(v)`, `and.returnValues(a, b)`, `and.resolveTo(v)`, `and.rejectWith(err)`,
`and.callFake((x) => ...)`, `and.throwError('msg')`, `and.callThrough()`.

Call checks:

```ts
expect(api.getAll).toHaveBeenCalled();
expect(api.getAll).toHaveBeenCalledTimes(1);
expect(api.update).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'p1' }));
expect(api.update).toHaveBeenCalledOnceWith(book);
expect(api.update).not.toHaveBeenCalled();
expect(api.update.calls.mostRecent().args[0]).toEqual(book);
```

## Structure

```ts
describe('ProductStore', () => {          // what we test
  describe('load()', () => {              // grouping by method / scenario
    beforeEach(() => { /* shared Arrange */ });
    afterEach(() => { /* cleanup */ });

    it('should ... when ...', () => {});
  });
});
```

- Test order is **random** (Jasmine's default setting) — tests must not depend on each other.
  To reproduce a failure, take the `seed` from the Karma output and set it in `karma.conf.js` → `client.jasmine.seed`.
- `fdescribe` / `fit` / `xdescribe` / `xit` — only locally for debugging, never in a commit.
- `pending('reason')` — explicitly mark an unfinished test (better than `xit` without an explanation).
