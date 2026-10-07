/** A problem with one form field, for example a slug that is already taken. */
export class FieldError extends Error {
  constructor(
    readonly field: string,
    /** Key under `super.errors` in the locale files. */
    readonly key: string,
  ) {
    super(`${field}: ${key}`);
  }
}
