import { ItemTag } from '@prisma/client';

/** Shared between the public menu and the admin panel so both render tags identically. */
export const TAG_VARIANT: Record<ItemTag, string> = {
  SPICY: 'danger',
  VEGETARIAN: 'primary',
  NEW: 'secondary',
  POPULAR: 'popular',
};

export const TAG_I18N_KEY: Record<ItemTag, string> = {
  SPICY: 'common.tags.spicy',
  VEGETARIAN: 'common.tags.vegetarian',
  NEW: 'common.tags.new',
  POPULAR: 'common.tags.popular',
};

export const ALL_TAGS: ItemTag[] = ['SPICY', 'VEGETARIAN', 'NEW', 'POPULAR'];
