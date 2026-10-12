import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  hexToRgb,
  meetsBackgroundContrast,
  meetsPrimaryColorContrast,
  meetsSecondaryColorContrast,
} from '../common/color';
import { thmanyahEnabled } from '../common/thmanyah';
import {
  FONT_THEMES,
  MENU_DENSITIES,
  CORNER_STYLES,
  CARD_STYLES,
  BUTTON_SHAPES,
  CATEGORY_DIVIDERS,
  BACKGROUND_STYLES,
  BACKGROUND_PATTERNS,
  MENU_LAYOUTS,
  ITEM_IMAGE_MODES,
  ITEM_IMAGE_SHAPES,
  CATEGORY_MARKERS,
  LOGO_SHAPES,
  COVER_HEIGHTS,
  PRICE_STYLES,
  HEADING_ALIGNS,
  THEME_DECORS,
  SECTION_SPACINGS,
} from './look-options';
import { isValidFacebook, isValidMapUrl, isValidPhone, toFacebookUrl } from '../common/contact';

export interface RestaurantDetailsInput {
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  whatsapp?: string | null;
  instagramHandle?: string | null;
  taglineAr?: string | null;
  taglineEn?: string | null;
  phone?: string | null;
  facebookUrl?: string | null;
  addressAr?: string | null;
  addressEn?: string | null;
  mapUrl?: string | null;
  workingHoursAr?: string | null;
  workingHoursEn?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  currency: string;
  /** Null clears back to the default palette. */
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontTheme?: string;
  menuDensity?: string;
  cornerStyle?: string;
  /** Null clears back to the default page color. */
  backgroundColor?: string | null;
  cardStyle?: string;
  buttonShape?: string;
  categoryDivider?: string;
  logoShape?: string;
  coverHeight?: string;
  priceStyle?: string;
  headingAlign?: string;
  themeDecor?: string;
  menuLayout?: string;
  itemImages?: string;
  itemImageShape?: string;
  categoryMarker?: string;
  backgroundStyle?: string;
  backgroundPattern?: string;
  sectionSpacing?: string;
}

@Injectable()
export class RestaurantService {
  constructor(private readonly prisma: PrismaService) {}

  /** The ready-made themes an owner can start from, in the platform owner's order. */
  activeThemes() {
    return this.prisma.brandTheme.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

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

    if (input.phone && !isValidPhone(input.phone)) {
      throw new BadRequestException('INVALID_PHONE');
    }
    if (input.facebookUrl && !isValidFacebook(input.facebookUrl)) {
      throw new BadRequestException('INVALID_FACEBOOK');
    }
    if (input.mapUrl && !isValidMapUrl(input.mapUrl)) {
      throw new BadRequestException('INVALID_MAP_URL');
    }

    const primaryColor = this.validatePrimaryColor(input.primaryColor);
    const secondaryColor = this.validateSecondaryColor(input.secondaryColor);
    const fontTheme = this.validateChoice(
      input.fontTheme,
      thmanyahEnabled() ? new Set([...FONT_THEMES, 'thmanyah']) : FONT_THEMES,
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
    const menuLayout = this.validateChoice(
      input.menuLayout,
      MENU_LAYOUTS,
      'grid',
      'INVALID_MENU_LAYOUT',
    );
    const itemImages = this.validateChoice(
      input.itemImages,
      ITEM_IMAGE_MODES,
      'show',
      'INVALID_ITEM_IMAGES',
    );
    const itemImageShape = this.validateChoice(
      input.itemImageShape,
      ITEM_IMAGE_SHAPES,
      'standard',
      'INVALID_ITEM_IMAGE_SHAPE',
    );
    const categoryMarker = this.validateChoice(
      input.categoryMarker,
      CATEGORY_MARKERS,
      'none',
      'INVALID_CATEGORY_MARKER',
    );
    const logoShape = this.validateChoice(
      input.logoShape,
      LOGO_SHAPES,
      'rounded',
      'INVALID_LOGO_SHAPE',
    );
    const coverHeight = this.validateChoice(
      input.coverHeight,
      COVER_HEIGHTS,
      'medium',
      'INVALID_COVER_HEIGHT',
    );
    const priceStyle = this.validateChoice(
      input.priceStyle,
      PRICE_STYLES,
      'plain',
      'INVALID_PRICE_STYLE',
    );
    const headingAlign = this.validateChoice(
      input.headingAlign,
      HEADING_ALIGNS,
      'start',
      'INVALID_HEADING_ALIGN',
    );
    const themeDecor = this.validateChoice(
      input.themeDecor,
      THEME_DECORS,
      'none',
      'INVALID_THEME_DECOR',
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
        taglineAr: input.taglineAr ?? null,
        taglineEn: input.taglineEn ?? null,
        phone: input.phone?.trim() || null,
        facebookUrl: input.facebookUrl ? toFacebookUrl(input.facebookUrl) : null,
        addressAr: input.addressAr ?? null,
        addressEn: input.addressEn ?? null,
        mapUrl: input.mapUrl?.trim() || null,
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
        logoShape,
        coverHeight,
        priceStyle,
        headingAlign,
        themeDecor,
        menuLayout,
        itemImages,
        itemImageShape,
        categoryMarker,
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

  /** Clears the logo, cover or background photo. A background style of
   *  "image" with no photo would show nothing, so it goes back to solid. */
  async removeImage(restaurantId: string, kind: 'logo' | 'cover' | 'background') {
    const restaurant = await this.findById(restaurantId);
    const data =
      kind === 'logo'
        ? { logoPath: null }
        : kind === 'cover'
          ? { coverImagePath: null }
          : {
              backgroundImagePath: null,
              ...(restaurant.backgroundStyle === 'image' ? { backgroundStyle: 'solid' } : {}),
            };
    return this.prisma.restaurant.update({ where: { id: restaurantId }, data });
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
