# Signals і керування станом

## Базові примітиви

| API | Для чого |
|---|---|
| `signal(v)` | Записуваний локальний стан |
| `computed(() => ...)` | Похідне значення (лише читання, мемоізоване) |
| `linkedSignal(() => ...)` | Записуваний стан, що скидається при зміні джерела (наприклад, вибраний елемент списку) |
| `effect(() => ...)` | Side effects: логування, localStorage, сторонні бібліотеки |
| `resource()` / `httpResource()` | Асинхронні дані, що залежать від сигналів |
| `toSignal()` / `toObservable()` | Міст між RxJS і signals |

## Правила

- **Не мутуй значення сигналу.** Створюй нове:
  ```ts
  this.items.update(items => [...items, newItem]);   // ✅
  this.items().push(newItem);                          // ❌ OnPush не побачить зміну
  ```
- **`computed` замість `effect` для похідного стану.** Якщо в `effect` ти робиш `someSignal.set(...)` — майже завжди це має бути `computed` або `linkedSignal`.
- **Стан у сервісі:** приватний записуваний сигнал + публічний readonly.
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
- **RxJS лишається для потоків подій** (debounce пошуку, websocket, складна оркестрація). На межі з шаблоном перетворюй на сигнал через `toSignal()`.
- **Глобальний стан:** для простих випадків вистачить сервісу з сигналами (як вище). NgRx Signal Store / NgRx Store — лише якщо вже використовуються в проєкті або стан справді складний.

## Асинхронні дані

```ts
readonly userId = input.required<string>();
readonly user = httpResource<User>(() => `/api/users/${this.userId()}`);
```

```html
@if (user.isLoading()) { <app-spinner /> }
@else if (user.error()) { <app-error /> }
@else if (user.hasValue()) { <h2>{{ user.value().name }}</h2> }
```

- `httpResource` — для читання даних (GET). Для мутацій (POST/PUT/DELETE) використовуй `HttpClient`.
- Перевір, чи `resource`/`httpResource` вже стабільні у версії Angular проєкту. Якщо ні — `HttpClient` + `toSignal()`.
