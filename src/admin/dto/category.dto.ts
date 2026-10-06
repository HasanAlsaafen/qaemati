import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';
import { TIME_PATTERN } from './common.dto';

// Blank names are rejected by the controller with the existing toast, so
// the DTO only guards type and length.
export class CreateCategoryDto extends BaseFormDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(64, { message: 'tooLong' })
  menuId?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(120, { message: 'tooLong' })
  nameAr?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(120, { message: 'tooLong' })
  nameEn?: string;
}

export class UpdateCategoryDto extends CreateCategoryDto {
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'invalidTime' })
  availableFrom?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'invalidTime' })
  availableTo?: string;
}
