import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseFormDto } from '../../common/validation/base-form.dto';

function text(max: number) {
  return (target: object, key: string) => {
    IsOptional()(target, key);
    IsString({ message: 'invalid' })(target, key);
    MaxLength(max, { message: 'tooLong' })(target, key);
  };
}

/**
 * Colors, hours and the choice groups keep their own rules in
 * RestaurantService (contrast checks, allowed values), which already
 * point at the exact field. The DTO guards type and length for all of
 * them and rejects any field the form does not send.
 */
export class UpdateBrandingDto extends BaseFormDto {
  @text(120) nameAr?: string;
  @text(120) nameEn?: string;
  @text(1000) descriptionAr?: string;
  @text(1000) descriptionEn?: string;
  @text(32) whatsapp?: string;
  @text(120) taglineAr?: string;
  @text(120) taglineEn?: string;
  @text(32) phone?: string;
  @text(200) facebookUrl?: string;
  @text(200) addressAr?: string;
  @text(200) addressEn?: string;
  @text(500) mapUrl?: string;
  @text(64) instagramHandle?: string;
  @text(200) workingHoursAr?: string;
  @text(200) workingHoursEn?: string;
  @text(5) openTime?: string;
  @text(5) closeTime?: string;
  @text(8) currency?: string;
  @text(32) primaryColor?: string;
  @text(32) secondaryColor?: string;
  @text(32) backgroundColor?: string;
  @text(32) fontTheme?: string;
  @text(32) menuDensity?: string;
  @text(32) cornerStyle?: string;
  @text(32) cardStyle?: string;
  @text(32) buttonShape?: string;
  @text(32) categoryDivider?: string;
  @text(32) backgroundStyle?: string;
  @text(32) backgroundPattern?: string;
  @text(32) sectionSpacing?: string;
}
