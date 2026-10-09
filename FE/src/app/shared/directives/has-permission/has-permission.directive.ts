import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '@features/services/auth.service';

/**
 * Structural directive that renders its template only when the current user
 * holds the given permission (exact match or wildcard, see
 * `AuthService.hasPermission`).
 *
 * @example
 * <button *appHasPermission="'products:create'">Create</button>
 */
@Directive({
  selector: '[appHasPermission]',
})
export class HasPermission {
  private readonly authService = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainerRef = inject(ViewContainerRef);

  readonly appHasPermission = input.required<string>();

  private hasView = false;

  constructor() {
    effect(() => {
      const permission = this.appHasPermission();
      const allowed = this.authService.hasPermission(permission);

      if (allowed && !this.hasView) {
        this.viewContainerRef.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainerRef.clear();
        this.hasView = false;
      }
    });
  }
}
