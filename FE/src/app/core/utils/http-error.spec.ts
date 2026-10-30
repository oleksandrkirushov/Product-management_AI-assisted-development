import { HttpErrorResponse } from '@angular/common/http';
import { getServerErrorMessage } from './http-error';

describe('getServerErrorMessage', () => {
  it('should return the message when the error body contains a string message', () => {
    const error = new HttpErrorResponse({ error: { message: 'Invalid credentials' } });

    const result = getServerErrorMessage(error);

    expect(result).toBe('Invalid credentials');
  });

  it('should return the message when the error is a plain object shaped like an HttpErrorResponse', () => {
    const error = { error: { message: 'Username is already taken' } };

    const result = getServerErrorMessage(error);

    expect(result).toBe('Username is already taken');
  });

  it('should return undefined when the error has no `error` property', () => {
    const result = getServerErrorMessage(new Error('boom'));

    expect(result).toBeUndefined();
  });

  it('should return undefined when the error body is not an object', () => {
    const error = new HttpErrorResponse({ error: 'plain text error' });

    const result = getServerErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it('should return undefined when the error body has no message field', () => {
    const error = new HttpErrorResponse({ error: { code: 'ERR_001' } });

    const result = getServerErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it('should return undefined when the message field is not a string', () => {
    const error = new HttpErrorResponse({ error: { message: 404 } });

    const result = getServerErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it('should return undefined when the error body is null', () => {
    const error = new HttpErrorResponse({ error: null });

    const result = getServerErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it('should return undefined when the message is an empty string', () => {
    const error = new HttpErrorResponse({ error: { message: '' } });

    const result = getServerErrorMessage(error);

    expect(result).toBeUndefined();
  });

  it('should return undefined when the message contains only whitespace', () => {
    const error = new HttpErrorResponse({ error: { message: '   ' } });

    const result = getServerErrorMessage(error);

    expect(result).toBeUndefined();
  });
});
