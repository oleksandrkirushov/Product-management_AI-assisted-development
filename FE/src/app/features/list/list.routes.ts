import { Routes } from '@angular/router';

export const LIST_ROUTES: Routes = [
  {
    path: '',
    title: 'Product list',
    loadComponent: () => import('./list').then((m) => m.List),
  },
  {
    path: 'new',
    title: 'Add product',
    loadComponent: () => import('@features/product-form/product-form').then((m) => m.ProductForm),
  },
];
