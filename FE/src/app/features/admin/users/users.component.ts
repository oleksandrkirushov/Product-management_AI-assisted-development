import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { Observable, filter, finalize, of, switchMap } from 'rxjs';
import { getServerErrorMessage } from '@core/utils/http-error';
import { User } from '@features/models/user';
import { AuthService } from '@features/services/auth.service';
import { UserService } from '@features/services/user.service';
import { ConfirmDialogData, openConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';

/** View model of a table row: everything the template needs, precomputed. */
interface UserRow {
  readonly user: User;
  readonly position: number;
  readonly fullName: string;
  readonly roles: string;
  readonly isSelf: boolean;
  readonly isPending: boolean;
  readonly actionsLabel: string;
}

interface UserAction {
  readonly request: () => Observable<void>;
  readonly onSuccess: () => void;
  readonly successMessage: string;
  readonly failureMessage: string;
  readonly confirm?: ConfirmDialogData;
}

/** Attribute selector (safe for GUIDs, which may start with a digit) of a row's actions trigger. */
function actionsTriggerSelector(userId: string): string {
  return `[data-actions-trigger="${CSS.escape(userId)}"]`;
}

@Component({
  selector: 'app-users',
  imports: [MatButton, MatIconButton, MatIcon, MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly users = rxResource({
    stream: () => this.userService.getAll(),
  });

  private readonly pendingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly actionError = signal<string | null>(null);
  /** Announced by a visually hidden `role="status"` live region. */
  protected readonly actionStatus = signal('');

  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');

  private readonly currentUsername = computed(() => this.authService.currentUser()?.username ?? null);

  protected readonly rows = computed<UserRow[]>(() => {
    // `value()` throws while the resource is in the error state.
    const users = this.users.hasValue() ? this.users.value() : [];
    const pending = this.pendingIds();
    const currentUsername = this.currentUsername();

    return users.map((user, index) => ({
      user,
      position: index + 1,
      fullName: `${user.firstName} ${user.lastName}`,
      roles: user.roles.join(', '),
      isSelf: user.username === currentUsername,
      isPending: pending.has(user.id),
      actionsLabel: `Actions for ${user.username}`,
    }));
  });

  protected activate(user: User): void {
    this.run(user, {
      request: () => this.userService.activate(user.id),
      onSuccess: () => this.patchUser(user.id, { isActive: true }),
      successMessage: `User ${user.username} activated.`,
      failureMessage: `Failed to activate user ${user.username}.`,
    });
  }

  protected deactivate(user: User): void {
    this.run(user, {
      request: () => this.userService.deactivate(user.id),
      onSuccess: () => this.patchUser(user.id, { isActive: false }),
      successMessage: `User ${user.username} deactivated.`,
      failureMessage: `Failed to deactivate user ${user.username}.`,
      confirm: {
        title: 'Deactivate user',
        message: `Deactivate user ${user.username}? They will lose access immediately.`,
        confirmLabel: 'Deactivate',
      },
    });
  }

  protected delete(user: User): void {
    this.run(user, {
      request: () => this.userService.delete(user.id),
      onSuccess: () => {
        this.users.value.update((users) => users?.filter((u) => u.id !== user.id));
        // The row (and its trigger, where focus would return) is gone: move focus to a stable element.
        this.heading().nativeElement.focus();
      },
      successMessage: `User ${user.username} deleted.`,
      failureMessage: `Failed to delete user ${user.username}.`,
      confirm: {
        title: 'Delete user',
        message: `Delete user ${user.username}? This cannot be undone.`,
        confirmLabel: 'Delete',
      },
    });
  }

  private run(user: User, action: UserAction): void {
    if (this.pendingIds().has(user.id)) {
      return;
    }

    this.actionError.set(null);
    this.actionStatus.set('');
    // Pending from the very start (dialog included), so a row never has more than one flow at a time.
    this.setPending(user.id, true);

    // The dialog is opened from a menu item that matMenuContent destroys on close, so the default
    // focus restoration would land on <body>: point it at the row's (still present) actions trigger.
    const confirmed$ = action.confirm
      ? openConfirmDialog(this.dialog, action.confirm, { restoreFocus: actionsTriggerSelector(user.id) })
      : of(true);
    confirmed$
      .pipe(
        filter((confirmed) => confirmed),
        switchMap(() => action.request()),
        finalize(() => this.setPending(user.id, false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          action.onSuccess();
          this.actionStatus.set(action.successMessage);
        },
        error: (error: unknown) => this.actionError.set(getServerErrorMessage(error) ?? action.failureMessage),
      });
  }

  private patchUser(id: string, changes: Partial<User>): void {
    this.users.value.update((users) => users?.map((u) => (u.id === id ? { ...u, ...changes } : u)));
  }

  private setPending(id: string, isPending: boolean): void {
    this.pendingIds.update((ids) => {
      const next = new Set(ids);
      if (isPending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
