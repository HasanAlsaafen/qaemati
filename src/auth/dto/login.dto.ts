import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';

export class LoginDto extends BaseFormDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(254, { message: 'tooLong' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(256, { message: 'tooLong' })
  password?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(512, { message: 'tooLong' })
  redirect?: string;

  /** The "remember me" checkbox: a browser sends "on" when it is ticked and nothing otherwise. */
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(8, { message: 'tooLong' })
  remember?: string;
}
