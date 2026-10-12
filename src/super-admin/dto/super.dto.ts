import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';
import { ToArray } from '../../common/validation/transforms';
import { PLAN_FEATURES } from '../../tenancy/plan-features';

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const AMOUNT_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;
const OPTIONAL_COUNT = /^$|^\d{1,6}$/;
const OPTIONAL_DATE = /^$|^\d{4}-\d{2}-\d{2}$/;

export class PlanDto extends BaseFormDto {
  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(80, { message: 'tooLong' })
  nameAr!: string;

  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(80, { message: 'tooLong' })
  nameEn!: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(300, { message: 'tooLong' })
  descriptionAr?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(300, { message: 'tooLong' })
  descriptionEn?: string;

  @Matches(AMOUNT_PATTERN, { message: 'invalidAmount' })
  priceAmount!: string;

  @Matches(/^[A-Z]{3}$/, { message: 'invalid' })
  currency!: string;

  @IsIn(['MONTHLY', 'YEARLY'], { message: 'invalidOption' })
  interval!: 'MONTHLY' | 'YEARLY';

  @IsOptional()
  @Matches(/^$|^\d{1,3}$/, { message: 'invalidInteger' })
  trialDays?: string;

  @IsOptional()
  @Matches(OPTIONAL_COUNT, { message: 'invalidInteger' })
  maxMenus?: string;

  @IsOptional()
  @Matches(OPTIONAL_COUNT, { message: 'invalidInteger' })
  maxCategories?: string;

  @IsOptional()
  @Matches(OPTIONAL_COUNT, { message: 'invalidInteger' })
  maxItems?: string;

  @IsOptional()
  @Matches(OPTIONAL_COUNT, { message: 'invalidInteger' })
  maxAdminUsers?: string;

  @IsOptional()
  @ToArray()
  @IsIn([...PLAN_FEATURES], { each: true, message: 'invalidOption' })
  features?: string[];
}

export class CreateTenantDto extends BaseFormDto {
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

  @IsIn(['TRIAL', 'ACTIVE'], { message: 'invalidOption' })
  startMode!: 'TRIAL' | 'ACTIVE';

  /** Paid until, for a tenant that starts active. */
  @IsOptional()
  @Matches(OPTIONAL_DATE, { message: 'invalidDate' })
  paidUntil?: string;

  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(120, { message: 'tooLong' })
  adminName!: string;

  @IsEmail({}, { message: 'invalidEmail' })
  @MaxLength(254, { message: 'tooLong' })
  adminEmail!: string;
}

export class ChangePlanDto extends BaseFormDto {
  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(64, { message: 'tooLong' })
  planId!: string;
}

export class SubscriptionStatusDto extends BaseFormDto {
  @IsIn(['suspend', 'reactivate', 'cancel'], { message: 'invalidOption' })
  action!: 'suspend' | 'reactivate' | 'cancel';

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(200, { message: 'tooLong' })
  reason?: string;
}

export class SubscriptionSettingsDto extends BaseFormDto {
  @Matches(/^\d{1,3}$/, { message: 'invalidInteger' })
  graceDays!: string;

  @IsOptional()
  @Matches(OPTIONAL_DATE, { message: 'invalidDate' })
  trialEndsAt?: string;

  @IsOptional()
  @Matches(OPTIONAL_DATE, { message: 'invalidDate' })
  currentPeriodEnd?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(500, { message: 'tooLong' })
  note?: string;
}

export class TenantAdminDto extends BaseFormDto {
  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(120, { message: 'tooLong' })
  name!: string;

  @IsEmail({}, { message: 'invalidEmail' })
  @MaxLength(254, { message: 'tooLong' })
  email!: string;
}

export class RecordPaymentDto extends BaseFormDto {
  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(64, { message: 'tooLong' })
  restaurantId!: string;

  @Matches(AMOUNT_PATTERN, { message: 'invalidAmount' })
  amount!: string;

  @IsIn(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'], { message: 'invalidOption' })
  method!: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(100, { message: 'tooLong' })
  reference?: string;

  @Matches(DATE_PATTERN, { message: 'invalidDate' })
  paidAt!: string;

  @Matches(/^\d{1,2}$/, { message: 'invalidInteger' })
  periods!: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(300, { message: 'tooLong' })
  note?: string;
}

export class VoidPaymentDto extends BaseFormDto {
  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(200, { message: 'tooLong' })
  reason!: string;
}

/** The look a ready-made theme fills in. The values are checked in ThemesAdminService. */
export class ThemeDto extends BaseFormDto {
  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(80, { message: 'tooLong' })
  nameAr!: string;

  @IsNotEmpty({ message: 'required' })
  @IsString({ message: 'invalid' })
  @MaxLength(80, { message: 'tooLong' })
  nameEn!: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(200, { message: 'tooLong' })
  descriptionAr?: string;

  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(200, { message: 'tooLong' })
  descriptionEn?: string;

  @IsOptional()
  @Matches(/^$|^\d{1,4}$/, { message: 'invalidInteger' })
  sortOrder?: string;

  @IsString({ message: 'invalid' }) @MaxLength(7, { message: 'tooLong' }) primaryColor!: string;
  @IsString({ message: 'invalid' }) @MaxLength(7, { message: 'tooLong' }) secondaryColor!: string;
  @IsString({ message: 'invalid' }) @MaxLength(7, { message: 'tooLong' }) backgroundColor!: string;
  @IsString({ message: 'invalid' }) @MaxLength(32, { message: 'tooLong' }) fontTheme!: string;
  @IsString({ message: 'invalid' }) @MaxLength(32, { message: 'tooLong' }) cornerStyle!: string;
  @IsString({ message: 'invalid' }) @MaxLength(32, { message: 'tooLong' }) cardStyle!: string;
  @IsString({ message: 'invalid' }) @MaxLength(32, { message: 'tooLong' }) buttonShape!: string;
  @IsString({ message: 'invalid' }) @MaxLength(32, { message: 'tooLong' }) categoryDivider!: string;
  @IsString({ message: 'invalid' }) @MaxLength(32, { message: 'tooLong' }) categoryMarker!: string;
  @IsString({ message: 'invalid' }) @MaxLength(32, { message: 'tooLong' }) headingAlign!: string;
  @IsString({ message: 'invalid' }) @MaxLength(32, { message: 'tooLong' }) priceStyle!: string;
  @IsString({ message: 'invalid' }) @MaxLength(32, { message: 'tooLong' }) backgroundStyle!: string;
  @IsString({ message: 'invalid' })
  @MaxLength(32, { message: 'tooLong' })
  backgroundPattern!: string;
  @IsString({ message: 'invalid' }) @MaxLength(32, { message: 'tooLong' }) themeDecor!: string;
}

export class CreateThemeDto extends ThemeDto {
  @Matches(/^[a-z][a-zA-Z0-9]{1,30}$/, { message: 'invalid' })
  key!: string;
}
