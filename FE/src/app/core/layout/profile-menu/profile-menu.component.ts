import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@features/models/user';
import { AuthService } from '@features/services/auth.service';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';

let nextPanelId = 0;

@Component({
  imports: [AvatarComponent],
  selector: 'app-profile-menu',
  styleUrl: './profile-menu.component.scss',
  templateUrl: './profile-menu.component.html',
})
export class ProfileMenuComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = input.required<User>();

  protected readonly panelId = `profile-menu-panel-${nextPanelId++}`;

  protected readonly displayName = computed(() => {
    const { firstName, lastName, username } = this.user();
    return [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(' ') || username;
  });

  protected readonly triggerLabel = computed(() => `Account: ${this.displayName()}`);

  protected readonly roles = computed(() => this.user().roles.join(', '));

  protected logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
