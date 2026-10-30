# Async in zoneless tests

The project has no Zone.js, so:

| Instead of (zone.js) | Use |
|---|---|
| `fakeAsync(() => ...)` | a plain `() => ...` + `jasmine.clock()` |
| `tick(ms)` | `jasmine.clock().tick(ms)` |
| `waitForAsync(...)` | `async () => { ... await ... }` |
| `fixture.detectChanges()` after every change | `await fixture.whenStable()` |
| `flush()` / `flushMicrotasks()` | `await fixture.whenStable()` or `await` the specific Promise |

`fakeAsync` fails here with the error `zone-testing.js is needed for the fakeAsync() test helper`.

## What to "advance" with what

| Situation | What to do |
|---|---|
| An input / signal / state changed — the DOM needs updating | `await fixture.whenStable()` |
| An `effect()` needs to run (including inside `toObservable()`) | `TestBed.tick()` |
| `setTimeout` / `setInterval` | `jasmine.clock().install()` + `jasmine.clock().tick(ms)` |
| RxJS `debounceTime`, `delay`, `throttleTime`, `timer` | the same **+ `jasmine.clock().mockDate()`** |
| A Promise in the code | `await` it or `await fixture.whenStable()` |
| HTTP | `HttpTestingController.flush()`, then `await fixture.whenStable()` |

## Timer (`setTimeout`)

```ts
@Injectable({ providedIn: 'root' })
export class ToastStore {
  private readonly _messages = signal<string[]>([]);
  readonly messages = this._messages.asReadonly();

  show(message: string, durationMs = 3000): void {
    this._messages.update((m) => [...m, message]);
    setTimeout(() => this._messages.update((m) => m.filter((x) => x !== message)), durationMs);
  }
}
```

```ts
describe('ToastStore', () => {
  let store: ToastStore;

  beforeEach(() => {
    jasmine.clock().install();
    store = TestBed.inject(ToastStore);
  });

  afterEach(() => jasmine.clock().uninstall()); // required — otherwise other tests will break

  it('should hide the message after the given duration', () => {
    store.show('Saved', 3000);
    expect(store.messages()).toEqual(['Saved']);

    jasmine.clock().tick(2999);
    expect(store.messages()).toEqual(['Saved']);

    jasmine.clock().tick(1);
    expect(store.messages()).toEqual([]);
  });
});
```

Check the boundary from both sides (2999 → still there, 3000 → gone).

## RxJS debounce + signals + effects

```ts
@Component({ /* ... */ })
export class Search {
  readonly query = signal('');
  readonly result = toSignal(
    toObservable(this.query).pipe(debounceTime(300), map((q) => q.toUpperCase())),
    { initialValue: '' },
  );
}
```

```ts
describe('Search', () => {
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(); // RxJS measures time via Date.now() — without this debounce never fires
  });

  afterEach(() => jasmine.clock().uninstall());

  it('should emit the transformed query only after 300ms of silence', () => {
    const fixture = TestBed.createComponent(Search);
    const search = fixture.componentInstance;

    search.query.set('book');
    TestBed.tick(); // runs the effect inside toObservable() → the value goes into the pipe

    jasmine.clock().tick(299);
    expect(search.result()).toBe('');

    jasmine.clock().tick(1);
    expect(search.result()).toBe('BOOK');
  });
});
```

## Common pitfalls
- **The test hangs on `await fixture.whenStable()`** — there's a pending HTTP request (`httpResource`, `HttpClient`)
  or an endless `setInterval` under `jasmine.clock()`. First `flush()` the request / stop the timer.
- **`jasmine.clock()` + `await whenStable()` in the same test** — whenStable may wait for a timer that will never fire.
  Separate them: synchronous checks with the clock — separately, DOM after `whenStable` — separately; or `tick()` the clock before `await`.
- **The effect didn't run** — you forgot `TestBed.tick()` (or `await fixture.whenStable()` for a component).
- **The test is green but verified nothing** — an `expect` inside a `subscribe` that never ran.
  Use `firstValueFrom` + `await`, or collect values into an array and check after the action.
