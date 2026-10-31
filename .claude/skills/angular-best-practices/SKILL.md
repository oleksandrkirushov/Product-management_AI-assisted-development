---
name: angular-best-practices
description: Modern Angular (v20+) best practices — standalone components, signals, OnPush, built-in control flow (@if/@for/@defer), inject(), lazy loading, typed reactive forms, httpResource, testing, accessibility and project structure. Use every time you write, change or review Angular code — components, services, directives, pipes, routing, forms, HTTP, tests.
---

# Angular best practices

## Before you start
1. Check the Angular version in `package.json` (`@angular/core`) and the settings in `angular.json`.
   The rules below target Angular 20+. If the version is older — don't use APIs it doesn't have yet.
2. Look at how the neighboring code is already written. **Existing project conventions take precedence** over this skill
   (for example, file suffixes, test runner, state manager).
3. Generate scaffolds with the Angular CLI: `npx ng generate component|service|guard|pipe|directive ...`.

## Key rules (summary)

### TypeScript
- Strict mode. No `any` — use `unknown` + type narrowing.
- Rely on type inference when the type is obvious.

### Components → [references/components.md](references/components.md)
- Standalone only. **Don't write `standalone: true`** — it's the default since v19.
- OnPush: in Angular 22+ it's the default strategy — **don't specify `changeDetection`**.
  In versions before 22 always add `changeDetection: ChangeDetectionStrategy.OnPush`.
  Don't use `ChangeDetectionStrategy.Eager`.
- `input()`, `input.required()`, `output()`, `model()` instead of the `@Input`/`@Output` decorators.
- `viewChild()`/`contentChild()` instead of `@ViewChild`/`@ContentChild`.
- Host bindings go in the decorator's `host` object, not `@HostBinding`/`@HostListener`.
- Small, single-responsibility; separate smart (container) and presentational components.

### Templates → [references/templates.md](references/templates.md)
- Built-in control flow: `@if`, `@for` (with a mandatory `track`), `@switch`. Not `*ngIf`/`*ngFor`.
- `[class.x]` / `[style.x]` instead of `ngClass` / `ngStyle`.
- No complex logic or method calls in the template — only signals and `computed()`.
- `@defer` for heavy parts of the page below the fold.
- `NgOptimizedImage` (`ngSrc`) for static images.

### State and signals → [references/signals-state.md](references/signals-state.md)
- Local state — `signal()`, derived state — `computed()`.
- Change state via `set()`/`update()`, never mutate objects inside a signal.
- `effect()` — only for side effects (logging, localStorage, DOM), **not** for state synchronization.
- For async data — `resource()`/`httpResource()` or RxJS + `toSignal()`.

### Services, DI, HTTP → [references/services-http.md](references/services-http.md)
- `inject()` instead of constructor injection.
- `providedIn: 'root'` for singleton services.
- Functional interceptors (`withInterceptors`), `provideHttpClient(withFetch())`.

### Routing → [references/routing.md](references/routing.md)
- Lazy loading of features: `loadComponent` / `loadChildren`.
- Functional guards and resolvers (`CanActivateFn`, `ResolveFn`).

### Forms → [references/forms.md](references/forms.md)
- Typed reactive forms (`NonNullableFormBuilder`) instead of template-driven for non-trivial forms.

### Testing → [references/testing.md](references/testing.md)
- Test behavior through the DOM, not private methods.
- Signal inputs — via `fixture.componentRef.setInput()`.

### Performance and accessibility → [references/performance-a11y.md](references/performance-a11y.md)
- Code must pass AXE checks and meet WCAG AA.
- Zoneless + OnPush + signals; lazy routes; `@defer`.

### Styles
- Global partials live in `src/styles/` (see the "Styles" section of `FE/CLAUDE.md`). Reuse global classes
  (`.form-input`, `.submit-button`, `.error-banner`, `.auth-page`, `.page-header` …) and mixins instead of copying blocks.
  A block goes global when it is reused in ≥2 components or is a generic form/alert/layout/utility primitive.
- Component `.scss`: `@use 'variables' as vars;` / `@use 'mixins';`; no hex/rgba and no raw sizes, durations or weights —
  only `vars.*` tokens (or `var(--mat-sys-*)` on Material screens). A missing value becomes a new token in `_variables.scss`.

### Project structure → [references/project-structure.md](references/project-structure.md)
- Organize by feature, not by file type.
- One component/service per file; `kebab-case` file names.

## Checklist before finishing a task
- [ ] `npx ng build` passes with no errors and no new warnings.
- [ ] Tests for new/changed code are written and pass (`npm run test:ci`, rules — the `test-karma-jasmine` skill).
- [ ] The linter is clean (`npx ng lint`, if configured).
- [ ] No `any`, `*ngIf`/`*ngFor`, `@Input`/`@Output`, constructor injection in new code.
- [ ] No new component uses `Eager` (and in Angular < 22 each one has an explicit `OnPush`).
- [ ] Interactive elements are keyboard accessible and have accessible names.
