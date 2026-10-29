# Структура проєкту

## Організація за фічами

```
src/app/
├── app.component.ts / app.component.html / app.config.ts / app.routes.ts
├── core/                    # singleton-речі на весь застосунок
│   ├── guards/              #   auth.guard.ts, admin.guard.ts
│   ├── interceptors/        #   auth.interceptor.ts
│   ├── utils/               #   http-error.ts
│   └── layout/              #   header, footer, shell
├── shared/                  # перевикористовувані presentational компоненти, pipes, directives, utils
│   ├── ui/
│   └── pipes/
└── features/
    ├── models/              # моделі даних усіх фіч: product.ts, order.ts
    ├── services/            # сервіси даних усіх фіч: product.service.ts (+ .spec.ts)
    │   └── mocks/           # мокові дані для сервісів: mock-products.ts
    └── list/                # фіча — лише UI
        ├── list.routes.ts
        └── list.component.ts/.html/.scss/.spec.ts

features/auth/
├── login/                   # кожен компонент — у власній папці
│   └── login.component.ts/.html/.scss/.spec.ts
└── register/
    └── register.component.ts/.html/.scss/.spec.ts
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

- **Кожен компонент — у власній папці** всередині фічі, названій так само, як сам компонент
  (`auth/register/register.component.ts/.html/.scss/.spec.ts`, а не `auth/register.component.ts` поруч з іншими
  файлами фічі).
- Файли — `kebab-case`. Один компонент / сервіс / директива на файл.
- Тест — поруч із файлом: `product-card.component.spec.ts`.
- **Компоненти** (правило проєкту) — файли `<name>.component.ts/.html/.scss/.spec.ts`, клас `<Name>Component`:
  `product-card.component.ts` → `ProductCardComponent`. `ng generate component` створює саме так
  (`"type": "component"` у schematics в `angular.json`).
- Для інших (не компонентів) файлів — суфікс за роллю через крапку: `auth.guard.ts`, `auth.interceptor.ts`, `has-permission.directive.ts`.
- **Файли сервісів даних** у `features/services/` — `<назва-сервісу>.service.ts` (+ `.service.spec.ts`), крапка перед
  суфіксом, а не дефіс: `auth.service.ts`, `product.service.ts`, `user.service.ts`. Клас лишається без зміни суфікса
  (`AuthService`, `ProductService`), перейменовується лише файл.
- Префікс селектора — з `angular.json` (`app-` за замовчуванням).

## Конфігурація

- `tsconfig.json`: `"strict": true`, `strictTemplates: true` у `angularCompilerOptions`.
- Path aliases (`@core/*`, `@shared/*`, `@features/*`) замість глибоких `../../../`.
- Змінні оточення — в `environments/`, секрети в репозиторій не комітимо.
