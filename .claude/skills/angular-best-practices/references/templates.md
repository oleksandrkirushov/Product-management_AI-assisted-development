# Шаблони

## Control flow

```html
@if (user(); as user) {
  <app-avatar [user]="user" />
} @else {
  <a routerLink="/login">Увійти</a>
}

@for (item of items(); track item.id) {
  <app-item [item]="item" />
} @empty {
  <p>Список порожній</p>
}

@switch (status()) {
  @case ('loading') { <app-spinner /> }
  @case ('error') { <app-error /> }
  @default { <app-content /> }
}
```

- Використовуй `@if` / `@for` / `@switch`, а не `*ngIf` / `*ngFor` / `ngSwitch`.
- У `@for` **завжди** вказуй `track` за стабільним ідентифікатором (`item.id`). `track $index` — лише для статичних списків.
- `@let` — для локальних змінних у шаблоні замість повторних викликів сигналів.

## Біндинги

- `[class.active]="isActive()"` та `[style.width.px]="width()"` замість `ngClass` / `ngStyle`.
- Самозакривні теги для компонентів: `<app-item />`.
- Не викликай методи в шаблоні (`{{ getTotal() }}`) — винеси в `computed()`. Читання сигналів (`total()`) — ок.
- Не пиши складну логіку в шаблоні — тернарні ланцюжки, фільтрацію тощо переноси в `computed()`.
- Для Observable в шаблоні — `async` pipe або (краще) `toSignal()` у класі.

## Відкладене завантаження

```html
@defer (on viewport) {
  <app-heavy-chart [data]="data()" />
} @placeholder {
  <div class="chart-skeleton"></div>
} @loading (minimum 300ms) {
  <app-spinner />
}
```

- `@defer` — для важких компонентів нижче першого екрана, у вкладках, модалках.
- Тригери: `on viewport`, `on interaction`, `on idle` (дефолт), `when condition()`.

## Зображення

- Статичні зображення — `NgOptimizedImage`: `<img ngSrc="..." width="..." height="..." />`.
- `priority` для LCP-зображення (головний банер).
- `NgOptimizedImage` не працює з inline base64.
