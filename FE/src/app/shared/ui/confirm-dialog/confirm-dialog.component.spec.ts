import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogData, openConfirmDialog } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  const data: ConfirmDialogData = {
    title: 'Deactivate user?',
    message: 'The user will lose access immediately.',
    confirmLabel: 'Deactivate',
    cancelLabel: 'Keep active',
  };

  let dialog: MatDialog;
  let overlayContainer: OverlayContainer;

  function overlay(): HTMLElement {
    return overlayContainer.getContainerElement();
  }

  function query<T extends Element>(selector: string): T {
    const element = overlay().querySelector<T>(selector);
    if (!element) {
      throw new Error(`Element "${selector}" not found`);
    }
    return element;
  }

  async function stable(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  /** Opens the dialog via the helper and collects every emitted result. */
  async function open(dialogData: ConfirmDialogData = data): Promise<boolean[]> {
    const results: boolean[] = [];
    openConfirmDialog(dialog, dialogData).subscribe((result) => results.push(result));
    await stable();
    return results;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      // Without animations the dialog closes synchronously instead of waiting for the exit animation.
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
    });
    dialog = TestBed.inject(MatDialog);
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(async () => {
    dialog.closeAll();
    await stable();
  });

  it('should render the title, message and button labels', async () => {
    await open();

    expect(query('[mat-dialog-title]').textContent?.trim()).toBe('Deactivate user?');
    expect(query('mat-dialog-content').textContent?.trim()).toBe('The user will lose access immediately.');
    expect(query('[data-testid="confirm-dialog-cancel"]').textContent?.trim()).toBe('Keep active');
    expect(query('[data-testid="confirm-dialog-confirm"]').textContent?.trim()).toBe('Deactivate');
  });

  it('should label the cancel button "Cancel" when cancelLabel is not provided', async () => {
    await open({ title: 'Delete?', message: 'This cannot be undone.', confirmLabel: 'Delete' });

    expect(query('[data-testid="confirm-dialog-cancel"]').textContent?.trim()).toBe('Cancel');
  });

  it('should focus the cancel button initially', async () => {
    await open();
    // The focus trap moves focus after the next render.
    await new Promise((resolve) => setTimeout(resolve));
    await stable();

    expect(document.activeElement).toBe(query('[data-testid="confirm-dialog-cancel"]'));
  });

  it('should close with true when the confirm button is clicked', async () => {
    const results = await open();

    query<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    await stable();

    expect(results).toEqual([true]);
    expect(dialog.openDialogs.length).toBe(0);
  });

  it('should close with false when the cancel button is clicked', async () => {
    const results = await open();

    query<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]').click();
    await stable();

    expect(results).toEqual([false]);
    expect(dialog.openDialogs.length).toBe(0);
  });

  it('should emit false when the dialog is dismissed without a result', async () => {
    const results = await open();

    dialog.openDialogs[0].close();
    await stable();

    expect(results).toEqual([false]);
  });

  it('should emit false when the backdrop is clicked', async () => {
    const results = await open();

    query<HTMLElement>('.cdk-overlay-backdrop').click();
    await stable();

    expect(results).toEqual([false]);
  });

  it('should emit false when the dialog is closed with the Escape key', async () => {
    const results = await open();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    // MatDialog matches Escape by the legacy keyCode, which KeyboardEventInit cannot set.
    Object.defineProperty(escape, 'keyCode', { get: () => 27 });

    query<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]').dispatchEvent(escape);
    await stable();

    expect(results).toEqual([false]);
    expect(dialog.openDialogs.length).toBe(0);
  });

  it('should render the dialog container with role "alertdialog" by default', async () => {
    await open();

    expect(query('mat-dialog-container').getAttribute('role')).toBe('alertdialog');
  });

  it('should allow overriding the default role via config', async () => {
    openConfirmDialog(dialog, data, { role: 'dialog' }).subscribe();
    await stable();

    expect(query('mat-dialog-container').getAttribute('role')).toBe('dialog');
  });

  it('should apply the passed config to the dialog', async () => {
    openConfirmDialog(dialog, data, { panelClass: 'test-panel' }).subscribe();
    await stable();

    expect(query('.test-panel')).toBeTruthy();
    expect(query('[mat-dialog-title]').textContent?.trim()).toBe('Deactivate user?');
  });
});
