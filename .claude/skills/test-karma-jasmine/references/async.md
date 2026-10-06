# Асинхронність у zoneless-тестах

Zone.js у проєкті немає, тому:

| Замість (zone.js) | Використовуй |
|---|---|
| `fakeAsync(() => ...)` | звичайний `() => ...` + `jasmine.clock()` |
| `tick(ms)` | `jasmine.clock().tick(ms)` |
| `waitForAsync(...)` | `async () => { ... await ... }` |
| `fixture.detectChanges()` після кожної зміни | `await fixture.whenStable()` |
| `flush()` / `flushMicrotasks()` | `await fixture.whenStable()` або `await` конкретного Promise |

`fakeAsync` тут падає з помилкою `zone-testing.js is needed for the fakeAsync() test helper`.

## Що чим «прокручувати»

| Ситуація | Що робити |
|---|---|
| Змінився input / сигнал / стан — треба оновити DOM | `await fixture.whenStable()` |
| Треба виконати `effect()` (у т. ч. всередині `toObservable()`) | `TestBed.tick()` |
| `setTimeout` / `setInterval` | `jasmine.clock().install()` + `jasmine.clock().tick(ms)` |
| RxJS `debounceTime`, `delay`, `throttleTime`, `timer` | те саме **+ `jasmine.clock().mockDate()`** |
| Promise у коді | `await` його або `await fixture.whenStable()` |
| HTTP | `HttpTestingController.flush()`, потім `await fixture.whenStable()` |

## Таймер (`setTimeout`)

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

  afterEach(() => jasmine.clock().uninstall()); // обов'язково — інакше зламаються інші тести

  it('should hide the message after the given duration', () => {
    store.show('Збережено', 3000);
    expect(store.messages()).toEqual(['Збережено']);

    jasmine.clock().tick(2999);
    expect(store.messages()).toEqual(['Збережено']);

    jasmine.clock().tick(1);
    expect(store.messages()).toEqual([]);
  });
});
```

Перевіряй межу з обох боків (2999 → ще є, 3000 → вже немає).

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
    jasmine.clock().mockDate(); // RxJS рахує час через Date.now() — без цього debounce ніколи не спрацює
  });

  afterEach(() => jasmine.clock().uninstall());

  it('should emit the transformed query only after 300ms of silence', () => {
    const fixture = TestBed.createComponent(Search);
    const search = fixture.componentInstance;

    search.query.set('book');
    TestBed.tick(); // запускає effect усередині toObservable() → значення йде в pipe

    jasmine.clock().tick(299);
    expect(search.result()).toBe('');

    jasmine.clock().tick(1);
    expect(search.result()).toBe('BOOK');
  });
});
```

## Типові пастки
- **Тест зависає на `await fixture.whenStable()`** — є незавершений HTTP-запит (`httpResource`, `HttpClient`)
  або нескінченний `setInterval` під `jasmine.clock()`. Спершу `flush()` запит / зупини таймер.
- **`jasmine.clock()` + `await whenStable()` в одному тесті** — whenStable може чекати на таймер, який ніколи не настане.
  Розділяй: синхронні перевірки з годинником — окремо, DOM після `whenStable` — окремо; або `tick()` годинника до `await`.
- **Effect не спрацював** — забув `TestBed.tick()` (або `await fixture.whenStable()` для компонента).
- **Тест зелений, але нічого не перевірив** — `expect` всередині `subscribe`, який так і не виконався.
  Використовуй `firstValueFrom` + `await` або збирай значення в масив і перевіряй після дії.
