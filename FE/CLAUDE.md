# Products Audit — FE

Фронтенд на Angular 22 (standalone, zoneless, strict, SCSS, Karma + Jasmine).
Усі команди нижче виконуються з папки `FE/`.

## Оточення
- Node.js 22 (версія в `.nvmrc`). Перед роботою: `nvm use`.
  Системний Node 20 не підходить — Angular CLI 22 вимагає Node ≥ 22.22.3.

## Команди
- `npm start` — dev-сервер на http://localhost:4200
- `npm run build` — production-збірка в `FE/dist/products-audit`
- `npm test` — юніт-тести в Chrome у watch-режимі (Karma + Jasmine)
- `npm run test:ci` — усі тести один раз, headless
- `npm run test:coverage` — тести + звіт покриття (`coverage/products-audit/`) і пороги з `karma.conf.js`
- `npx ng generate component features/<feature>/<name>` — новий компонент

## Тести
Застосунок zoneless (без zone.js): `fakeAsync`/`tick` не працюють — використовуй `async/await` + `fixture.whenStable()`
і `jasmine.clock()`. Правила — скіл `test-karma-jasmine`.

## Структура
- `src/app/core/` — singleton-сервіси, interceptors, guards, layout
- `src/app/shared/` — перевикористовувані UI-компоненти, pipes, directives
- `src/app/features/` — фічі (кожна зі своїми `*.routes.ts`, lazy loading)
- `src/app/features/models/` — моделі даних усіх фіч (`@features/models/<name>`)
- `src/app/features/services/` — сервіси даних усіх фіч (`@features/services/<name>`), моки — у `services/mocks/`
- Папка конкретної фічі (`features/list/`) — лише UI: компоненти, стилі, тести, `*.routes.ts`
- `src/environments/` — конфігурація оточень

Path aliases (`tsconfig.json`): `@core/*`, `@shared/*`, `@features/*`, `@env/*`.
Використовуй їх замість відносних імпортів між цими папками.

## Angular Material
- Тема — чорно-біла M3 у `src/_material-theme.scss` (`mat.theme()`). У компонентах кольори бери з `var(--mat-sys-*)`, а не hex.
- `provideAnimations*` не додавай: Material 22 не залежить від `@angular/animations`.
- Material імпортуй лише в lazy-частинах (`/admin`), щоб він не потрапив в initial bundle. `Header` та інші eager-компоненти його не використовують.
- Іконки — self-hosted підмножина Material Symbols Outlined у `public/fonts/` лише з тими іконками, що використовуються.
  Перед використанням нової іконки в `<mat-icon>` додай її ім'я в `icon_names` і заміни woff2 (інструкція — у коментарі
  в `src/styles.scss`); інакше замість іконки буде текст. `@font-face` має лишатися інлайновим у `src/index.html`
  (інакше `MatIconRegistry` не розпізнає шрифт при повільному CSS). Шрифти з CDN не підключай.
