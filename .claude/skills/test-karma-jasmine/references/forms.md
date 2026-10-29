# Reactive forms

Тестуй форму так, як нею користується людина: вводь значення в DOM, натискай submit, перевіряй помилки та output.
Не перевіряй `form.valid` напряму — форма зазвичай `protected`, і це деталь реалізації.

Компонент:

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
        <p id="email-error" role="alert">Некоректний email</p>
      }
      <label for="password">Пароль</label>
      <input id="password" type="password" formControlName="password" />
      <button type="submit">Зареєструватися</button>
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

Тест:

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

  // Імітує введення користувача: значення → подія input → blur (поле стає touched)
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

## Що покривати у формах
- Кожен валідатор: невалідне значення показує помилку, валідне — ні.
- Граничні значення (`minLength(8)`: 7 символів — помилка, 8 — ок).
- Submit невалідної форми: нічого не емітиться / не відправляється, помилки стають видимими.
- Submit валідної форми: правильні дані в output або виклик сервісу.
- Кастомні валідатори (`ValidatorFn`) — окремо, як чисті функції: `expect(myValidator(new FormControl('x'))).toEqual({ ... })`.
- Для `<select>` — `select.value = '...'; select.dispatchEvent(new Event('change'))`;
  для checkbox — `checkbox.click()`.
