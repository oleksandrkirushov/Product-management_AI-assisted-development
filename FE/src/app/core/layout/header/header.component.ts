import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ProfileMenuComponent } from '@core/layout/profile-menu/profile-menu.component';
import { AuthService } from '@features/services/auth.service';
import { HasPermission } from '@shared/directives/has-permission/has-permission.directive';

@Component({
  imports: [RouterLink, RouterLinkActive, HasPermission, ProfileMenuComponent],
  selector: 'app-header',
  styleUrl: './header.component.scss',
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);

  readonly currentUser = this.authService.currentUser;
}
