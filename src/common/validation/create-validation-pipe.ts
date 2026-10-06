import { ValidationError, ValidationPipe } from '@nestjs/common';
import { FieldErrorKeys, ValidationFailedException } from './validation-failed.exception';

const FALLBACK_KEY = 'invalid';
// Values the user may have typed that must never be echoed back.
const SENSITIVE_FIELDS = new Set(['password', 'csrf_token']);

function collect(errors: ValidationError[], prefix: string, into: FieldErrorKeys): void {
  for (const error of errors) {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) {
      into[field] = Object.values(error.constraints).map((message) =>
        /^[a-zA-Z]+$/.test(message) ? message : FALLBACK_KEY,
      );
    }
    if (error.children?.length) collect(error.children, field, into);
  }
}

/**
 * DTO decorators carry a short message key (for example `tooLong`) rather
 * than prose, so the same failure can be rendered in either locale by
 * whoever answers the request. Anything that is not a plain key (a
 * class-validator default message, for instance an unknown property)
 * collapses to the generic `invalid` key.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const fieldErrors: FieldErrorKeys = {};
      collect(errors, '', fieldErrors);
      const values: Record<string, unknown> = {};
      for (const error of errors) {
        if (!SENSITIVE_FIELDS.has(error.property)) values[error.property] = error.value;
      }
      return new ValidationFailedException(fieldErrors, values);
    },
  });
}
