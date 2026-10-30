import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Cross-field validator for a form group: confirms that the two given controls
 * hold the same value. Sets `{ passwordMismatch: true }` on the group otherwise.
 *
 * Returns `null` while either value is empty, so `required` errors are reported
 * by the individual controls instead of a mismatch.
 *
 * @param passwordKey name of the password control (default `password`)
 * @param confirmKey name of the confirmation control (default `confirmPassword`)
 */
export function passwordsMatchValidator(
  passwordKey = 'password',
  confirmKey = 'confirmPassword',
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password: unknown = group.get(passwordKey)?.value;
    const confirmPassword: unknown = group.get(confirmKey)?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}
