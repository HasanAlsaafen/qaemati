import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderLineDto {
  @IsString({ message: 'invalid' })
  @MaxLength(200, { message: 'tooLong' })
  key!: string;

  @IsInt({ message: 'invalid' })
  @Min(1, { message: 'invalid' })
  @Max(50, { message: 'invalid' })
  qty!: number;
}

/** Where the guest says they are. Checked on the server, never trusted for anything else. */
class GuestPositionDto {
  @IsOptional()
  @IsNumber({}, { message: 'invalid' })
  lat?: number;

  @IsOptional()
  @IsNumber({}, { message: 'invalid' })
  lng?: number;

  @IsOptional()
  @IsNumber({}, { message: 'invalid' })
  @Min(0, { message: 'invalid' })
  accuracy?: number;
}

export class PlaceOrderDto extends GuestPositionDto {
  /** The table's QR token. */
  @IsString({ message: 'invalid' })
  @MaxLength(64, { message: 'tooLong' })
  table!: string;

  @IsArray({ message: 'invalid' })
  @ArrayMinSize(1, { message: 'invalid' })
  @ArrayMaxSize(40, { message: 'invalid' })
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(600, { message: 'tooLong' })
  note?: string;
}

export class CallWaiterDto extends GuestPositionDto {
  @IsString({ message: 'invalid' })
  @MaxLength(64, { message: 'tooLong' })
  table!: string;
}
