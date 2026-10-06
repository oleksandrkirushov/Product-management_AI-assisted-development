# Структура проєкту

## Організація за фічами

```
src/app/
├── app.ts / app.html / app.config.ts / app.routes.ts
├── core/                    # singleton-речі на весь застосунок
│   ├── auth/                #   auth-store.ts, auth-guard.ts, auth-interceptor.ts
│   ├── http/                #   error-interceptor.ts, api-url.token.ts
│   └── layout/              #   header, footer, shell
├── shared/                  # перевикористовувані presentational компоненти, pipes, directives, utils
│   ├── ui/
│   └── pipes/
└── features/
    └── products/
        ├── products.routes.ts
        ├── data/            # product-api.ts, product-store.ts
        ├── models/          # product.ts
        ├── product-list/    # product-list-page.ts/.html/.scss/.spec.ts
        └── product-card/
```

- Групуй за **фічами (доменом)**, а не за типом (`components/`, `services/`).
- Фіча не імпортує внутрішні файли іншої фічі. Спільне — переносимо в `shared/` або `core/`.
- `shared/` не залежить від `features/`.

## Іменування

- Файли — `kebab-case`. Один компонент / сервіс / директива на файл.
- Тест — поруч із файлом: `product-card.spec.ts`.
- Style guide Angular (v20+) рекомендує імена без суфіксів типу: `product-card.ts` з класом `ProductCard`.
  Якщо проєкт уже використовує суфікси (`product-card.component.ts`, `ProductCardComponent`) — тримайся існуючого стилю.
- Суфікс за роллю, коли він додає сенс: `product-api.ts`, `cart-store.ts`, `auth-guard.ts`, `product-list-page.ts`.
- Префікс селектора — з `angular.json` (`app-` за замовчуванням).

## Конфігурація

- `tsconfig.json`: `"strict": true`, `strictTemplates: true` у `angularCompilerOptions`.
- Path aliases (`@core/*`, `@shared/*`, `@features/*`) замість глибоких `../../../`.
- Змінні оточення — в `environments/`, секрети в репозиторій не комітимо.
