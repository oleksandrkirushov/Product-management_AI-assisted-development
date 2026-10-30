# Routing

## Configuration

```ts
// app.config.ts
provideRouter(routes, withComponentInputBinding(), withViewTransitions())

// app.routes.ts
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home-page/home-page.component').then(m => m.HomePageComponent), title: 'Home' },
  {
    path: 'admin',
    canMatch: [adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  { path: '**', loadComponent: () => import('./shared/not-found/not-found-page/not-found-page.component').then(m => m.NotFoundPageComponent) },
];
```

## Rules

- **Lazy loading for every feature:** `loadComponent` for a single page, `loadChildren` for a group of feature routes.
- **Functional guards and resolvers:**
  ```ts
  export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthStore);
    return auth.isLoggedIn() || inject(Router).createUrlTree(['/login']);
  };
  ```
  Return a `UrlTree` for redirects instead of calling `router.navigate()` inside a guard.
- `canMatch` — so that an inaccessible module isn't even loaded.
- **Route parameters as inputs:** with `withComponentInputBinding()`, `:id` params, query params and resolver data arrive in the page component's `input()`.
- Set a `title` for every route (accessibility and SEO).
- Navigation in the template — `routerLink`, not `(click)` + `router.navigate()`.
