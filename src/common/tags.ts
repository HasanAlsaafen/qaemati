import { ItemTag } from '@prisma/client';

/** Shared between the public menu and the admin panel so both render tags identically.
 *  'warning' for the two allergen-caution tags (CONTAINS_NUTS/CONTAINS_DAIRY) -- a flag,
 *  not a selling point like VEGAN/VEGETARIAN's 'primary' or a neutral fact like
 *  GLUTEN_FREE's 'secondary'. */
export const TAG_VARIANT: Record<ItemTag, string> = {
  SPICY: 'danger',
  VEGETARIAN: 'primary',
  NEW: 'secondary',
  POPULAR: 'popular',
  VEGAN: 'primary',
  GLUTEN_FREE: 'secondary',
  CONTAINS_NUTS: 'warning',
  CONTAINS_DAIRY: 'warning',
};

export const TAG_I18N_KEY: Record<ItemTag, string> = {
  SPICY: 'common.tags.spicy',
  VEGETARIAN: 'common.tags.vegetarian',
  NEW: 'common.tags.new',
  POPULAR: 'common.tags.popular',
  VEGAN: 'common.tags.vegan',
  GLUTEN_FREE: 'common.tags.glutenFree',
  CONTAINS_NUTS: 'common.tags.containsNuts',
  CONTAINS_DAIRY: 'common.tags.containsDairy',
};

export const ALL_TAGS: ItemTag[] = [
  'SPICY',
  'VEGETARIAN',
  'NEW',
  'POPULAR',
  'VEGAN',
  'GLUTEN_FREE',
  'CONTAINS_NUTS',
  'CONTAINS_DAIRY',
];
