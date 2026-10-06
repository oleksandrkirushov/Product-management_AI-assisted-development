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
    ├── models/              # моделі даних усіх фіч: product.ts, order.ts
    ├── services/            # сервіси даних усіх фіч: product-service.ts (+ .spec.ts)
    │   └── mocks/           # мокові дані для сервісів: mock-products.ts
    └── list/                # фіча — лише UI
        ├── list.routes.ts
        └── list.ts/.html/.scss/.spec.ts
```

- Групуй за **фічами (доменом)**, а не за типом (`components/`, `services/`).
- Фіча не імпортує внутрішні файли іншої фічі. Спільне — переносимо в `shared/` або `core/`.
- `shared/` не залежить від `features/`.
- **Моделі** (інтерфейси сутностей і відповідей API) — лише в `features/models/`, по одному файлу на сутність.
  Імпорт — через alias `@features/models/<name>`.
- **Сервіси даних** (API-сервіси, стори, сервіси з моками) — лише в `features/services/`, моки — у `features/services/mocks/`.
  Імпорт — через alias `@features/services/<name>`. Сервіси рівня застосунку (auth, interceptors) — у `core/`.
- **Папка фічі — лише UI:** компоненти, шаблони, стилі, їхні тести та `*.routes.ts`.
  Не створюй у фічі `models/`, `services/` чи `data/`.

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
