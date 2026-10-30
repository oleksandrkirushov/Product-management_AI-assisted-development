# Forms

## Typed reactive forms

```ts
export class SignUpFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue(); // { email: string; password: string }
  }
}
```

```html
<form [formGroup]="form" (ngSubmit)="submit()">
  <label for="email">Email</label>
  <input id="email" type="email" formControlName="email" autocomplete="email"
         [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched"
         aria-describedby="email-error" />
  @if (form.controls.email.touched && form.controls.email.hasError('email')) {
    <p id="email-error" role="alert">Invalid email</p>
  }
  <button type="submit">Sign up</button>
</form>
```

## Rules

- Reactive forms for any non-trivial form; template-driven — only for 1–2 fields.
- `NonNullableFormBuilder` — so that `reset()` returns the initial values rather than `null`.
- Don't use `UntypedFormGroup` / `any` in forms.
- Custom validators are pure `ValidatorFn` functions in a separate file.
- Custom input fields implement `ControlValueAccessor`.
- **Signal Forms** (`@angular/forms/signals`) are experimental. Use them only if the project has already switched to them.
- Accessibility: every field has a `<label>`, errors are linked via `aria-describedby`, submission goes through `<button type="submit">`.
- The submit button is disabled while the form is `pristine` (not while it's `invalid`) — disabling on `invalid` blocks even the attempt to submit the form and see the errors; check invalidity and block submission inside the handler (`markAllAsTouched()` + `return`), not via `[disabled]`.

## Required fields

Mark a required field with an asterisk next to the label (visible cue) + hidden text for screen readers + `aria-required` on the input:

```html
<label for="email" class="form-label">
  Email
  <span class="required-indicator" aria-hidden="true">*</span>
  <span class="visually-hidden"> (required)</span>
</label>
<input id="email" formControlName="email" aria-required="true" />
```

`.visually-hidden` is a global class (`src/styles.scss`), don't duplicate it in the component.

## Full-page form with a footer pinned to the bottom

When a form takes up the whole page (header + body + footer with an action button), the footer must stay at the very bottom even with few fields — via a full-viewport-height flex column, not `position: sticky`/`fixed`:

```scss
:host {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

form {
  display: flex;
  flex-direction: column;
  flex: 1; // takes all the space after the header
}

.page-body {
  flex: 1; // stretches, pushing the footer down
}

.page-footer {
  display: flex;
  justify-content: flex-end; // action button on the right
  border-top: 1px solid $color-border; // horizontal divider line
}
```
