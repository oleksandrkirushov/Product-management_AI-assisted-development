# Форми

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
- Кнопка сабміту задізейблена доти, доки форма `pristine` (а не доки вона `invalid`) — дизейбл на `invalid` блокує навіть спробу відправити форму і побачити помилки; невалідність перевіряй і блокуй сабміт усередині хендлера (`markAllAsTouched()` + `return`), а не через `[disabled]`.

## Required-поля

Обов'язкове поле позначай зірочкою біля лейбла (видима ознака) + прихованим текстом для скрінрідерів + `aria-required` на інпуті:

```html
<label for="email" class="form-label">
  Email
  <span class="required-indicator" aria-hidden="true">*</span>
  <span class="visually-hidden"> (required)</span>
</label>
<input id="email" formControlName="email" aria-required="true" />
```

`.visually-hidden` — глобальний клас (`src/styles.scss`), не дублюй його в компоненті.

## Форма на всю сторінку з футером, прибитим донизу

Коли форма займає всю сторінку (хедер + тіло + футер із кнопкою дії), футер має лишатися в самому низу навіть при малій кількості полів — через flex-column на всю висоту в'юпорту, а не `position: sticky`/`fixed`:

```scss
:host {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

form {
  display: flex;
  flex-direction: column;
  flex: 1; // займає весь простір після хедера
}

.page-body {
  flex: 1; // розтягується, відштовхуючи футер донизу
}

.page-footer {
  display: flex;
  justify-content: flex-end; // кнопка дії — праворуч
  border-top: 1px solid $color-border; // горизонтальна лінія-розділювач
}
```
