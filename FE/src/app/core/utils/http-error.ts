function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Safely extracts a server-provided error message (`{ error: { message: string } }`,
 * the shape of an `HttpErrorResponse`) from an HTTP error without resorting to an
 * unsafe `as` cast.
 *
 * Returns `undefined` when the error doesn't match the expected shape, so callers
 * can fall back to a generic message.
 */
export function getServerErrorMessage(error: unknown): string | undefined {
  if (!isRecord(error) || !('error' in error)) {
    return undefined;
  }

  const body = error['error'];
  if (!isRecord(body) || !('message' in body)) {
    return undefined;
  }

  const message = body['message'];
  return typeof message === 'string' ? message : undefined;
}
