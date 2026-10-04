import { Injectable, NotFoundException } from '@nestjs/common';
import { ItemTag } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { Locale } from '../common/middleware/locale-view.middleware';
import { normalizeSearchText } from '../common/text/normalize-search-text';
import { TAG_I18N_KEY, TAG_VARIANT } from '../common/tags';
import { PrismaService } from '../prisma/prisma.service';

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
  searchText: string;
  addAriaLabel: string;
  variants: MenuOptionView[];
  addons: MenuOptionView[];
  /** priceFormatted of the cheapest variant, for the "From X" card price
   *  when variants exist -- null when the item has no variants, in which
   *  case the card shows the plain price as before. */
  fromPriceFormatted: string | null;
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
  whatsappUrl: string | null;
  instagramUrl: string | null;
  workingHours: string | null;
  categories: MenuCategoryView[];
}

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async getMenu(slug: string, locale: Locale): Promise<MenuView> {
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

    const pick = (ar: string, en: string) => (locale === 'ar' ? ar : en);
    const pickNullable = (ar: string | null, en: string | null) => (locale === 'ar' ? ar : en);

    return {
      slug: restaurant.slug,
      name: pick(restaurant.nameAr, restaurant.nameEn),
      description: pickNullable(restaurant.descriptionAr, restaurant.descriptionEn),
      logoUrl: restaurant.logoPath,
      whatsappUrl: restaurant.whatsapp ? toWhatsappUrl(restaurant.whatsapp) : null,
      instagramUrl: restaurant.instagramHandle ? toInstagramUrl(restaurant.instagramHandle) : null,
      workingHours: pickNullable(restaurant.workingHoursAr, restaurant.workingHoursEn),
      categories: restaurant.categories.map((category) => ({
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

          return {
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
            searchText: searchParts.join(' '),
            addAriaLabel: this.i18n.t('common.menu.selection.addAriaLabel', {
              lang: locale,
              args: { name },
            }),
            variants,
            addons,
            fromPriceFormatted: cheapestVariant ? cheapestVariant.priceFormatted : null,
          };
        }),
      })),
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
