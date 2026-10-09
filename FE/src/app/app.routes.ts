import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'login',
    loadComponent: () => import('@features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () => import('@features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'products',
    canActivate: [authGuard],
    loadChildren: () => import('@features/list/list.routes').then((m) => m.LIST_ROUTES),
  },
  { path: '**', redirectTo: 'products' },
];
