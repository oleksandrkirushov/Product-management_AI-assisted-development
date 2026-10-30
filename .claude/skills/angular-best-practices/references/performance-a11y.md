# Performance and accessibility

## Performance

- **Zoneless change detection** (the default in new Angular 21+ projects; in older ones — `provideZonelessChangeDetection()`).
  Code must update correctly without Zone.js: state in signals, OnPush, no relying on `setTimeout` to update the view.
- **OnPush** on all components (the default in Angular 22+; don't switch to `Eager`).
- **Lazy routes** for every feature, `@defer` for heavy blocks.
- `track` by a stable id in every `@for`.
- No method calls in templates — `computed()` memoizes.
- `NgOptimizedImage` for images, `priority` for the LCP image.
- Watch the **budgets** in `angular.json`; don't import whole libraries (`import _ from 'lodash'`) — only the functions you need or native equivalents.
- Heavy computations — in a Web Worker (`ng generate web-worker`).
- SSR / hydration — if configured in the project: don't access `window`/`document` outside `afterNextRender()`; use `withIncrementalHydration()` together with `@defer (hydrate on ...)`.

## Accessibility (WCAG 2.2 AA)

Code must pass automated AXE checks and meet WCAG AA.

- **Semantic HTML:** `<button>` for actions, `<a routerLink>` for navigation, `<nav>`, `<main>`, `<header>`, `h1–h6` headings in order.
  Don't use `<div (click)>`.
- **Keyboard:** everything interactive is reachable via Tab, visible focus (`:focus-visible`), no focus traps.
- **Accessible names:** icon buttons have `aria-label`; images have a meaningful `alt` (or `alt=""` for decorative ones).
- **Forms:** a `<label>` for every field, errors via `aria-describedby` / `role="alert"`.
- **Contrast:** text ≥ 4.5:1, large text and UI elements ≥ 3:1.
- **Dynamic content:** `LiveAnnouncer` from `@angular/cdk/a11y` to announce changes.
- **Modals and menus:** `FocusTrap` / CDK Overlay / Angular Aria; return focus after closing.
- **Routes:** a unique `title` for every page.
- Don't use ARIA where a native element is enough.
