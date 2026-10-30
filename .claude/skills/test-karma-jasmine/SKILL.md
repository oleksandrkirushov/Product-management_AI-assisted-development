---
name: test-karma-jasmine
description: Covering Angular code in FE/ with Karma + Jasmine unit tests — components, directives, pipes, forms, services, signal stores, HttpClient, httpResource, interceptors, guards, routing, timers and debounce in a zoneless app, coverage report and thresholds. Use when you need to write, extend or fix *.spec.ts files, cover code with tests, raise coverage or investigate a failing test.
---

# Unit tests: Karma + Jasmine

## Project environment
- Tests live next to the code: `product-card.component.ts` → `product-card.component.spec.ts`.
- Runner: `@angular/build:unit-test` with `runner: "karma"` (see `FE/angular.json`), config — `FE/karma.conf.js`.
- The app is **zoneless — zone.js is not installed**. Because of this:
  - ❌ `fakeAsync`, `tick`, `flush`, `waitForAsync` **don't work** (they fail with `zone-testing.js is needed`);
  - ✅ async — `async/await` + `await fixture.whenStable()`;
  - ✅ timers — `jasmine.clock()` (+ `mockDate()` for RxJS `debounceTime`/`delay`);
  - ✅ effects — `TestBed.tick()`.

Commands (from the `FE/` folder, after `nvm use`):

| What | Command |
|---|---|
| All tests once, headless | `npm run test:ci` |
| Tests of one file / folder | `npm run test:ci -- --include app/features/products` |
| Filter by `describe`/`it` name | `npm run test:ci -- --filter "^ProductCardComponent"` |
| Coverage + threshold check | `npm run test:coverage` → report `FE/coverage/products-audit/index.html` |
| Watch mode in Chrome (for humans) | `npm test` |

Coverage thresholds (in `karma.conf.js`): statements 80%, branches 70%, functions 80%, lines 80%.

`test:coverage` prints a per-file table with an `Uncovered Line #s` column — it shows which lines are not covered.
**Files that no test imports don't appear in the report at all.** So look for files without a `.spec.ts` separately.

## Workflow
1. **Read the code** you are covering and its dependencies. Check whether a spec file already exists — extend it rather than creating a new one.
2. **List the scenarios** before writing code: main scenario; boundary values; empty state; error
   (HTTP 4xx/5xx, invalid data); loading state; every `@if`/`if` branch.
3. **Write the tests** following the template for your type of code (table below).
4. **Run** only your tests: `npm run test:ci -- --include <path>`. Make sure the new test **can fail**:
   temporarily break the expectation — if the test stays green, it verifies nothing.
5. **Check coverage**: `npm run test:coverage`. Look at uncovered lines and branches in the HTML report.
6. At the end — a full `npm run test:ci` run: all tests green, thresholds met.

## Templates by type of code

| What you test | Reference |
|---|---|
| Component (inputs, outputs, DOM, host), directive, pipe | [references/components.md](references/components.md) |
| Reactive forms | [references/forms.md](references/forms.md) |
| Service / signal store, HttpClient, interceptor | [references/services-http.md](references/services-http.md) |
| Guard, route parameters, page with `httpResource` | [references/routing.md](references/routing.md) |
| Timers, debounce, effects, `whenStable` | [references/async.md](references/async.md) |
| Jasmine matchers and spies | [references/jasmine-cheatsheet.md](references/jasmine-cheatsheet.md) |

## Rules

**What to test**
- Public behavior: what the user sees (DOM), what the component emits (outputs), what the service returns / which requests it sends.
- Don't test private methods, implementation details, Angular itself (that `@if` works) or styles.
- One `it` — one scenario. The name describes behavior: `should <result> when <condition>`.
- Test body structure — Arrange / Act / Assert, separated by a blank line.

**How to test**
- Signal inputs — only `fixture.componentRef.setInput('name', value)`, then `await fixture.whenStable()`.
- Interaction — through the DOM: `button.click()`, `input.value = ...; input.dispatchEvent(new Event('input'))`.
- Outputs — `fixture.componentInstance.someOutput.subscribe(...)`, collect values into an array.
- Directives — through a test host component in the spec file.
- Pure pipes and functions — without TestBed: `new TruncatePipe().transform(...)`.
- Dependencies — via DI: `{ provide: ProductApi, useValue: spy }` with `jasmine.createSpyObj<ProductApi>(...)`.
  Don't patch prototypes and don't mock what you are testing.
- HTTP — only via `provideHttpClientTesting()` + `HttpTestingController`; in `afterEach` — `httpMock.verify()`.
  No real requests in tests.
- Get `providedIn: 'root'` services via `TestBed.inject()`, not `new` — otherwise `inject()` won't work.
- Functional guards / resolvers — inside `TestBed.runInInjectionContext(() => guard(...))`.

**Quality**
- Each test is independent: Jasmine runs tests in **random order**. Prepare state in `beforeEach`, with no shared variables that tests modify.
- No `any`. To find elements — `querySelector<HTMLButtonElement>(...)` and a helper that throws if the element is missing
  (otherwise `?.click()` silently does nothing and the test "passes").
- Never commit `fdescribe` / `fit` (they run only those) or `xdescribe` / `xit` (they disable tests).
- Don't adjust expectations to the current result. If a test reveals a bug — report it rather than "fixing" the test.
- Don't lower the thresholds in `karma.conf.js` to pass the check.

## Checklist before finishing
- [ ] The main scenario, edge cases, errors and empty states are covered.
- [ ] No `fakeAsync` / `tick` / `waitForAsync`, `fdescribe` / `fit`, `xdescribe` / `xit`, `any`.
- [ ] HTTP tests have `httpMock.verify()` in `afterEach`.
- [ ] `jasmine.clock().install()` is always paired with `uninstall()` in `afterEach`.
- [ ] `npm run test:ci` — all tests green.
- [ ] `npm run test:coverage` — thresholds met, new code covered.
