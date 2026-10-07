import { Transform } from 'class-transformer';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';

export class OrderStatusDto extends BaseFormDto {
  @IsIn(['PREPARING', 'READY', 'SERVED', 'CANCELED'], { message: 'invalidOption' })
  status!: 'PREPARING' | 'READY' | 'SERVED' | 'CANCELED';
}

const COORDINATE = /^$|^-?\d{1,3}(\.\d{1,8})?$/;

export class PosSettingsDto extends BaseFormDto {
  @IsOptional()
  @Matches(COORDINATE, { message: 'invalidNumber' })
  latitude?: string;

  @IsOptional()
  @Matches(COORDINATE, { message: 'invalidNumber' })
  longitude?: string;

  @Matches(/^\d{2,4}$/, { message: 'invalidInteger' })
  orderRadiusMeters!: string;

  /** An unchecked box is not sent at all. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'on' || value === 'true')
  requireLocationCheck?: boolean;
}
