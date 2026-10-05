import { Injectable, NotFoundException } from '@nestjs/common';
import { ItemTag } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { Locale } from '../common/middleware/locale-view.middleware';
import { normalizeSearchText } from '../common/text/normalize-search-text';
import { TAG_I18N_KEY, TAG_VARIANT } from '../common/tags';
import {
  computeOpenStatus,
  isCategoryAvailableNow,
  nowInHebronMinutes,
} from '../common/open-status';
import { PrismaService } from '../prisma/prisma.service';
import { darken, hexToRgb, lighten, rgbToTriplet, toSecondaryPalette } from '../common/color';

export interface MenuOptionView {
  id: string;
  name: string;
  price: number;
  priceFormatted: string;
}

export interface MenuItemView {
  id: string;
  name: string;
  description: string | null;
  price: number;
  priceFormatted: string;
  currency: string;
  imageUrl: string | null;
  available: boolean;
  tags: { code: ItemTag; label: string; variant: string }[];
  /** B1: the allergen note, picked by locale -- null when the owner
   *  hasn't set one, shown on the item detail sheet alongside tags. */
  allergenNote: string | null;
  /** B1: comma-joined ItemTag codes (e.g. "VEGAN,SPICY") for the public
   *  menu's client-side tag filter (public/js/menu.js) to check against
   *  -- a plain string attribute is simpler to read off the DOM than
   *  re-deriving it from the already-localized `tags` array above. */
  tagCodes: string;
  searchText: string;
  addAriaLabel: string;
  variants: MenuOptionView[];
  addons: MenuOptionView[];
  /** priceFormatted of the cheapest variant, for the "From X" card price
   *  when variants exist -- null when the item has no variants, in which
   *  case the card shows the plain price as before. */
  fromPriceFormatted: string | null;
  isTodaysSpecial: boolean;
}

export interface OpenStatusView {
  isOpen: boolean;
  label: string;
  /** Raw "HH:MM" for the client-side ticking recomputation in
   *  public/js/open-status.js -- the server-rendered label is correct at
   *  render time, but without this the badge would only ever update on
   *  the next page load, not live across a closing/opening time. */
  openTime: string;
  closeTime: string;
}

export interface MenuCategoryView {
  id: string;
  name: string;
  anchor: string;
  items: MenuItemView[];
}

export interface MenuView {
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  whatsappUrl: string | null;
  instagramUrl: string | null;
  workingHours: string | null;
  openStatus: OpenStatusView | null;
  categories: MenuCategoryView[];
  todaysSpecials: MenuItemView[];
  /** A4: "R G B" triplets to override --color-primary (and friends) for
   *  a restaurant that picked its own brand color -- null when the
   *  restaurant hasn't set one, in which case the layout falls back to
   *  src/styles/tokens.css's own Zaytoun default, same "unset means use
   *  the house default" convention as every other optional field here. */
  primaryColorCss: { primary: string; primaryHover: string; primarySoft: string } | null;
  /** Admin customization: a second accent override, same "null means
   *  default" convention as primaryColorCss. */
  secondaryColorCss: {
    secondary: string;
    secondaryHover: string;
    secondaryText: string;
    secondarySoft: string;
  } | null;
  /** Admin customization: 'classic' | 'modern' -- see Restaurant.fontTheme. */
  fontTheme: string;
  /** Admin customization: 'comfortable' | 'compact' -- see Restaurant.menuDensity. */
  menuDensity: string;
  /** "R G B"-triplet-free CSS text overriding --radius-sm/md/lg for
   *  'sharp' -- null for 'rounded', the token defaults already in
   *  src/styles/tokens.css, same "null means default" convention as
   *  primaryColorCss/secondaryColorCss. See Restaurant.cornerStyle. */
  cornerStyleCss: { radiusSm: string; radiusMd: string; radiusLg: string } | null;
  /** "R G B" triplet overriding --color-bg -- null means the default
   *  Zaytoun cream, same convention as primaryColorCss. See
   *  Restaurant.backgroundColor. */
  backgroundColorCss: string | null;
  /** Admin customization: 'flat' | 'raised' -- see Restaurant.cardStyle. */
  cardStyle: string;
  /** Overrides --radius-button to a full pill for 'pill' -- null (the
   *  default) leaves it following --radius-md (and therefore
   *  cornerStyleCss too, see tokens.css) for 'rounded'. See
   *  Restaurant.buttonShape. */
  buttonShapeCss: { radiusButton: string } | null;
  /** Admin customization: 'none' | 'line' | 'dashed' between category
   *  sections -- see Restaurant.categoryDivider. */
  categoryDivider: string;
  /** Admin customization: 'solid' | 'pattern' | 'image' -- see
   *  Restaurant.backgroundStyle. */
  backgroundStyle: string;
  /** Which pattern to apply when backgroundStyle is 'pattern':
   *  'dots' | 'grid' | 'diagonal'. See Restaurant.backgroundPattern. */
  backgroundPattern: string;
  /** Set when backgroundStyle is 'image' -- not part of
   *  MenuPreviewOverrides (an uploaded file can't be previewed via a
   *  query param), so the live preview only reflects a background image
   *  after it's actually been uploaded and saved, same as logo/cover. */
  backgroundImageUrl: string | null;
  /** Admin customization: 'cozy' | 'comfortable' | 'spacious' -- the gap
   *  between category sections (not item-card spacing, which is
   *  menuDensity's job). See Restaurant.sectionSpacing. */
  sectionSpacing: string;
}

/**
 * The branding page's live preview is an iframe of this exact route (not
 * a hand-built mockup) so it's pixel-identical to the real menu -- these
 * are the as-you-type/drag values from that unsaved form, passed as
 * query params (see MenuController.show and branding-preview.njk).
 * restaurantId must match the fetched restaurant's own id (checked
 * below) before anything here is trusted: without that check, a visitor
 * on the *public* menu URL could pass the same query params and deface
 * the live page for every other visitor, since this would otherwise be
 * a plain unauthenticated reflected input.
 */
export interface MenuPreviewOverrides {
  restaurantId: string;
  name?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontTheme?: string;
  menuDensity?: string;
  cornerStyle?: string;
  backgroundColor?: string;
  cardStyle?: string;
  buttonShape?: string;
  categoryDivider?: string;
  backgroundStyle?: string;
  backgroundPattern?: string;
  sectionSpacing?: string;
}

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async getMenu(slug: string, locale: Locale, preview?: MenuPreviewOverrides): Promise<MenuView> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
              include: {
                variants: { orderBy: { sortOrder: 'asc' } },
                addons: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!restaurant) {
      throw new NotFoundException(`No restaurant with slug "${slug}"`);
    }

    const isPreviewOwner = Boolean(preview && preview.restaurantId === restaurant.id);
    const effectiveName = isPreviewOwner && preview!.name ? preview!.name : null;
    const effectivePrimaryColor =
      isPreviewOwner && preview!.primaryColor ? preview!.primaryColor : restaurant.primaryColor;
    const effectiveSecondaryColor =
      isPreviewOwner && preview!.secondaryColor
        ? preview!.secondaryColor
        : restaurant.secondaryColor;
    const effectiveFontTheme =
      isPreviewOwner && preview!.fontTheme ? preview!.fontTheme : restaurant.fontTheme;
    const effectiveMenuDensity =
      isPreviewOwner && preview!.menuDensity ? preview!.menuDensity : restaurant.menuDensity;
    const effectiveCornerStyle =
      isPreviewOwner && preview!.cornerStyle ? preview!.cornerStyle : restaurant.cornerStyle;
    const effectiveBackgroundColor =
      isPreviewOwner && preview!.backgroundColor
        ? preview!.backgroundColor
        : restaurant.backgroundColor;
    const effectiveCardStyle =
      isPreviewOwner && preview!.cardStyle ? preview!.cardStyle : restaurant.cardStyle;
    const effectiveButtonShape =
      isPreviewOwner && preview!.buttonShape ? preview!.buttonShape : restaurant.buttonShape;
    const effectiveCategoryDivider =
      isPreviewOwner && preview!.categoryDivider
        ? preview!.categoryDivider
        : restaurant.categoryDivider;
    const effectiveBackgroundStyle =
      isPreviewOwner && preview!.backgroundStyle
        ? preview!.backgroundStyle
        : restaurant.backgroundStyle;
    const effectiveBackgroundPattern =
      isPreviewOwner && preview!.backgroundPattern
        ? preview!.backgroundPattern
        : restaurant.backgroundPattern;
    const effectiveSectionSpacing =
      isPreviewOwner && preview!.sectionSpacing
        ? preview!.sectionSpacing
        : restaurant.sectionSpacing;

    const pick = (ar: string, en: string) => (locale === 'ar' ? ar : en);
    const pickNullable = (ar: string | null, en: string | null) => (locale === 'ar' ? ar : en);
    const nowMinutes = nowInHebronMinutes();

    const openStatus: OpenStatusView | null =
      restaurant.openTime && restaurant.closeTime
        ? (() => {
            const status = computeOpenStatus(
              restaurant.openTime!,
              restaurant.closeTime!,
              nowMinutes,
            );
            const labelKey = status.isOpen
              ? 'common.menu.openStatus.openUntil'
              : 'common.menu.openStatus.closedUntil';
            return {
              isOpen: status.isOpen,
              label: this.i18n.t(labelKey, { lang: locale, args: { time: status.nextChangeTime } }),
              openTime: restaurant.openTime!,
              closeTime: restaurant.closeTime!,
            };
          })()
        : null;

    const todaysSpecials: MenuItemView[] = [];

    const categories = restaurant.categories
      .filter((category) =>
        isCategoryAvailableNow(category.availableFrom, category.availableTo, nowMinutes),
      )
      .map((category) => ({
        id: category.id,
        name: pick(category.nameAr, category.nameEn),
        anchor: `category-${category.id}`,
        items: category.items.map((item) => {
          const name = pick(item.nameAr, item.nameEn);
          const description = pickNullable(item.descriptionAr, item.descriptionEn);
          const searchParts = [item.nameAr, item.nameEn, item.descriptionAr, item.descriptionEn]
            .filter((part): part is string => Boolean(part))
            .map(normalizeSearchText);

          const variants = item.variants.map((variant) => ({
            id: variant.id,
            name: pick(variant.nameAr, variant.nameEn),
            price: Number(variant.price),
            priceFormatted: Number(variant.price).toFixed(2),
          }));
          const addons = item.addons.map((addon) => ({
            id: addon.id,
            name: pick(addon.nameAr, addon.nameEn),
            price: Number(addon.price),
            priceFormatted: Number(addon.price).toFixed(2),
          }));
          const cheapestVariant = variants.reduce<MenuOptionView | null>(
            (min, variant) => (!min || variant.price < min.price ? variant : min),
            null,
          );

          const itemView: MenuItemView = {
            id: item.id,
            name,
            description,
            price: Number(item.price),
            priceFormatted: Number(item.price).toFixed(2),
            currency: item.currency,
            imageUrl: item.imagePath,
            available: item.available,
            tags: item.tags.map((tag) => ({
              code: tag,
              label: this.i18n.t(TAG_I18N_KEY[tag], { lang: locale }),
              variant: TAG_VARIANT[tag],
            })),
            allergenNote: pickNullable(item.allergenNoteAr, item.allergenNoteEn),
            tagCodes: item.tags.join(','),
            searchText: searchParts.join(' '),
            addAriaLabel: this.i18n.t('common.menu.selection.addAriaLabel', {
              lang: locale,
              args: { name },
            }),
            variants,
            addons,
            fromPriceFormatted: cheapestVariant ? cheapestVariant.priceFormatted : null,
            isTodaysSpecial: item.isTodaysSpecial,
          };

          if (item.isTodaysSpecial && item.available) {
            todaysSpecials.push(itemView);
          }

          return itemView;
        }),
      }));

    return {
      slug: restaurant.slug,
      name: effectiveName ?? pick(restaurant.nameAr, restaurant.nameEn),
      description: pickNullable(restaurant.descriptionAr, restaurant.descriptionEn),
      logoUrl: restaurant.logoPath,
      coverImageUrl: restaurant.coverImagePath,
      whatsappUrl: restaurant.whatsapp ? toWhatsappUrl(restaurant.whatsapp) : null,
      instagramUrl: restaurant.instagramHandle ? toInstagramUrl(restaurant.instagramHandle) : null,
      workingHours: pickNullable(restaurant.workingHoursAr, restaurant.workingHoursEn),
      openStatus,
      categories,
      todaysSpecials,
      primaryColorCss: toPrimaryColorCss(effectivePrimaryColor),
      secondaryColorCss: toSecondaryColorCss(effectiveSecondaryColor),
      fontTheme: effectiveFontTheme,
      menuDensity: effectiveMenuDensity,
      cornerStyleCss: toCornerStyleCss(effectiveCornerStyle),
      backgroundColorCss: toBackgroundColorCss(effectiveBackgroundColor),
      cardStyle: effectiveCardStyle,
      buttonShapeCss: toButtonShapeCss(effectiveButtonShape),
      categoryDivider: effectiveCategoryDivider,
      backgroundStyle: effectiveBackgroundStyle,
      backgroundPattern: effectiveBackgroundPattern,
      backgroundImageUrl: restaurant.backgroundImagePath,
      sectionSpacing: effectiveSectionSpacing,
    };
  }
}

function toWhatsappUrl(rawPhone: string): string {
  const digits = rawPhone.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}`;
}

function toInstagramUrl(handle: string): string {
  const username = handle.replace(/^@/, '');
  return `https://instagram.com/${username}`;
}

function toPrimaryColorCss(
  primaryColor: string | null,
): { primary: string; primaryHover: string; primarySoft: string } | null {
  if (!primaryColor) return null;
  const rgb = hexToRgb(primaryColor);
  if (!rgb) return null;
  return {
    primary: rgbToTriplet(rgb),
    primaryHover: rgbToTriplet(darken(rgb)),
    primarySoft: rgbToTriplet(lighten(rgb)),
  };
}

function toSecondaryColorCss(secondaryColor: string | null): {
  secondary: string;
  secondaryHover: string;
  secondaryText: string;
  secondarySoft: string;
} | null {
  if (!secondaryColor) return null;
  const rgb = hexToRgb(secondaryColor);
  if (!rgb) return null;
  const palette = toSecondaryPalette(rgb);
  return {
    secondary: rgbToTriplet(palette.secondary),
    secondaryHover: rgbToTriplet(palette.secondaryHover),
    secondaryText: rgbToTriplet(palette.secondaryText),
    secondarySoft: rgbToTriplet(palette.secondarySoft),
  };
}

/** 'sharp' trades tokens.css's 6px/10px/16px for a crisp near-square
 *  look; 'rounded' (and anything else) keeps the defaults by returning
 *  null, same convention as the color overrides above. */
function toCornerStyleCss(
  cornerStyle: string,
): { radiusSm: string; radiusMd: string; radiusLg: string } | null {
  if (cornerStyle !== 'sharp') return null;
  return { radiusSm: '2px', radiusMd: '4px', radiusLg: '6px' };
}

function toBackgroundColorCss(backgroundColor: string | null): string | null {
  if (!backgroundColor) return null;
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return null;
  return rgbToTriplet(rgb);
}

/** 'pill' overrides --radius-button to a full pill; 'rounded' (and
 *  anything else) returns null so the button stays on tokens.css's
 *  default `--radius-button: var(--radius-md)` chain -- which already
 *  tracks cornerStyleCss's own --radius-md override when set. */
function toButtonShapeCss(buttonShape: string): { radiusButton: string } | null {
  if (buttonShape !== 'pill') return null;
  return { radiusButton: '9999px' };
}
