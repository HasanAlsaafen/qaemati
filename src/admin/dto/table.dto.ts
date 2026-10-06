import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';

export class TableLabelDto extends BaseFormDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(60, { message: 'tooLong' })
  label?: string;
}
