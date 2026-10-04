import { Category, Item, ItemAddon, ItemVariant } from '@prisma/client';

export interface ItemOptionView {
  id: string;
  nameAr: string;
  nameEn: string;
  price: number;
  priceFormatted: string;
}

export interface ItemView extends Item {
  priceFormatted: string;
  variants: ItemOptionView[];
  addons: ItemOptionView[];
}

export interface CategoryView extends Omit<Category, 'items'> {
  items: ItemView[];
}

type CategoryWithItems = Category & {
  items: (Item & { variants: ItemVariant[]; addons: ItemAddon[] })[];
};

function toOptionView(option: ItemVariant | ItemAddon): ItemOptionView {
  return {
    id: option.id,
    nameAr: option.nameAr,
    nameEn: option.nameEn,
    price: Number(option.price),
    priceFormatted: Number(option.price).toFixed(2),
  };
}

/**
 * Admin templates show both nameAr and nameEn at once (editing one language
 * at a time isn't useful for bilingual content), so this only adds the
 * display-formatted price -- unlike the public menu's MenuService, it
 * never collapses a bilingual pair down to one locale's string.
 */
export function toCategoryViewList(categories: CategoryWithItems[]): CategoryView[] {
  return categories.map((category) => ({
    ...category,
    items: category.items.map(toItemView),
  }));
}

/** Single-item version of toCategoryViewList's per-item mapping, for the
 * three item.controller.ts handlers that re-render just one item's
 * partial (update/toggleAvailability/uploadImage) rather than its whole
 * category. */
export function toItemView(
  item: Item & { variants: ItemVariant[]; addons: ItemAddon[] },
): ItemView {
  return {
    ...item,
    priceFormatted: Number(item.price).toFixed(2),
    variants: item.variants.map(toOptionView),
    addons: item.addons.map(toOptionView),
  };
}
