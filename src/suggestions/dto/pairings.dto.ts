import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';
import { ToArray } from '../../common/validation/transforms';

export const MAX_PAIRINGS = 4;

export class PairingsDto extends BaseFormDto {
  /** One checkbox per dish, so none ticked sends nothing at all. */
  @IsOptional()
  @ToArray()
  @IsArray({ message: 'invalid' })
  @ArrayMaxSize(MAX_PAIRINGS, { message: 'tooMany' })
  @IsString({ each: true, message: 'invalid' })
  @MaxLength(64, { each: true, message: 'tooLong' })
  pairings?: string[];
}
