# Plan: password reset ("Forgot password?")

**Date:** 2026-10-30
**Status:** Under review

---

## 1. What we're building

A **"Forgot password?"** link appears on the login page. The user enters their email and receives an email
with a single-use link. The link leads to a page where they set a new password, after which they log in with it.
After a password change, all previously issued JWTs of that user stop working.

**Not in this feature:** a password change by a logged-in user (current + new) and a forced password reset
by an admin. Both scenarios can easily be added later on top of the same domain method `User.ChangePasswordHash`.

## 2. How to confirm that the account owner is changing the password

| Option | Assessment |
|---|---|
| **Single-use token in an email** ✅ | The standard approach. Confirmation is access to the mailbox. Development needs an SMTP sandbox. |
| Username + email without an email | Unsafe: anyone who knows someone else's email could change the password. |
| Security questions | Weak protection, and it also needs new fields and UI at registration. |
| An admin approves the request | Needs a request queue and a way to deliver the password to the user. More complex than an email. |

**Recommendation:** a token in an email. The email is sent by the `IEmailSender` abstraction, implemented via SMTP.
For development, **Mailpit** is added to `compose.yaml`: SMTP on `:1025`, a web UI with incoming emails
at http://localhost:8025. No real mailbox is needed, and the flow works the same as in production.
In production it's enough to change the SMTP settings.

### Security rules
- `forgot-password` **always** responds `202` with the same text, so you can't check whether an email exists.
- Token: 32 random bytes (`RandomNumberGenerator`) in base64url format. **Only the SHA-256 hash is stored in the DB.**
- The token lives 30 min (configurable) and is used once. A new request revokes the user's previous tokens.
- A deactivated user doesn't get a token, and an existing token won't work for them.
- Minimum password length is 8 characters, as at registration (the rule moves into a shared constant).
- Rate limiting on `forgot-password` and `reset-password` with the built-in `Microsoft.AspNetCore.RateLimiting`
  (for example, 5 requests per minute from one IP).
- **Old JWTs are revoked via `SecurityStamp`.** `User` gets a field that is regenerated on every password change.
  At login its value is put into the `sst` claim, and `ActiveUserTokenValidator` compares the claim with the current value in the DB.
  Comparing against the password change date via `iat` is worse: `iat` has one-second precision, so a token issued in the same second would slip through.

---

## 3. API contract (agreed before starting, so FE and BE can proceed in parallel)

```
POST /api/auth/forgot-password        [AllowAnonymous, rate-limited]
  body: { "email": "user@example.com" }
  202 Accepted  { "message": "If an account with this email exists, a reset link has been sent." }
  400           invalid email (DataAnnotations)

POST /api/auth/reset-password         [AllowAnonymous, rate-limited]
  body: { "token": "<base64url>", "newPassword": "NewPass123" }
  204 No Content
  400 { "message": "Reset link is invalid or has expired." }   invalid / expired / used token
  400 { "message": "Password must be at least 8 characters long." }
  429 Too Many Requests
```

The link in the email: `{PasswordReset:ResetUrl}?token=<token>`, for development this is `http://localhost:4200/reset-password?token=...`.

---

## 4. Tasks

### BE (agent `dotnet-developer`, review `dotnet-reviewer`)

**B1. Domain and persistence**
- `Domain/Entities/User.cs`: a `SecurityStamp` field (generated in the constructor) and a `ChangePasswordHash(string newHash)` method
  that validates the hash and updates `PasswordHash`, `SecurityStamp` and `UpdatedAtUtc`.
- `Domain/Entities/PasswordResetToken.cs` (new entity): `Id`, `UserId`, `TokenHash`, `ExpiresAtUtc`, `UsedAtUtc?`, `CreatedAtUtc`.
  Methods `IsUsable(now)` and `MarkUsed(now)`.
- `Application/Abstractions/IPasswordResetTokenRepository.cs`: `AddAsync`, `FindByHashAsync`, `GetActiveByUserIdAsync`, `Update`.
- `Infrastructure/Persistence/PasswordResetTokenRepository.cs` and configuration in `AppDbContext`:
  the `PasswordResetTokens` table, a unique index on `TokenHash`, an FK to `Users` with cascade delete,
  `SecurityStamp` `nvarchar(64)` required.
- Migration `AddPasswordReset`. For existing rows `SecurityStamp` is filled via `defaultValueSql: "CONVERT(nvarchar(64), NEWID())"`.
- Unit tests: `UserTests` (ChangePasswordHash, new stamp) and `PasswordResetTokenTests`.

**B2. Sending email (infrastructure)**
- `Application/Abstractions/IEmailSender.cs`: `SendAsync(to, subject, body, ct)`.
- `Infrastructure/Email/SmtpEmailSender.cs` + `SmtpOptions` (Host, Port, From, EnableSsl, User?, Password?).
- `compose.yaml`: a `mailpit` service (`axllent/mailpit`, ports 1025/8025), env `Smtp__Host=mailpit` for `api`.
- `appsettings.json`: sections `Smtp` (localhost:1025) and `PasswordReset` (`ResetUrl`, `TokenLifetimeMinutes: 30`).

**B3. Application service `PasswordResetService`** (needs B1 and B2)
- `Application/Users/PasswordResetService.cs`:
  - `RequestResetAsync(email)`: finds the active user, revokes their previous tokens, generates a token,
    stores the hash and sends the email. For an unknown or inactive email it does nothing and throws no error.
  - `ResetAsync(ResetPasswordCommand)`: validates the password, looks up the token by hash, checks `IsUsable` and that the user is active.
    Then `user.ChangePasswordHash(hasher.Hash(...))`, `token.MarkUsed`, a single `SaveChanges`.
    On error it throws `InvalidPasswordResetTokenException`.
- Move token generation and hashing into `Application/Abstractions/IPasswordResetTokenGenerator` with an implementation in Infrastructure.
- `TimeProvider` for `now`, so expiration is easy to test.
- Move `MinimumPasswordLength` into a shared constant (`Users/PasswordPolicy.cs`) used by both `RegisterUserService` and this service.
- Unit tests `PasswordResetServiceTests`: unknown email, inactive user, happy path,
  expired, used and unknown token, short password, revoking previous tokens.

**B4. API, DI, rate limiting** (needs B3 and B5)
- `Api/Contracts/ForgotPasswordRequest.cs`, `ResetPasswordRequest.cs`.
- `AuthController`: two endpoints per the contract in section 3.
- `Program.cs`: `AddRateLimiter` with a `password-reset` policy and `UseRateLimiter()`. Endpoints are marked with `[EnableRateLimiting]`.
- DI: registering `PasswordResetService`, `IPasswordResetTokenRepository`, `IEmailSender`, the token generator,
  `TimeProvider.System` and options.
- Tests in `AuthControllerTests`: 202 for any email; 204 and 400 for reset.
- `BE/README.md`: description of the new endpoints and Mailpit.

**B5. JWT revocation via SecurityStamp** (needs B1)
- `AuthenticatedUserDto` + `AuthService`: return `SecurityStamp`.
- `AuthController.Login`: the `sst` claim.
- `ActiveUserTokenValidator`: additionally check `sst == user.SecurityStamp` (ordinal).
  Tokens issued before this change don't have the `sst` claim, so they will stop working too and users will have to log in again. This is expected.
- Tests: `ActiveUserTokenValidatorTests` (no sst, different sst, match), `AuthServiceTests`.

### FE (agent `angular-developer`, tests `angular-test-writer`, review `angular-reviewer`)

**F1. Models and service**
- `features/models/auth.ts`: `ForgotPasswordRequest`, `ResetPasswordRequest`.
- `features/services/auth.service.ts`: `forgotPassword(email): Observable<void>` and `resetPassword(token, newPassword): Observable<void>`.
- Move `passwordsMatchValidator` from `register.component.ts` to `shared/validators/passwords-match.validator.ts`,
  because it will also be needed in F3. Register switches to the shared validator.

**F2. `ForgotPasswordComponent` page** (`features/auth/forgot-password/`, needs F1)
- A form with a single email field (required, email). After submit the form is hidden and the message
  "If an account exists, we've sent a reset link" is shown regardless of the result. On a 429 or network error, an error banner is shown.
- A "Back to login" link. Styles as in login/register, without Material.

**F3. `ResetPasswordComponent` page** (`features/auth/reset-password/`, needs F1)
- The token is taken from the query param via `input()` + `withComponentInputBinding` (or `ActivatedRoute`).
  If there's no token, a message about an invalid link and a link to forgot-password are shown.
- Fields newPassword (required, minLength 8) and confirmPassword, with the shared `passwordsMatchValidator` on the group.
- On success: `router.navigate(['/login'], { queryParams: { reset: 'success' } })`.
  On 400 the server message is shown via `getServerErrorMessage` along with a "Request a new link" link.

**F4. Integration** (needs F2 and F3)
- `app.routes.ts`: lazy routes `forgot-password` and `reset-password`.
- Login: a "Forgot password?" link under the password field and a success banner on `?reset=success`
  (`role="status"`, "Password changed. Please log in with your new password.").

**F5. Tests** (`angular-test-writer`, after F1–F4)
- Specs for `auth.service` (new methods), both new components, the updated login,
  `passwords-match.validator` and the routes. Check the coverage thresholds (`npm run test:coverage`).

---

## 5. Parallel execution

We chose **two parallel branches**, one agent per part. BE and FE have no shared files,
so there will be no conflicts. FE is written against the contract in section 3 and doesn't need a running BE.

```
BE branch:  dotnet-developer:  B1 → B2 → B5 → B3 → B4  ──► dotnet-reviewer (cycle until ✅) ──────────┐
                                                                                                    ├► E2E check
FE branch:  angular-developer: F1 → F2 → F3 → F4 ──► angular-test-writer (F5) ──► angular-reviewer ──┘
                                                                                 (cycle until ✅)
```

| Step | BE | FE |
|---|---|---|
| 1. Implementation | `dotnet-developer` does B1–B5 with tests | `angular-developer` does F1–F4 |
| 2. Tests | — (already together with the implementation) | `angular-test-writer` does F5 |
| 3. Review | `dotnet-reviewer`; on ⚠️/❌ `dotnet-developer` fixes | `angular-reviewer`; on ⚠️/❌ `angular-developer` / `angular-test-writer` fix |
| 4. Together | E2E: `docker compose up`, `npm start`, then forgot → email in Mailpit → reset → log in with the new password → the old token gets 401 | |

Each branch goes through its own review cycle independently of the other. The E2E check runs once both have ✅.

Commits are made only after my confirmation, separately for BE and FE.

---

## 6. Risks and nuances

1. **All current sessions will be logged out** after deploying B5, because old tokens have no `sst`. This is acceptable for a dev project.
2. **Timing attack on forgot-password**: for an existing email the response takes longer because an email is sent. We accept this for now.
   If it ever becomes important, the email can be sent from a background queue.
3. **A token in the query string** can end up in the browser history or proxy logs. A short TTL and single use mitigate this.
4. **A microsecond race between two reset requests with the same token**: the second `SaveChanges` overwrites the first.
   Both set a password chosen by the link owner, so it's not critical. A `rowversion` can be added if needed.
5. **No new Material icons needed**: the pages don't use Material, so `icon_names` and the woff2 don't change.
6. **An SMTP failure in forgot-password** doesn't reveal whether the email exists: the controller logs the error (without the address) and still
   returns the same `202`. But by that point previous links have already been revoked and the new one wasn't delivered, so
   the user will have to request a link again once SMTP is working.

**Known limitations / future** (from the BE review, deliberately not done in this feature):
- **A shared rate limit policy** for both endpoints (5 requests/min per IP combined). It could be split into separate
  policies with different limits. Behind a reverse proxy `ForwardedHeaders` is needed, otherwise all clients have the proxy's IP.
- **No per-email cooldown**: the limit is only per IP, so one address can be flooded with emails from different IPs.
  A minimum interval between emails for one user could be added.
- **A race between two simultaneous forgot requests**: both may not see each other's token, and the user
  will be left with two working links. Not critical (both lead to the mailbox owner). Fixed with a transaction
  or `rowversion`.
- **The `PasswordResetTokens` table isn't cleaned up**: used and expired tokens accumulate. Periodic
  cleanup is needed (a background task or job).
- **`User.ChangePasswordHash` takes the time from `DateTime.UtcNow`**, not from `TimeProvider` (like the rest of the `User` methods).
  If a deterministic `UpdatedAtUtc` is needed in tests, the time can be passed as a parameter.
- **The default SMTP timeout is 100 s**: if the SMTP host doesn't respond, forgot-password for an existing email
  hangs for up to 100 s, which is also a timing difference. It's worth setting `SmtpClient.Timeout` (e.g. 10 s) or switching to background sending.

**Known FE limitations** (from the FE review):
- **Refreshing the reset-password page** after the token has been removed from the address shows "invalid link", and the link
  from the email has to be opened again. This is a deliberate trade-off so that the token doesn't stay in the address bar.
- **Flaky test** `UsersComponent activate should activate without a confirmation dialog…` in the Users admin page
  (unrelated to this feature): the menu reopens before Material has removed the previous content. Fix as a separate task.

## 7. Definition of done

- [ ] Login has "Forgot password?", the email arrives in Mailpit with a working link
- [ ] Reset with a valid token changes the password; logging in with the new password works, with the old one it doesn't
- [ ] Reusing or an expired token → 400 with a message, the FE offers to request a new link
- [ ] Unknown email → the same 202 response, no email is sent
- [ ] After reset the old JWT gets 401
- [ ] `dotnet test` is green; `npm run test:coverage` is green and within thresholds
- [ ] Both reviews have a ✅ verdict
