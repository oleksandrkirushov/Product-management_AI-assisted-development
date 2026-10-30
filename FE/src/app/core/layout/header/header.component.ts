import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@features/services/auth.service';
import { HasPermission } from '@shared/directives/has-permission/has-permission.directive';

@Component({
  imports: [RouterLink, RouterLinkActive, HasPermission],
  selector: 'app-header',
  styleUrl: './header.component.scss',
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  protected logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
