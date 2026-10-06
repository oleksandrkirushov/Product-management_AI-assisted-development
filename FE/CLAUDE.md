# Products Audit — FE

Фронтенд на Angular 22 (standalone, zoneless, strict, SCSS, Vitest).
Усі команди нижче виконуються з папки `FE/`.

## Оточення
- Node.js 22 (версія в `.nvmrc`). Перед роботою: `nvm use`.
  Системний Node 20 не підходить — Angular CLI 22 вимагає Node ≥ 22.22.3.

## Команди
- `npm start` — dev-сервер на http://localhost:4200
- `npm run build` — production-збірка в `FE/dist/products-audit`
- `npm test -- --watch=false` — юніт-тести (Vitest)
- `npx ng generate component features/<feature>/<name>` — новий компонент

## Структура
- `src/app/core/` — singleton-сервіси, interceptors, guards, layout
- `src/app/shared/` — перевикористовувані UI-компоненти, pipes, directives
- `src/app/features/` — фічі (кожна зі своїми `*.routes.ts`, lazy loading)
- `src/environments/` — конфігурація оточень

Path aliases (`tsconfig.json`): `@core/*`, `@shared/*`, `@features/*`, `@env/*`.
Використовуй їх замість відносних імпортів між цими папками.
