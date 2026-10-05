import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  hexToRgb,
  meetsBackgroundContrast,
  meetsPrimaryColorContrast,
  meetsSecondaryColorContrast,
} from '../common/color';

const FONT_THEMES = new Set(['classic', 'modern']);
const MENU_DENSITIES = new Set(['comfortable', 'compact']);
const CORNER_STYLES = new Set(['rounded', 'sharp']);
const CARD_STYLES = new Set(['flat', 'raised']);
const BUTTON_SHAPES = new Set(['rounded', 'pill']);
const CATEGORY_DIVIDERS = new Set(['none', 'line', 'dashed']);
const BACKGROUND_STYLES = new Set(['solid', 'pattern', 'image']);
const BACKGROUND_PATTERNS = new Set(['dots', 'grid', 'diagonal']);
const SECTION_SPACINGS = new Set(['cozy', 'comfortable', 'spacious']);

export interface RestaurantDetailsInput {
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  whatsapp?: string | null;
  instagramHandle?: string | null;
  workingHoursAr?: string | null;
  workingHoursEn?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  currency: string;
  /** Null clears back to the default Zaytoun palette. */
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontTheme?: string;
  menuDensity?: string;
  cornerStyle?: string;
  /** Null clears back to the default Zaytoun cream. */
  backgroundColor?: string | null;
  cardStyle?: string;
  buttonShape?: string;
  categoryDivider?: string;
  backgroundStyle?: string;
  backgroundPattern?: string;
  sectionSpacing?: string;
}

@Injectable()
export class RestaurantService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  async update(restaurantId: string, input: RestaurantDetailsInput) {
    await this.findById(restaurantId);

    const hasWindow = Boolean(input.openTime) && Boolean(input.closeTime);
    if ((input.openTime || input.closeTime) && !hasWindow) {
      throw new BadRequestException('OPEN_CLOSE_BOTH_REQUIRED');
    }

    const primaryColor = this.validatePrimaryColor(input.primaryColor);
    const secondaryColor = this.validateSecondaryColor(input.secondaryColor);
    const fontTheme = this.validateChoice(
      input.fontTheme,
      FONT_THEMES,
      'classic',
      'INVALID_FONT_THEME',
    );
    const menuDensity = this.validateChoice(
      input.menuDensity,
      MENU_DENSITIES,
      'comfortable',
      'INVALID_MENU_DENSITY',
    );
    const cornerStyle = this.validateChoice(
      input.cornerStyle,
      CORNER_STYLES,
      'rounded',
      'INVALID_CORNER_STYLE',
    );
    const backgroundColor = this.validateBackgroundColor(input.backgroundColor);
    const cardStyle = this.validateChoice(
      input.cardStyle,
      CARD_STYLES,
      'flat',
      'INVALID_CARD_STYLE',
    );
    const buttonShape = this.validateChoice(
      input.buttonShape,
      BUTTON_SHAPES,
      'rounded',
      'INVALID_BUTTON_SHAPE',
    );
    const categoryDivider = this.validateChoice(
      input.categoryDivider,
      CATEGORY_DIVIDERS,
      'none',
      'INVALID_CATEGORY_DIVIDER',
    );
    const backgroundStyle = this.validateChoice(
      input.backgroundStyle,
      BACKGROUND_STYLES,
      'solid',
      'INVALID_BACKGROUND_STYLE',
    );
    const backgroundPattern = this.validateChoice(
      input.backgroundPattern,
      BACKGROUND_PATTERNS,
      'dots',
      'INVALID_BACKGROUND_PATTERN',
    );
    const sectionSpacing = this.validateChoice(
      input.sectionSpacing,
      SECTION_SPACINGS,
      'comfortable',
      'INVALID_SECTION_SPACING',
    );

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descriptionAr: input.descriptionAr ?? null,
        descriptionEn: input.descriptionEn ?? null,
        whatsapp: input.whatsapp ?? null,
        instagramHandle: input.instagramHandle ?? null,
        workingHoursAr: input.workingHoursAr ?? null,
        workingHoursEn: input.workingHoursEn ?? null,
        openTime: hasWindow ? input.openTime : null,
        closeTime: hasWindow ? input.closeTime : null,
        currency: input.currency,
        primaryColor,
        secondaryColor,
        fontTheme,
        menuDensity,
        cornerStyle,
        backgroundColor,
        cardStyle,
        buttonShape,
        categoryDivider,
        backgroundStyle,
        backgroundPattern,
        sectionSpacing,
      },
    });
  }

  async setLogo(restaurantId: string, logoPath: string) {
    await this.findById(restaurantId);
    return this.prisma.restaurant.update({ where: { id: restaurantId }, data: { logoPath } });
  }

  async setCoverImage(restaurantId: string, coverImagePath: string) {
    await this.findById(restaurantId);
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { coverImagePath },
    });
  }

  async setBackgroundImage(restaurantId: string, backgroundImagePath: string) {
    await this.findById(restaurantId);
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { backgroundImagePath },
    });
  }

  /** Re-validated here even though the admin form's live JS already
   *  blocks submission for a failing color -- the form can be bypassed
   *  (curl, a modified request), and a bad primary color isn't just a
   *  cosmetic nit, it would make every button/badge label unreadable
   *  for every diner on the public menu. Error codes name the field
   *  (INVALID_PRIMARY_COLOR, not INVALID_COLOR) so BrandingController
   *  can attach the message to the one input that's actually wrong
   *  instead of a form-wide toast -- see its fieldErrors mapping. */
  private validatePrimaryColor(input: string | null | undefined): string | null {
    if (!input) return null;
    const rgb = hexToRgb(input);
    if (!rgb) throw new BadRequestException('INVALID_PRIMARY_COLOR');
    if (!meetsPrimaryColorContrast(rgb)) {
      throw new BadRequestException('PRIMARY_COLOR_CONTRAST_TOO_LOW');
    }
    return input.startsWith('#') ? input : `#${input}`;
  }

  private validateSecondaryColor(input: string | null | undefined): string | null {
    if (!input) return null;
    const rgb = hexToRgb(input);
    if (!rgb) throw new BadRequestException('INVALID_SECONDARY_COLOR');
    if (!meetsSecondaryColorContrast(rgb)) {
      throw new BadRequestException('SECONDARY_COLOR_CONTRAST_TOO_LOW');
    }
    return input.startsWith('#') ? input : `#${input}`;
  }

  private validateBackgroundColor(input: string | null | undefined): string | null {
    if (!input) return null;
    const rgb = hexToRgb(input);
    if (!rgb) throw new BadRequestException('INVALID_BACKGROUND_COLOR');
    if (!meetsBackgroundContrast(rgb)) {
      throw new BadRequestException('BACKGROUND_COLOR_CONTRAST_TOO_LOW');
    }
    return input.startsWith('#') ? input : `#${input}`;
  }

  private validateChoice(
    input: string | undefined,
    allowed: Set<string>,
    fallback: string,
    errorCode: string,
  ): string {
    const value = input || fallback;
    if (!allowed.has(value)) throw new BadRequestException(errorCode);
    return value;
  }
}
