import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';

const text = () => MaxLength(256, { message: 'tooLong' });

export class VerifyCodeDto extends BaseFormDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @text()
  code?: string;
}

export class DisableTwoFactorDto extends VerifyCodeDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @text()
  password?: string;
}

export class ChangeOperatorPasswordDto extends BaseFormDto {
  @IsOptional()
  @IsString({ message: 'invalid' })
  @text()
  current?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @text()
  password?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @text()
  confirm?: string;
}
