# Signals and state management

## Basic primitives

| API | Purpose |
|---|---|
| `signal(v)` | Writable local state |
| `computed(() => ...)` | Derived value (read-only, memoized) |
| `linkedSignal(() => ...)` | Writable state that resets when its source changes (e.g. the selected list item) |
| `effect(() => ...)` | Side effects: logging, localStorage, third-party libraries |
| `resource()` / `httpResource()` | Async data that depends on signals |
| `toSignal()` / `toObservable()` | Bridge between RxJS and signals |

## Rules

- **Don't mutate a signal's value.** Create a new one:
  ```ts
  this.items.update(items => [...items, newItem]);   // ✅
  this.items().push(newItem);                          // ❌ OnPush won't see the change
  ```
- **`computed` instead of `effect` for derived state.** If you call `someSignal.set(...)` inside an `effect`, it should almost always be a `computed` or `linkedSignal`.
- **State in a service:** a private writable signal + a public readonly one.
  ```ts
  @Injectable({ providedIn: 'root' })
  export class CartStore {
    private readonly _items = signal<CartItem[]>([]);
    readonly items = this._items.asReadonly();
    readonly total = computed(() => this._items().reduce((sum, i) => sum + i.price * i.qty, 0));

    add(item: CartItem) {
      this._items.update(items => [...items, item]);
    }
  }
  ```
- **RxJS stays for event streams** (search debounce, websocket, complex orchestration). At the template boundary convert to a signal via `toSignal()`.
- **Global state:** for simple cases a service with signals (as above) is enough. NgRx Signal Store / NgRx Store — only if already used in the project or the state is truly complex.

## Async data

```ts
readonly userId = input.required<string>();
readonly user = httpResource<User>(() => `/api/users/${this.userId()}`);
```

```html
@if (user.isLoading()) { <app-spinner /> }
@else if (user.error()) { <app-error /> }
@else if (user.hasValue()) { <h2>{{ user.value().name }}</h2> }
```

- `httpResource` — for reading data (GET). For mutations (POST/PUT/DELETE) use `HttpClient`.
- Check whether `resource`/`httpResource` are already stable in the project's Angular version. If not — `HttpClient` + `toSignal()`.
