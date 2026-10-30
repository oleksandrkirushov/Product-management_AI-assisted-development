# Project structure

## Organization by feature

```
src/app/
├── app.component.ts / app.component.html / app.config.ts / app.routes.ts
├── core/                    # app-wide singletons
│   ├── guards/              #   auth.guard.ts, admin.guard.ts
│   ├── interceptors/        #   auth.interceptor.ts
│   ├── utils/               #   http-error.ts
│   └── layout/              #   header, footer, shell
├── shared/                  # reusable presentational components, pipes, directives, utils
│   ├── ui/
│   └── pipes/
└── features/
    ├── models/              # data models for all features: product.ts, order.ts
    ├── services/            # data services for all features: product.service.ts (+ .spec.ts)
    │   └── mocks/           # mock data for services: mock-products.ts
    └── list/                # a feature — UI only
        ├── list.routes.ts
        └── list.component.ts/.html/.scss/.spec.ts

features/auth/
├── login/                   # each component lives in its own folder
│   └── login.component.ts/.html/.scss/.spec.ts
└── register/
    └── register.component.ts/.html/.scss/.spec.ts
```

- Group by **feature (domain)**, not by type (`components/`, `services/`).
- A feature doesn't import internal files of another feature. Shared things move to `shared/` or `core/`.
- `shared/` doesn't depend on `features/`.
- **Models** (interfaces for entities and API responses) live only in `features/models/`, one file per entity.
  Import via the alias `@features/models/<name>`.
- **Data services** (API services, stores, services with mocks) live only in `features/services/`, mocks in `features/services/mocks/`.
  Import via the alias `@features/services/<name>`. App-level services (auth, interceptors) go in `core/`.
- **A feature folder is UI only:** components, templates, styles, their tests and `*.routes.ts`.
  Don't create `models/`, `services/` or `data/` inside a feature.

## Naming

- **Each component lives in its own folder** inside the feature, named the same as the component itself
  (`auth/register/register.component.ts/.html/.scss/.spec.ts`, not `auth/register.component.ts` next to other
  feature files).
- Files are `kebab-case`. One component / service / directive per file.
- The test sits next to the file: `product-card.component.spec.ts`.
- **Components** (project rule) — files `<name>.component.ts/.html/.scss/.spec.ts`, class `<Name>Component`:
  `product-card.component.ts` → `ProductCardComponent`. `ng generate component` creates exactly this
  (`"type": "component"` in the schematics in `angular.json`).
- For other (non-component) files — a role suffix after a dot: `auth.guard.ts`, `auth.interceptor.ts`, `has-permission.directive.ts`.
- **Data service files** in `features/services/` — `<service-name>.service.ts` (+ `.service.spec.ts`), a dot before
  the suffix, not a hyphen: `auth.service.ts`, `product.service.ts`, `user.service.ts`. The class keeps its suffix unchanged
  (`AuthService`, `ProductService`), only the file is renamed.
- Selector prefix — from `angular.json` (`app-` by default).

## Configuration

- `tsconfig.json`: `"strict": true`, `strictTemplates: true` in `angularCompilerOptions`.
- Path aliases (`@core/*`, `@shared/*`, `@features/*`) instead of deep `../../../`.
- Environment variables go in `environments/`, we don't commit secrets to the repository.
