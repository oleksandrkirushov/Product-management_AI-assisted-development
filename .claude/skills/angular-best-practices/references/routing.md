# Роутинг

## Конфігурація

```ts
// app.config.ts
provideRouter(routes, withComponentInputBinding(), withViewTransitions())

// app.routes.ts
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home-page/home-page.component').then(m => m.HomePageComponent), title: 'Головна' },
  {
    path: 'admin',
    canMatch: [adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  { path: '**', loadComponent: () => import('./shared/not-found/not-found-page/not-found-page.component').then(m => m.NotFoundPageComponent) },
];
```

## Правила

- **Lazy loading для кожної фічі:** `loadComponent` для окремої сторінки, `loadChildren` для групи маршрутів фічі.
- **Функціональні guards і resolvers:**
  ```ts
  export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthStore);
    return auth.isLoggedIn() || inject(Router).createUrlTree(['/login']);
  };
  ```
  Повертай `UrlTree` для редиректу замість `router.navigate()` усередині guard.
- `canMatch` — щоб недоступний модуль навіть не завантажувався.
- **Параметри маршруту як inputs:** з `withComponentInputBinding()` параметри `:id`, query params і дані resolver'а приходять у `input()` компонента-сторінки.
- Задавай `title` для кожного маршруту (доступність і SEO).
- Навігація в шаблоні — `routerLink`, а не `(click)` + `router.navigate()`.
