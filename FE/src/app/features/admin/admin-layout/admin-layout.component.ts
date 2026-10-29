import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatListItem, MatListItemIcon, MatListItemTitle, MatNavList } from '@angular/material/list';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';

/**
 * Іконки, наявні в self-hosted підмножині Material Symbols (`public/fonts/`, список — у `src/styles.scss`).
 * Нову іконку додавай сюди лише після оновлення шрифту, інакше замість неї буде текст.
 */
type AdminNavIcon = 'block' | 'check_circle' | 'close' | 'delete' | 'group' | 'more_vert';

/** Пункт бічної навігації адмінки. UI-конфігурація layout-у, а не доменна модель. */
interface AdminNavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: AdminNavIcon;
}

/** Нова підсторінка адмінки додається одним елементом цього масиву. */
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
