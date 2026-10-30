import { FormControl, FormGroup } from '@angular/forms';
import { passwordsMatchValidator } from './passwords-match.validator';

describe('passwordsMatchValidator', () => {
  function group(password: string, confirm: string, passwordKey = 'password'): FormGroup {
    return new FormGroup({
      [passwordKey]: new FormControl(password),
      confirmPassword: new FormControl(confirm),
    });
  }

  it('should return null when the default controls match', () => {
    expect(passwordsMatchValidator()(group('Password1', 'Password1'))).toBeNull();
  });

  it('should return passwordMismatch when the default controls differ', () => {
    expect(passwordsMatchValidator()(group('Password1', 'Password2'))).toEqual({ passwordMismatch: true });
  });

  it('should return null when either value is empty', () => {
    expect(passwordsMatchValidator()(group('Password1', ''))).toBeNull();
  });

  it('should return null when the password is empty but the confirmation is filled', () => {
    expect(passwordsMatchValidator()(group('', 'Password1'))).toBeNull();
  });

  it('should return null when the group does not contain the given controls', () => {
    expect(passwordsMatchValidator('missing', 'alsoMissing')(group('Password1', 'Password2'))).toBeNull();
  });

  it('should compare custom control names', () => {
    const validator = passwordsMatchValidator('newPassword', 'confirmPassword');

    expect(validator(group('Password1', 'Password2', 'newPassword'))).toEqual({ passwordMismatch: true });
    expect(validator(group('Password1', 'Password1', 'newPassword'))).toBeNull();
  });
});
