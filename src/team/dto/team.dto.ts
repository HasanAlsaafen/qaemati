import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';

export class AddMemberDto extends BaseFormDto {
  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(80, { message: 'tooLong' })
  name!: string;

  @IsNotEmpty({ message: 'required' })
  @IsEmail({}, { message: 'invalidEmail' })
  @MaxLength(254, { message: 'tooLong' })
  email!: string;

  @IsIn(['OWNER', 'CASHIER', 'KITCHEN'], { message: 'invalidOption' })
  role!: 'OWNER' | 'CASHIER' | 'KITCHEN';
}

export class ChangeRoleDto extends BaseFormDto {
  @IsIn(['OWNER', 'CASHIER', 'KITCHEN'], { message: 'invalidOption' })
  role!: 'OWNER' | 'CASHIER' | 'KITCHEN';
}
