import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'products',
    loadChildren: () => import('@features/list/list.routes').then((m) => m.LIST_ROUTES),
  },
  { path: '**', redirectTo: 'products' },
];
