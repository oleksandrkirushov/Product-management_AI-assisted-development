import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@features/services/auth.service';

const ADMIN_PERMISSION = 'users:read';

/**
 * Protects the admin area: anonymous users go to the login page,
 * signed-in users without the admin permission go back to the products list.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (!authService.hasPermission(ADMIN_PERMISSION)) {
    return router.createUrlTree(['/products']);
  }

  return true;
};
