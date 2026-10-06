import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';
import { ToArray } from '../../common/validation/transforms';

export class PriceChangeDto extends BaseFormDto {
  @IsOptional()
  @ToArray()
  @IsString({ each: true, message: 'invalid' })
  @MaxLength(64, { each: true, message: 'tooLong' })
  itemIds?: string[];

  @IsOptional()
  @Matches(/^$|^-?\d{1,4}(\.\d{1,2})?$/, { message: 'invalidNumber' })
  percent?: string;
}

export class UndoDto extends BaseFormDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(64, { message: 'tooLong' })
  logId?: string;
}
