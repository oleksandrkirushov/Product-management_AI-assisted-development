import { Routes } from '@angular/router';

export const LIST_ROUTES: Routes = [
  {
    path: '',
    title: 'Product list',
    loadComponent: () => import('./list.component').then((m) => m.ListComponent),
  },
  {
    path: 'new',
    title: 'Add product',
    loadComponent: () => import('@features/product-form/product-form.component').then((m) => m.ProductFormComponent),
  },
];
