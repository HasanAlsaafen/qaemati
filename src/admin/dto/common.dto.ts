import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';
import { ToArray } from '../../common/validation/transforms';

export class MoveDto extends BaseFormDto {
  @IsIn(['up', 'down'], { message: 'invalidOption' })
  direction!: 'up' | 'down';
}

export class ReorderDto extends BaseFormDto {
  @IsOptional()
  @ToArray()
  @IsString({ each: true, message: 'invalid' })
  @MaxLength(64, { each: true, message: 'tooLong' })
  ids?: string[];
}

export const TIME_PATTERN = /^$|^([01]\d|2[0-3]):[0-5]\d$/;
export const PRICE_PATTERN = /^$|^-?\d{1,9}(\.\d{1,4})?$/;
