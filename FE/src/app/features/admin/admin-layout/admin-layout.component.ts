import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatListItem, MatListItemIcon, MatListItemTitle, MatNavList } from '@angular/material/list';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';

/**
 * Icons available in the self-hosted Material Symbols subset (`public/fonts/`, list in `src/styles.scss`).
 * Add a new icon here only after updating the font, otherwise text will be shown instead of it.
 */
type AdminNavIcon = 'block' | 'check_circle' | 'close' | 'delete' | 'group' | 'more_vert';

/** Admin sidebar navigation item. UI configuration of the layout, not a domain model. */
interface AdminNavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: AdminNavIcon;
}

/** A new admin subpage is added as a single element of this array. */
const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { label: 'Users', path: '/admin/users', icon: 'group' },
];

@Component({
  selector: 'app-admin-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavContainer,
    MatSidenav,
    MatSidenavContent,
    MatNavList,
    MatListItem,
    MatListItemIcon,
    MatListItemTitle,
    MatIcon,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  protected readonly navItems = ADMIN_NAV_ITEMS;
}
