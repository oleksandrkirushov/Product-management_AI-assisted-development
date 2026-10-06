# Форми

## Typed reactive forms

```ts
export class SignUpForm {
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
    <p id="email-error" role="alert">Некоректний email</p>
  }
  <button type="submit">Зареєструватися</button>
</form>
```

## Правила

- Reactive forms для будь-яких нетривіальних форм; template-driven — лише для 1–2 полів.
- `NonNullableFormBuilder` — щоб `reset()` повертав початкові значення, а не `null`.
- Не використовуй `UntypedFormGroup` / `any` у формах.
- Кастомні валідатори — чисті функції `ValidatorFn` в окремому файлі.
- Кастомні поля вводу реалізують `ControlValueAccessor`.
- **Signal Forms** (`@angular/forms/signals`) — експериментальні. Використовуй лише якщо проєкт уже на них перейшов.
- Доступність: кожне поле має `<label>`, помилки пов'язані через `aria-describedby`, сабміт — через `<button type="submit">`.
