# Reactive forms

Test the form the way a person uses it: enter values in the DOM, press submit, check the errors and the output.
Don't check `form.valid` directly — the form is usually `protected`, and it's an implementation detail.

Component:

```ts
export interface SignUpData {
  email: string;
  password: string;
}

@Component({
  selector: 'app-sign-up-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="email">Email</label>
      <input id="email" type="email" formControlName="email" />
      @if (form.controls.email.touched && form.controls.email.invalid) {
        <p id="email-error" role="alert">Invalid email</p>
      }
      <label for="password">Password</label>
      <input id="password" type="password" formControlName="password" />
      <button type="submit">Sign up</button>
    </form>
  `,
})
export class SignUpFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  readonly submitted = output<SignUpData>();

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitted.emit(this.form.getRawValue());
  }
}
```

Test:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignUpData, SignUpFormComponent } from './sign-up-form.component';

describe('SignUpFormComponent', () => {
  let fixture: ComponentFixture<SignUpFormComponent>;
  let el: HTMLElement;
  let submitted: SignUpData[];

  function query<T extends Element>(selector: string): T {
    const node = el.querySelector<T>(selector);
    if (!node) throw new Error(`${selector} not found`);
    return node;
  }

  // Simulates user input: value → input event → blur (the field becomes touched)
  function type(selector: string, value: string): void {
    const input = query<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(SignUpFormComponent);
    submitted = [];
    fixture.componentInstance.submitted.subscribe((data) => submitted.push(data));
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('should show an error and not submit when the email is invalid', async () => {
    type('#email', 'not-an-email');
    type('#password', 'secret123');

    query<HTMLButtonElement>('button[type="submit"]').click();
    await fixture.whenStable();

    expect(el.querySelector('#email-error')).not.toBeNull();
    expect(submitted).toEqual([]);
  });

  it('should emit form data when the form is valid', async () => {
    type('#email', 'user@example.com');
    type('#password', 'secret123');

    query<HTMLButtonElement>('button[type="submit"]').click();
    await fixture.whenStable();

    expect(submitted).toEqual([{ email: 'user@example.com', password: 'secret123' }]);
  });
});
```

## What to cover in forms
- Every validator: an invalid value shows an error, a valid one doesn't.
- Boundary values (`minLength(8)`: 7 characters — error, 8 — ok).
- Submitting an invalid form: nothing is emitted / sent, errors become visible.
- Submitting a valid form: correct data in the output or a service call.
- Custom validators (`ValidatorFn`) — separately, as pure functions: `expect(myValidator(new FormControl('x'))).toEqual({ ... })`.
- For `<select>` — `select.value = '...'; select.dispatchEvent(new Event('change'))`;
  for a checkbox — `checkbox.click()`.
