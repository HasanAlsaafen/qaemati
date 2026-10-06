import { Transform } from 'class-transformer';

/** A form field repeated once arrives as a string, repeated twice as an array. */
export const ToArray = () =>
  Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Array.isArray(value)
        ? value
        : [value],
  );
