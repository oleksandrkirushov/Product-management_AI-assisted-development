# План: відновлення пароля («Забули пароль?»)

**Дата:** 2026-10-30
**Статус:** На розгляді

---

## 1. Що робимо

На сторінці логіну з'являється посилання **«Forgot password?»**. Користувач вводить свій email і отримує лист
з одноразовим посиланням. Посилання веде на сторінку, де він задає новий пароль, після чого входить з ним.
Після зміни пароля всі раніше видані JWT цього користувача перестають працювати.

**Не робимо в цій фічі:** зміну пароля залогіненим користувачем (поточний + новий) і примусове скидання пароля
адміном. Обидва сценарії потім легко додати поверх того самого доменного методу `User.ChangePasswordHash`.

## 2. Як підтверджувати, що пароль змінює власник акаунта

| Варіант | Оцінка |
|---|---|
| **Одноразовий токен у листі на email** ✅ | Стандартний підхід. Підтвердження — це доступ до пошти. Для розробки потрібна SMTP-пісочниця. |
| Username + email без листа | Небезпечно: будь-хто, хто знає чужий email, зможе змінити пароль. |
| Секретні питання | Слабкий захист, ще й потрібні нові поля та UI при реєстрації. |
| Заявку погоджує адмін | Потрібні черга заявок і спосіб передати пароль користувачу. Складніше, ніж лист. |

**Рекомендація:** токен у листі. Лист відправляє абстракція `IEmailSender`, реалізована через SMTP.
Для розробки в `compose.yaml` додається **Mailpit**: SMTP на `:1025`, веб-інтерфейс із вхідними листами
на http://localhost:8025. Справжня пошта не потрібна, а потік працює так само, як у продакшені.
У продакшені достатньо поміняти SMTP-налаштування.

### Правила безпеки
- `forgot-password` **завжди** відповідає `202` з однаковим текстом, щоб не можна було перевірити, чи існує email.
- Токен: 32 випадкові байти (`RandomNumberGenerator`) у форматі base64url. **У БД зберігається лише SHA-256 хеш.**
- Токен живе 30 хв (налаштовується) і використовується один раз. Новий запит скасовує попередні токени користувача.
- Деактивований користувач токен не отримує, а наявний токен для нього не спрацює.
- Мінімальна довжина пароля 8 символів, як при реєстрації (правило виноситься в спільну константу).
- Rate limiting на `forgot-password` і `reset-password` вбудованим `Microsoft.AspNetCore.RateLimiting`
  (наприклад, 5 запитів на хвилину з одного IP).
- **Старі JWT відкликаються через `SecurityStamp`.** У `User` з'являється поле, яке генерується наново при кожній зміні пароля.
  Під час логіну його значення кладеться в claim `sst`, а `ActiveUserTokenValidator` порівнює claim із поточним значенням у БД.
  Порівнювати з датою зміни пароля через `iat` гірше: `iat` має точність до секунди, тож токен, виданий у ту ж секунду, проскочить.

---

## 3. API-контракт (узгоджується до старту, щоб FE і BE йшли паралельно)

```
POST /api/auth/forgot-password        [AllowAnonymous, rate-limited]
  body: { "email": "user@example.com" }
  202 Accepted  { "message": "If an account with this email exists, a reset link has been sent." }
  400           невалідний email (DataAnnotations)

POST /api/auth/reset-password         [AllowAnonymous, rate-limited]
  body: { "token": "<base64url>", "newPassword": "NewPass123" }
  204 No Content
  400 { "message": "Reset link is invalid or has expired." }   невалідний / прострочений / використаний токен
  400 { "message": "Password must be at least 8 characters long." }
  429 Too Many Requests
```

Посилання в листі: `{PasswordReset:ResetUrl}?token=<token>`, для розробки це `http://localhost:4200/reset-password?token=...`.

---

## 4. Задачі

### BE (агент `dotnet-developer`, рев'ю `dotnet-reviewer`)

**B1. Домен і персистенція**
- `Domain/Entities/User.cs`: поле `SecurityStamp` (генерується в конструкторі) і метод `ChangePasswordHash(string newHash)`,
  який валідує хеш, оновлює `PasswordHash`, `SecurityStamp` і `UpdatedAtUtc`.
- `Domain/Entities/PasswordResetToken.cs` (нова сутність): `Id`, `UserId`, `TokenHash`, `ExpiresAtUtc`, `UsedAtUtc?`, `CreatedAtUtc`.
  Методи `IsUsable(now)` і `MarkUsed(now)`.
- `Application/Abstractions/IPasswordResetTokenRepository.cs`: `AddAsync`, `FindByHashAsync`, `GetActiveByUserIdAsync`, `Update`.
- `Infrastructure/Persistence/PasswordResetTokenRepository.cs` і конфігурація в `AppDbContext`:
  таблиця `PasswordResetTokens`, унікальний індекс на `TokenHash`, FK на `Users` з cascade delete,
  `SecurityStamp` `nvarchar(64)` required.
- Міграція `AddPasswordReset`. Існуючим рядкам `SecurityStamp` заповнюється через `defaultValueSql: "CONVERT(nvarchar(64), NEWID())"`.
- Юніт-тести: `UserTests` (ChangePasswordHash, новий stamp) і `PasswordResetTokenTests`.

**B2. Відправка email (інфраструктура)**
- `Application/Abstractions/IEmailSender.cs`: `SendAsync(to, subject, body, ct)`.
- `Infrastructure/Email/SmtpEmailSender.cs` + `SmtpOptions` (Host, Port, From, EnableSsl, User?, Password?).
- `compose.yaml`: сервіс `mailpit` (`axllent/mailpit`, порти 1025/8025), env `Smtp__Host=mailpit` для `api`.
- `appsettings.json`: секції `Smtp` (localhost:1025) і `PasswordReset` (`ResetUrl`, `TokenLifetimeMinutes: 30`).

**B3. Сервіс застосунку `PasswordResetService`** (потрібні B1 і B2)
- `Application/Users/PasswordResetService.cs`:
  - `RequestResetAsync(email)`: знаходить активного користувача, скасовує його попередні токени, генерує токен,
    зберігає хеш і надсилає лист. Для невідомого або неактивного email нічого не робить і помилку не кидає.
  - `ResetAsync(ResetPasswordCommand)`: валідує пароль, шукає токен за хешем, перевіряє `IsUsable` і активність користувача.
    Далі `user.ChangePasswordHash(hasher.Hash(...))`, `token.MarkUsed`, один `SaveChanges`.
    На помилку кидає `InvalidPasswordResetTokenException`.
- Генерацію і хешування токена винести в `Application/Abstractions/IPasswordResetTokenGenerator` з реалізацією в Infrastructure.
- `TimeProvider` для `now`, щоб було зручно тестувати прострочення.
- `MinimumPasswordLength` винести в спільну константу (`Users/PasswordPolicy.cs`), яку використовують і `RegisterUserService`, і цей сервіс.
- Юніт-тести `PasswordResetServiceTests`: невідомий email, неактивний юзер, щасливий шлях,
  прострочений, використаний і невідомий токен, короткий пароль, скасування попередніх токенів.

**B4. API, DI, rate limiting** (потрібні B3 і B5)
- `Api/Contracts/ForgotPasswordRequest.cs`, `ResetPasswordRequest.cs`.
- `AuthController`: два endpoint-и за контрактом із розділу 3.
- `Program.cs`: `AddRateLimiter` з політикою `password-reset` і `UseRateLimiter()`. Endpoint-и позначаються `[EnableRateLimiting]`.
- DI: реєстрація `PasswordResetService`, `IPasswordResetTokenRepository`, `IEmailSender`, генератора токена,
  `TimeProvider.System` і options.
- Тести в `AuthControllerTests`: 202 для будь-якого email; 204 і 400 для reset.
- `BE/README.md`: опис нових endpoint-ів і Mailpit.

**B5. Відкликання JWT через SecurityStamp** (потрібен B1)
- `AuthenticatedUserDto` + `AuthService`: повертати `SecurityStamp`.
- `AuthController.Login`: claim `sst`.
- `ActiveUserTokenValidator`: додатково перевіряти `sst == user.SecurityStamp` (ordinal).
  Токени, видані до цієї зміни, не мають claim `sst`, тому вони теж перестануть працювати і юзерам доведеться перелогінитись. Це очікувано.
- Тести: `ActiveUserTokenValidatorTests` (немає sst, інший sst, збіг), `AuthServiceTests`.

### FE (агент `angular-developer`, тести `angular-test-writer`, рев'ю `angular-reviewer`)

**F1. Моделі та сервіс**
- `features/models/auth.ts`: `ForgotPasswordRequest`, `ResetPasswordRequest`.
- `features/services/auth.service.ts`: `forgotPassword(email): Observable<void>` і `resetPassword(token, newPassword): Observable<void>`.
- `passwordsMatchValidator` перенести з `register.component.ts` у `shared/validators/passwords-match.validator.ts`,
  бо він знадобиться і в F3. Register переходить на спільний валідатор.

**F2. Сторінка `ForgotPasswordComponent`** (`features/auth/forgot-password/`, потрібен F1)
- Форма з одним полем email (required, email). Після сабміту форма ховається і показується повідомлення
  «If an account exists, we've sent a reset link» незалежно від результату. Якщо помилка 429 або мережева, показується error-banner.
- Посилання «Back to login». Стилі як у login/register, без Material.

**F3. Сторінка `ResetPasswordComponent`** (`features/auth/reset-password/`, потрібен F1)
- Токен береться з query param через `input()` + `withComponentInputBinding` (або `ActivatedRoute`).
  Якщо токена немає, показується повідомлення про невалідне посилання і посилання на forgot-password.
- Поля newPassword (required, minLength 8) і confirmPassword, на групі спільний `passwordsMatchValidator`.
- На успіх: `router.navigate(['/login'], { queryParams: { reset: 'success' } })`.
  На 400 показується серверне повідомлення через `getServerErrorMessage` і посилання «Request a new link».

**F4. Інтеграція** (потрібні F2 і F3)
- `app.routes.ts`: lazy-маршрути `forgot-password` і `reset-password`.
- Login: посилання «Forgot password?» під полем пароля і банер успіху за `?reset=success`
  (`role="status"`, «Password changed. Please log in with your new password.»).

**F5. Тести** (`angular-test-writer`, після F1–F4)
- Spec-и для `auth.service` (нові методи), обох нових компонентів, оновленого login,
  `passwords-match.validator` і роутів. Перевірити пороги покриття (`npm run test:coverage`).

---

## 5. Паралельне виконання

Обрано **дві паралельні гілки**, по одному агенту на кожну частину. BE і FE не мають спільних файлів,
тож конфліктів не буде. FE пишеться за контрактом із розділу 3, і запущений BE йому не потрібен.

```
Гілка BE:  dotnet-developer:  B1 → B2 → B5 → B3 → B4  ──► dotnet-reviewer (цикл до ✅) ──────────────┐
                                                                                                    ├► E2E перевірка
Гілка FE:  angular-developer: F1 → F2 → F3 → F4 ──► angular-test-writer (F5) ──► angular-reviewer ──┘
                                                                                 (цикл до ✅)
```

| Крок | BE | FE |
|---|---|---|
| 1. Реалізація | `dotnet-developer` робить B1–B5 з тестами | `angular-developer` робить F1–F4 |
| 2. Тести | — (вже разом з реалізацією) | `angular-test-writer` робить F5 |
| 3. Рев'ю | `dotnet-reviewer`; на ⚠️/❌ виправляє `dotnet-developer` | `angular-reviewer`; на ⚠️/❌ виправляють `angular-developer` / `angular-test-writer` |
| 4. Разом | E2E: `docker compose up`, `npm start`, далі forgot → лист у Mailpit → reset → логін новим паролем → старий токен отримує 401 | |

Кожна гілка проходить свій цикл рев'ю незалежно від іншої. E2E-перевірка запускається, коли обидві отримали ✅.

Коміти робляться лише після мого підтвердження, окремо для BE і FE.

---

## 6. Ризики та нюанси

1. **Усі поточні сесії розлогіняться** після деплою B5, бо в старих токенах немає `sst`. Це прийнятно для dev-проєкту.
2. **Timing-атака на forgot-password**: для існуючого email відповідь довша, бо відправляється лист. Поки приймаємо.
   Якщо колись стане важливим, лист можна відправляти у фоновій черзі.
3. **Токен у query-рядку** може потрапити в історію браузера чи логи проксі. Пом'якшують це короткий TTL і одноразовість.
4. **Мікросекундна гонка двох reset-запитів з одним токеном**: другий `SaveChanges` перезапише перший.
   Обидва ставлять пароль від власника посилання, тож це некритично. Можна додати `rowversion`, якщо знадобиться.
5. **Нові іконки Material не потрібні**: сторінки без Material, отже `icon_names` і woff2 не змінюються.
6. **Збій SMTP у forgot-password** не розкриває існування email: контролер логує помилку (без адреси) і все одно
   повертає той самий `202`. Але попередні посилання на цей момент уже скасовані, а нове не дійшло, тож
   користувачу доведеться запросити посилання ще раз, коли SMTP запрацює.

**Відомі обмеження / future** (за результатами рев'ю BE, свідомо не зроблено в цій фічі):
- **Спільна політика rate limit** на обидва endpoint-и (5 запитів/хв на IP разом). Можна розвести на окремі
  політики з різними лімітами. За reverse proxy потрібен `ForwardedHeaders`, інакше всі клієнти мають IP проксі.
- **Немає cooldown на email**: ліміт стоїть лише на IP, тож з різних IP можна засипати листами одну адресу.
  Можна додати мінімальний інтервал між листами для одного користувача.
- **Гонка двох одночасних forgot-запитів**: обидва можуть не побачити токен одне одного, і в користувача
  залишаться два робочі посилання. Некритично (обидва ведуть до власника пошти). Закривається транзакцією
  або `rowversion`.
- **Таблиця `PasswordResetTokens` не очищається**: використані й прострочені токени накопичуються. Потрібна
  періодична очистка (фонова задача або job).
- **`User.ChangePasswordHash` бере час з `DateTime.UtcNow`**, а не з `TimeProvider` (як і решта методів `User`).
  Якщо знадобиться детермінований `UpdatedAtUtc` у тестах, можна передавати час параметром.
- **Таймаут SMTP за замовчуванням 100 с**: якщо SMTP-хост не відповідає, forgot-password для існуючого email
  висить до 100 с, а це ще й timing-різниця. Варто задати `SmtpClient.Timeout` (наприклад, 10 с) або перейти на фонову відправку.

**Відомі обмеження FE** (за результатами рев'ю FE):
- **Оновлення сторінки reset-password** після того, як токен прибрано з адреси, показує «invalid link», і посилання
  з листа доведеться відкрити ще раз. Це свідома поступка заради того, щоб токен не лишався в адресному рядку.
- **Нестабільний тест** `UsersComponent activate should activate without a confirmation dialog…` в адмінці Users
  (не пов'язаний із цією фічею): меню відкривається повторно до того, як Material прибрав попередній вміст. Виправити окремою задачею.

## 7. Критерії готовності

- [ ] На логіні є «Forgot password?», лист приходить у Mailpit з робочим посиланням
- [ ] Reset із валідним токеном змінює пароль, логін новим паролем працює, старим — ні
- [ ] Повторне використання або прострочення токена → 400 з повідомленням, FE пропонує запросити нове посилання
- [ ] Невідомий email → така сама відповідь 202, лист не надсилається
- [ ] Після reset старий JWT отримує 401
- [ ] `dotnet test` зелений; `npm run test:coverage` зелений і в межах порогів
- [ ] Обидва рев'ю мають вердикт ✅
