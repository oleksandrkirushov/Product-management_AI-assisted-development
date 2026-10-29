import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogConfig,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { Observable, map } from 'rxjs';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
}

/**
 * Generic confirmation dialog for `MatDialog`.
 * Closes with `true` on confirm and `false` on cancel; the cancel button gets the initial focus.
 */
@Component({
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
  selector: 'app-confirm-dialog',
  styleUrl: './confirm-dialog.component.scss',
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  protected readonly cancelLabel = this.data.cancelLabel ?? 'Cancel';
}

/**
 * Opens `ConfirmDialogComponent` and emits `true` when the user confirms, otherwise `false`
 * (cancel button, Esc or backdrop click).
 * Defaults to `role: 'alertdialog'`; `autoFocus` is fixed so `cdkFocusInitial` keeps focus on Cancel.
 */
export function openConfirmDialog(
  dialog: MatDialog,
  data: ConfirmDialogData,
  config: Omit<MatDialogConfig<ConfirmDialogData>, 'data' | 'autoFocus'> = {},
): Observable<boolean> {
  return dialog
    .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      role: 'alertdialog',
      ...config,
      data,
      autoFocus: 'first-tabbable',
    })
    .afterClosed()
    .pipe(map((result) => result === true));
}
