import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';
import { TIME_PATTERN } from './common.dto';

export class CreateMenuDto extends BaseFormDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(80, { message: 'tooLong' })
  nameAr?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(80, { message: 'tooLong' })
  nameEn?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'invalidTime' })
  availableFrom?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'invalidTime' })
  availableTo?: string;
}
