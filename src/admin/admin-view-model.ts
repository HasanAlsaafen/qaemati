import { Category, Item } from '@prisma/client';

export interface ItemView extends Item {
  priceFormatted: string;
}

export interface CategoryView extends Omit<Category, 'items'> {
  items: ItemView[];
}

type CategoryWithItems = Category & { items: Item[] };

/**
 * Admin templates show both nameAr and nameEn at once (editing one language
 * at a time isn't useful for bilingual content), so this only adds the
 * display-formatted price -- unlike the public menu's MenuService, it
 * never collapses a bilingual pair down to one locale's string.
 */
export function toCategoryViewList(categories: CategoryWithItems[]): CategoryView[] {
  return categories.map((category) => ({
    ...category,
    items: category.items.map((item) => ({
      ...item,
      priceFormatted: Number(item.price).toFixed(2),
    })),
  }));
}
