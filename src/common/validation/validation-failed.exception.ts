import { HttpException, HttpStatus } from '@nestjs/common';

/** Field name mapped to message keys under `common.validation.*`. */
export type FieldErrorKeys = Record<string, string[]>;

export class ValidationFailedException extends HttpException {
  constructor(
    readonly fieldErrors: FieldErrorKeys,
    readonly values: Record<string, unknown>,
  ) {
    super('Validation failed', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
