import { Routes } from '@angular/router';

export const LIST_ROUTES: Routes = [
  {
    path: '',
    title: 'Product list',
    loadComponent: () => import('./list').then((m) => m.List),
  },
];
