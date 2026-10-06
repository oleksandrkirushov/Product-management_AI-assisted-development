---
name: test-karma-jasmine
description: Покриття Angular-коду у FE/ юніт-тестами на Karma + Jasmine — компоненти, директиви, пайпи, форми, сервіси, signals-стори, HttpClient, httpResource, interceptors, guards, роутинг, таймери й debounce у zoneless-застосунку, звіт покриття і пороги. Використовуй, коли треба написати, доповнити чи виправити *.spec.ts, покрити код тестами, підняти покриття або розібратися з тестом, що падає.
---

# Unit-тести: Karma + Jasmine

## Оточення проєкту
- Тести лежать поруч із кодом: `product-card.ts` → `product-card.spec.ts`.
- Раннер: `@angular/build:unit-test` з `runner: "karma"` (див. `FE/angular.json`), конфіг — `FE/karma.conf.js`.
- Застосунок **zoneless — zone.js не встановлено**. Через це:
  - ❌ `fakeAsync`, `tick`, `flush`, `waitForAsync` **не працюють** (падають з `zone-testing.js is needed`);
  - ✅ асинхронність — `async/await` + `await fixture.whenStable()`;
  - ✅ таймери — `jasmine.clock()` (+ `mockDate()` для RxJS `debounceTime`/`delay`);
  - ✅ effects — `TestBed.tick()`.

Команди (з папки `FE/`, після `nvm use`):

| Що | Команда |
|---|---|
| Усі тести один раз, headless | `npm run test:ci` |
| Тести одного файлу / папки | `npm run test:ci -- --include app/features/products` |
| Фільтр за назвою `describe`/`it` | `npm run test:ci -- --filter "^ProductCard"` |
| Покриття + перевірка порогів | `npm run test:coverage` → звіт `FE/coverage/products-audit/index.html` |
| Watch-режим у Chrome (для людини) | `npm test` |

Пороги покриття (у `karma.conf.js`): statements 80%, branches 70%, functions 80%, lines 80%.

`test:coverage` друкує таблицю по файлах зі стовпчиком `Uncovered Line #s` — з неї видно, які рядки не покриті.
**Файли, які не імпортує жоден тест, у звіт не потрапляють зовсім.** Тому файли без `.spec.ts` шукай окремо.

## Порядок роботи
1. **Прочитай код**, який покриваєш, і його залежності. Перевір, чи є вже spec-файл — доповнюй його, а не створюй новий.
2. **Склади список сценаріїв** до написання коду: основний сценарій; граничні значення; порожній стан; помилка
   (HTTP 4xx/5xx, невалідні дані); стан завантаження; кожна гілка `@if`/`if`.
3. **Напиши тести** за шаблоном для свого типу коду (таблиця нижче).
4. **Запусти** тільки свої тести: `npm run test:ci -- --include <шлях>`. Переконайся, що новий тест **може впасти**:
   тимчасово зламай очікування — якщо тест далі зелений, він нічого не перевіряє.
5. **Перевір покриття**: `npm run test:coverage`. Непокриті рядки й гілки дивись у HTML-звіті.
6. Наприкінці — повний прогін `npm run test:ci`: усі тести зелені, пороги дотримано.

## Шаблони за типом коду

| Що тестуєш | Довідка |
|---|---|
| Компонент (inputs, outputs, DOM, host), директива, пайп | [references/components.md](references/components.md) |
| Reactive forms | [references/forms.md](references/forms.md) |
| Сервіс / signals-стор, HttpClient, interceptor | [references/services-http.md](references/services-http.md) |
| Guard, параметри маршруту, сторінка з `httpResource` | [references/routing.md](references/routing.md) |
| Таймери, debounce, effects, `whenStable` | [references/async.md](references/async.md) |
| Матчери й шпигуни Jasmine | [references/jasmine-cheatsheet.md](references/jasmine-cheatsheet.md) |

## Правила

**Що тестувати**
- Публічну поведінку: що бачить користувач (DOM), що компонент емітить (outputs), що сервіс повертає / які запити шле.
- Не тестуй приватні методи, деталі реалізації, сам Angular (що `@if` працює) і стилі.
- Один `it` — один сценарій. Назва описує поведінку: `should <результат> when <умова>`.
- Структура тіла тесту — Arrange / Act / Assert, розділені порожнім рядком.

**Як тестувати**
- Signal inputs — тільки `fixture.componentRef.setInput('name', value)`, потім `await fixture.whenStable()`.
- Взаємодія — через DOM: `button.click()`, `input.value = ...; input.dispatchEvent(new Event('input'))`.
- Outputs — `fixture.componentInstance.someOutput.subscribe(...)`, збирай значення в масив.
- Директиви — через тестовий host-компонент у spec-файлі.
- Чисті пайпи й функції — без TestBed: `new TruncatePipe().transform(...)`.
- Залежності — через DI: `{ provide: ProductApi, useValue: spy }` з `jasmine.createSpyObj<ProductApi>(...)`.
  Не патч прототипи і не мокай те, що тестуєш.
- HTTP — лише через `provideHttpClientTesting()` + `HttpTestingController`; в `afterEach` — `httpMock.verify()`.
  Реальних запитів у тестах немає.
- Сервіси з `providedIn: 'root'` отримуй через `TestBed.inject()`, не через `new` — інакше не спрацює `inject()`.
- Функціональні guards / resolvers — у `TestBed.runInInjectionContext(() => guard(...))`.

**Якість**
- Кожен тест незалежний: Jasmine виконує тести у **випадковому порядку**. Стан готуй у `beforeEach`, без спільних змінних, які тести змінюють.
- Без `any`. Для пошуку елементів — `querySelector<HTMLButtonElement>(...)` і хелпер, що кидає помилку, якщо елемента немає
  (інакше `?.click()` тихо нічого не зробить і тест «пройде»).
- Ніколи не комітити `fdescribe` / `fit` (запускають лише їх) і `xdescribe` / `xit` (вимикають тести).
- Не підганяй очікування під поточний результат. Якщо тест виявив баг — повідом про нього, а не «фіксуй» тест.
- Не знижуй пороги в `karma.conf.js`, щоб пройти перевірку.

## Чеклист перед завершенням
- [ ] Покриті основний сценарій, граничні випадки, помилки й порожні стани.
- [ ] Немає `fakeAsync` / `tick` / `waitForAsync`, `fdescribe` / `fit`, `xdescribe` / `xit`, `any`.
- [ ] Для HTTP є `httpMock.verify()` в `afterEach`.
- [ ] `jasmine.clock().install()` завжди парний з `uninstall()` в `afterEach`.
- [ ] `npm run test:ci` — усі тести зелені.
- [ ] `npm run test:coverage` — пороги дотримано, новий код покритий.
