import { Allow, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ItemTag } from '@prisma/client';
import { BaseFormDto } from '../../common/validation/base-form.dto';
import { ToArray } from '../../common/validation/transforms';
import { ALL_TAGS } from '../../common/tags';
import { PRICE_PATTERN } from './common.dto';

export class CreateItemDto extends BaseFormDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(120, { message: 'tooLong' })
  nameAr?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(120, { message: 'tooLong' })
  nameEn?: string;

  @IsOptional()
  @Matches(PRICE_PATTERN, { message: 'invalidNumber' })
  price?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(8, { message: 'tooLong' })
  currency?: string;
}

export class UpdateItemDto extends CreateItemDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(1000, { message: 'tooLong' })
  descriptionAr?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(1000, { message: 'tooLong' })
  descriptionEn?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(500, { message: 'tooLong' })
  allergenNoteAr?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(500, { message: 'tooLong' })
  allergenNoteEn?: string;

  @IsOptional()
  @ToArray()
  @IsIn(ALL_TAGS, { each: true, message: 'invalidOption' })
  tags?: ItemTag[];

  @IsOptional()
  @IsIn(['on', 'true', 'false'], { message: 'invalidOption' })
  isTodaysSpecial?: string;

  // Indexed rows (variants[0][nameAr]...). Each row is trimmed and
  // type-checked by parseOptions, which also drops blank rows.
  @Allow()
  variants?: unknown;

  @Allow()
  addons?: unknown;
}
