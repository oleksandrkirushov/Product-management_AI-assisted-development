# Products Audit — FE

Angular 22 frontend (standalone, zoneless, strict, SCSS, Karma + Jasmine).
All commands below are run from the `FE/` folder.

## Environment
- Node.js 22 (version in `.nvmrc`). Before working: `nvm use`.
  The system Node 20 won't work — Angular CLI 22 requires Node ≥ 22.22.3.

## Commands
- `npm start` — dev server at http://localhost:4200
- `npm run build` — production build into `FE/dist/products-audit`
- `npm test` — unit tests in Chrome in watch mode (Karma + Jasmine)
- `npm run test:ci` — all tests once, headless
- `npm run test:coverage` — tests + coverage report (`coverage/products-audit/`) and thresholds from `karma.conf.js`
- `npx ng generate component features/<feature>/<name>` — new component

## Tests
The app is zoneless (no zone.js): `fakeAsync`/`tick` don't work — use `async/await` + `fixture.whenStable()`
and `jasmine.clock()`. Rules — the `test-karma-jasmine` skill.

## Structure
- `src/app/core/` — singleton services, interceptors, guards, layout
- `src/app/shared/` — reusable UI components, pipes, directives
- `src/app/features/` — features (each with its own `*.routes.ts`, lazy loading)
- `src/app/features/models/` — data models for all features (`@features/models/<name>`)
- `src/app/features/services/` — data services for all features (`@features/services/<name>`), mocks in `services/mocks/`
- A specific feature folder (`features/list/`) — UI only: components, styles, tests, `*.routes.ts`
- Components — each in its own folder, files `<name>.component.ts/.html/.scss/.spec.ts`, class `<Name>Component`
  (`header.component.ts` → `HeaderComponent`); `ng generate component` creates them this way (`"type": "component"` in `angular.json`)
- `src/environments/` — environment configuration

Path aliases (`tsconfig.json`): `@core/*`, `@shared/*`, `@features/*`, `@env/*`.
Use them instead of relative imports between these folders.

## Styles
- `src/styles.scss` is the entry point: `@use` of the CSS-emitting partials of `src/styles/` in this order —
  `_material-theme`, `_base`, `_icons`, `_utilities`, `_forms`, `_buttons`, `_alerts`, `_states`, `_page-layout`,
  `_auth-layout` — plus `html { @include material-theme.theme; }`.
- `_variables` (all tokens: colours, spacing, radii, fonts, shadows, transitions, breakpoints, z-index, widths) and
  `_mixins` (focus-ring, transition, reset-list, inverse-colors, card, text-link, truncate, media-down, button bases)
  emit no CSS; they are `@use`'d by partials and components. `_material-theme` emits no CSS by itself either (only the `theme` mixin).
- `src/styles` is in `stylePreprocessorOptions.includePaths` of the `build` target: components write
  `@use 'variables' as vars;` / `@use 'mixins';` (no `../../` paths). The `test` target inherits it from `build` —
  don't add it to `test` (its schema rejects the option).
- What goes where: a block reused in ≥2 components, or a generic form/alert/layout/utility primitive
  (`.required-indicator`, `.form-hint`, `.success-banner`, `.page-footer`, `.muted` …) → global class in the matching partial;
  shared shape with different classes/context → mixin; anything unique → local in the component, extending the global base.
- No raw literals in component styles: no hex/rgba, sizes/durations/weights only via `vars.*` (allowed: `0`, `1px` borders,
  `100%`, `1%`, `flex: 1`, `100vh`/`100dvh`, one-off values like `text-underline-offset`). Material screens use `var(--mat-sys-*)`.
- Need a new value — add a token to `_variables.scss` first.

## Angular Material
- The theme is a black-and-white M3 theme in `src/styles/_material-theme.scss` (`mat.theme()`). In components take colors from `var(--mat-sys-*)`, not hex.
- Don't add `provideAnimations*`: Material 22 doesn't depend on `@angular/animations`.
- Import Material only in lazy parts (`/admin`) so it doesn't end up in the initial bundle. `HeaderComponent` and other eager components don't use it.
- Icons — a self-hosted subset of Material Symbols Outlined in `public/fonts/` with only the icons that are used.
  Before using a new icon in `<mat-icon>`, add its name to `icon_names` and replace the woff2 (instructions are in the comment
  in `src/styles/_icons.scss`); otherwise text will be shown instead of the icon. `@font-face` must stay inline in `src/index.html`
  (otherwise `MatIconRegistry` won't recognize the font when CSS loads slowly). Don't load fonts from a CDN.
