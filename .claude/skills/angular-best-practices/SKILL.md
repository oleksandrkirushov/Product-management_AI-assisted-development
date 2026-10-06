---
name: angular-best-practices
description: Сучасні best practices Angular (v20+) — standalone-компоненти, signals, OnPush, вбудований control flow (@if/@for/@defer), inject(), lazy loading, typed reactive forms, httpResource, тестування, доступність і структура проєкту. Використовуй щоразу, коли пишеш, змінюєш або рев'юїш Angular-код — компоненти, сервіси, директиви, пайпи, роутинг, форми, HTTP, тести.
---

# Angular best practices

## Перед початком роботи
1. Перевір версію Angular у `package.json` (`@angular/core`) і налаштування в `angular.json`.
   Правила нижче розраховані на Angular 20+. Якщо версія старша — не використовуй API, яких у ній ще немає.
2. Подивись, як уже написаний сусідній код. **Існуючі конвенції проєкту мають пріоритет** над цим скілом
   (наприклад, суфікси файлів, тест-раннер, state-менеджер).
3. Генеруй каркаси через Angular CLI: `npx ng generate component|service|guard|pipe|directive ...`.

## Ключові правила (коротко)

### TypeScript
- Strict mode. Без `any` — використовуй `unknown` + звуження типів.
- Покладайся на виведення типів, якщо тип очевидний.

### Компоненти → [references/components.md](references/components.md)
- Тільки standalone. **Не пиши `standalone: true`** — це дефолт з v19.
- OnPush: в Angular 22+ це стратегія за замовчуванням — **не вказуй `changeDetection`**.
  У версіях до 22 завжди додавай `changeDetection: ChangeDetectionStrategy.OnPush`.
  `ChangeDetectionStrategy.Eager` не використовуй.
- `input()`, `input.required()`, `output()`, `model()` замість декораторів `@Input`/`@Output`.
- `viewChild()`/`contentChild()` замість `@ViewChild`/`@ContentChild`.
- Host-біндинги — в об'єкті `host` декоратора, а не `@HostBinding`/`@HostListener`.
- Маленькі, з однією відповідальністю; розділяй smart (контейнер) і presentational.

### Шаблони → [references/templates.md](references/templates.md)
- Вбудований control flow: `@if`, `@for` (з обов'язковим `track`), `@switch`. Не `*ngIf`/`*ngFor`.
- `[class.x]` / `[style.x]` замість `ngClass` / `ngStyle`.
- Жодної складної логіки й викликів методів у шаблоні — лише signals і `computed()`.
- `@defer` для важких частин сторінки нижче першого екрана.
- `NgOptimizedImage` (`ngSrc`) для статичних зображень.

### Стан і signals → [references/signals-state.md](references/signals-state.md)
- Локальний стан — `signal()`, похідний — `computed()`.
- Змінюй стан через `set()`/`update()`, ніколи не мутуй об'єкти всередині сигналу.
- `effect()` — лише для side effects (логування, localStorage, DOM), **не** для синхронізації стану.
- Для асинхронних даних — `resource()`/`httpResource()` або RxJS + `toSignal()`.

### Сервіси, DI, HTTP → [references/services-http.md](references/services-http.md)
- `inject()` замість constructor injection.
- `providedIn: 'root'` для singleton-сервісів.
- Функціональні interceptors (`withInterceptors`), `provideHttpClient(withFetch())`.

### Роутинг → [references/routing.md](references/routing.md)
- Lazy loading фіч: `loadComponent` / `loadChildren`.
- Функціональні guards і resolvers (`CanActivateFn`, `ResolveFn`).

### Форми → [references/forms.md](references/forms.md)
- Typed reactive forms (`NonNullableFormBuilder`) замість template-driven для нетривіальних форм.

### Тестування → [references/testing.md](references/testing.md)
- Тестуй поведінку через DOM, а не приватні методи.
- Сигнальні inputs — через `fixture.componentRef.setInput()`.

### Продуктивність і доступність → [references/performance-a11y.md](references/performance-a11y.md)
- Код має проходити перевірки AXE і відповідати WCAG AA.
- Zoneless + OnPush + signals; lazy routes; `@defer`.

### Структура проєкту → [references/project-structure.md](references/project-structure.md)
- Організація за фічами, а не за типами файлів.
- Один компонент/сервіс на файл; `kebab-case` імена файлів.

## Чеклист перед завершенням задачі
- [ ] `npx ng build` проходить без помилок і нових warnings.
- [ ] Тести для нового/зміненого коду написані й проходять (`npm run test:ci`, правила — скіл `test-karma-jasmine`).
- [ ] Лінтер чистий (`npx ng lint`, якщо налаштований).
- [ ] Немає `any`, `*ngIf`/`*ngFor`, `@Input`/`@Output`, constructor injection у новому коді.
- [ ] Жоден новий компонент не використовує `Eager` (а в Angular < 22 кожен має явний `OnPush`).
- [ ] Інтерактивні елементи доступні з клавіатури та мають доступні назви.
