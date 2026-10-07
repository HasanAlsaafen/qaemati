import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';
import { SLUG_PATTERN } from '../../super-admin/dto/super.dto';

export class SignupDto extends BaseFormDto {
  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(120, { message: 'tooLong' })
  nameAr!: string;

  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(120, { message: 'tooLong' })
  nameEn!: string;

  @Matches(SLUG_PATTERN, { message: 'invalidSlug' })
  slug!: string;

  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(64, { message: 'tooLong' })
  planId!: string;

  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(120, { message: 'tooLong' })
  ownerName!: string;

  @IsEmail({}, { message: 'invalidEmail' })
  @MaxLength(254, { message: 'tooLong' })
  email!: string;

  @IsString({ message: 'invalid' })
  @MaxLength(256, { message: 'tooLong' })
  password!: string;

  @IsString({ message: 'invalid' })
  @MaxLength(256, { message: 'tooLong' })
  confirm!: string;

  /** A field no person sees. Bots fill every field they find. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
