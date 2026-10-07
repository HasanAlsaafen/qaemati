import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';

export class ForgotPasswordDto extends BaseFormDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(254, { message: 'tooLong' })
  email?: string;
}

export class ResetPasswordDto extends BaseFormDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(256, { message: 'tooLong' })
  password?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(256, { message: 'tooLong' })
  confirm?: string;
}
