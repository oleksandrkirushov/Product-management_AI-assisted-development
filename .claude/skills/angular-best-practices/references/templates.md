# Templates

## Control flow

```html
@if (user(); as user) {
  <app-avatar [user]="user" />
} @else {
  <a routerLink="/login">Sign in</a>
}

@for (item of items(); track item.id) {
  <app-item [item]="item" />
} @empty {
  <p>The list is empty</p>
}

@switch (status()) {
  @case ('loading') { <app-spinner /> }
  @case ('error') { <app-error /> }
  @default { <app-content /> }
}
```

- Use `@if` / `@for` / `@switch`, not `*ngIf` / `*ngFor` / `ngSwitch`.
- In `@for` **always** specify `track` by a stable identifier (`item.id`). `track $index` — only for static lists.
- `@let` — for local variables in the template instead of repeated signal reads.

## Bindings

- `[class.active]="isActive()"` and `[style.width.px]="width()"` instead of `ngClass` / `ngStyle`.
- Self-closing tags for components: `<app-item />`.
- Don't call methods in the template (`{{ getTotal() }}`) — move it to `computed()`. Reading signals (`total()`) is fine.
- Don't write complex logic in the template — move ternary chains, filtering, etc. into `computed()`.
- For Observables in the template — the `async` pipe or (better) `toSignal()` in the class.

## Deferred loading

```html
@defer (on viewport) {
  <app-heavy-chart [data]="data()" />
} @placeholder {
  <div class="chart-skeleton"></div>
} @loading (minimum 300ms) {
  <app-spinner />
}
```

- `@defer` — for heavy components below the fold, in tabs, in modals.
- Triggers: `on viewport`, `on interaction`, `on idle` (default), `when condition()`.

## Images

- Static images — `NgOptimizedImage`: `<img ngSrc="..." width="..." height="..." />`.
- `priority` for the LCP image (main banner).
- `NgOptimizedImage` doesn't work with inline base64.
