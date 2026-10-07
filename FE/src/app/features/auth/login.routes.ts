import { Routes } from '@angular/router';

export const LOGIN_ROUTES: Routes = [
  {
    path: '',
    title: 'Login',
    loadComponent: () => import('./login').then((m) => m.Login),
  },
];
