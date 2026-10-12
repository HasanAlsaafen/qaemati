import { Prisma, PrismaClient } from '@prisma/client';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * What turns the two sample restaurants into a tour of the whole product: a
 * different look for each, sizes and extras on some dishes, owner pairings,
 * three weeks of orders and visits (so the reports and "ordered together"
 * suggestions have something to say) and tables in different states.
 * Everything is deterministic, so a reset always gives the same demo.
 */

const PHOTOS_DIR = join(__dirname, '..', '..', 'public', 'demo-photos');

export const slugOf = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** The path of a real photo for this dish or cover, when one was downloaded. */
export function demoPhoto(name: string): string | null {
  const file = `${slugOf(name)}.jpg`;
  return existsSync(join(PHOTOS_DIR, file)) ? `/demo-photos/${file}` : null;
}

/** The restaurant's logo, drawn for the demo (original artwork, no license to track). */
export function demoLogo(slug: string): string | null {
  const file = `logo-${slug}.svg`;
  return existsSync(join(PHOTOS_DIR, file)) ? `/demo-photos/${file}` : null;
}

/** A dish photo that stands for each category. */
const categoryPhotos: Record<string, string> = {
  'Hot Drinks': 'Cappuccino',
  'Cold Drinks': 'Iced Matcha',
  Breakfast: 'Shakshuka',
  'Manakeesh & Savory Pastries': 'Manakeesh Zaatar',
  Sandwiches: 'Chicken Shawarma Sandwich',
  'Sweets & Desserts': 'Baklava',
  'Light Bites': 'Hummus with Pita',
  Appetizers: 'Hummus',
  'Soups & Salads': 'Fattoush',
  Grills: 'Chicken Shish Tawook',
  'Rice & Stews': 'Maqluba',
  'Vegetarian Mains': 'Stuffed Zucchini',
  Desserts: 'Um Ali',
};

export function demoCategoryPhoto(categoryNameEn: string): string | null {
  const dish = categoryPhotos[categoryNameEn];
  return dish ? demoPhoto(dish) : null;
}

/** Each restaurant gets its own look, to show how far branding can go. */
export const demoBranding: Record<string, Record<string, string>> = {
  'bayt-al-zaytoun': {
    fontTheme: 'cairo',
    secondaryColor: '#E8913A',
    backgroundColor: '#FBF6EE',
    menuLayout: 'grid',
    cardStyle: 'raised',
    cornerStyle: 'soft',
    buttonShape: 'pill',
    logoShape: 'round',
    coverHeight: 'large',
    priceStyle: 'badge',
    headingAlign: 'center',
    categoryMarker: 'dot',
    categoryDivider: 'fade',
    themeDecor: 'olive',
  },
  'al-sanabel': {
    fontTheme: 'serif',
    secondaryColor: '#B8862B',
    menuLayout: 'list',
    cardStyle: 'outlined',
    cornerStyle: 'sharp',
    buttonShape: 'square',
    logoShape: 'square',
    coverHeight: 'large',
    priceStyle: 'muted',
    categoryMarker: 'rule',
    categoryDivider: 'ornament',
    backgroundStyle: 'pattern',
    backgroundPattern: 'diamonds',
    themeDecor: 'ramadan',
  },
};

export const demoCover: Record<string, string> = {
  'bayt-al-zaytoun': 'cover-cafe',
  'al-sanabel': 'cover-grill',
};

interface Option {
  nameAr: string;
  nameEn: string;
  price: number;
}

/** Sizes (the price replaces the base price) and extras (added to it), by dish. */
export const demoVariants: Record<string, Option[]> = {
  Cappuccino: [
    { nameAr: 'صغير', nameEn: 'Small', price: 13 },
    { nameAr: 'كبير', nameEn: 'Large', price: 19 },
  ],
  'Spanish Latte': [
    { nameAr: 'وسط', nameEn: 'Regular', price: 18 },
    { nameAr: 'كبير', nameEn: 'Large', price: 23 },
  ],
  'Fresh Orange Juice': [
    { nameAr: 'كوب', nameEn: 'Glass', price: 15 },
    { nameAr: 'إبريق', nameEn: 'Jug', price: 38 },
  ],
  'Mixed Grill': [
    { nameAr: 'لشخص', nameEn: 'For one', price: 14 },
    { nameAr: 'لشخصين', nameEn: 'For two', price: 26 },
    { nameAr: 'للعائلة', nameEn: 'Family', price: 48 },
  ],
  Maqluba: [
    { nameAr: 'طبق', nameEn: 'Plate', price: 9 },
    { nameAr: 'صينية للعائلة', nameEn: 'Family tray', price: 28 },
  ],
};

export const demoAddons: Record<string, Option[]> = {
  Cappuccino: [
    { nameAr: 'شوت إضافي', nameEn: 'Extra shot', price: 4 },
    { nameAr: 'حليب شوفان', nameEn: 'Oat milk', price: 3 },
  ],
  Shakshuka: [
    { nameAr: 'بيضة إضافية', nameEn: 'Extra egg', price: 5 },
    { nameAr: 'جبنة حلوم', nameEn: 'Halloumi', price: 6 },
  ],
  'Falafel Sandwich': [{ nameAr: 'فلافل إضافية', nameEn: 'Extra falafel', price: 4 }],
  'Chicken Shawarma Sandwich': [
    { nameAr: 'صلصة ثوم', nameEn: 'Garlic sauce', price: 2 },
    { nameAr: 'مخلل', nameEn: 'Pickles', price: 1 },
  ],
  'Lamb Kofta': [{ nameAr: 'خبز إضافي', nameEn: 'Extra bread', price: 0.5 }],
  Hummus: [{ nameAr: 'لحمة وصنوبر', nameEn: 'With meat and pine nuts', price: 2.5 }],
};

/** What the owner says goes well together, by restaurant. */
export const demoPairings: Record<string, [string, string[]][]> = {
  'bayt-al-zaytoun': [
    ['Manakeesh Zaatar', ['Cappuccino', 'Mint Lemonade']],
    ['Shakshuka', ['Fresh Orange Juice', 'Turkish Coffee']],
    ['Knafeh Nabulsieh', ['Arabic Coffee', 'Turkish Coffee']],
    ['Falafel Sandwich', ['Iced Latte', 'Mint Lemonade']],
  ],
  'al-sanabel': [
    ['Mixed Grill', ['Fattoush', 'Hummus']],
    ['Mansaf', ['Lentil Soup', 'Um Ali']],
    ['Lamb Kofta', ['Tabbouleh', 'Hummus']],
  ],
};

/** Baskets real guests would order, used to build the order history. */
const baskets: Record<string, string[][]> = {
  'bayt-al-zaytoun': [
    ['Cappuccino', 'Manakeesh Zaatar'],
    ['Cappuccino', 'Baklava Assortment'],
    ['Spanish Latte', 'Cheese Sambousek'],
    ['Shakshuka', 'Fresh Orange Juice'],
    ['Falafel Sandwich', 'Mint Lemonade'],
    ['Hummus with Pita', 'Iced Latte'],
    ['Chicken Shawarma Sandwich', 'Iced Latte'],
    ['Turkish Coffee', 'Knafeh Nabulsieh'],
    ['Pancakes with Honey', 'Hot Chocolate'],
    ['Manakeesh Cheese', 'Cappuccino'],
  ],
  'al-sanabel': [
    ['Hummus', 'Fattoush', 'Mixed Grill'],
    ['Mansaf', 'Lentil Soup'],
    ['Maqluba', 'Lentil Soup'],
    ['Lamb Kofta', 'Tabbouleh', 'Hummus'],
    ['Chicken Shish Tawook', 'Fattoush'],
    ['Mixed Grill', 'Um Ali'],
    ['Lamb Chops', 'Rice Pudding'],
  ],
};

export interface DemoDish {
  id: string;
  nameAr: string;
  nameEn: string;
  price: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** A small repeatable random number generator, so a reset never changes the story. */
function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Three weeks of finished orders and menu visits, a few suggestion taps, and
 * live tables: one with an order in the kitchen, one asking for the bill, one
 * free. Returns how many orders it created.
 */
export async function seedDemoActivity(
  prisma: PrismaClient,
  restaurant: { id: string; slug: string; currency: string },
  tables: { id: string; label: string }[],
  dishes: Map<string, DemoDish>,
): Promise<number> {
  const random = rng(restaurant.slug.length * 7919);
  const picks = (baskets[restaurant.slug] ?? []).filter((names) =>
    names.every((n) => dishes.has(n)),
  );
  if (picks.length === 0 || tables.length === 0) return 0;
  const now = Date.now();
  let number = 1000;

  const orderData = (
    names: string[],
    when: number,
    table: { id: string; label: string },
    status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED',
  ): Prisma.OrderCreateInput => {
    const lines = names.map((name) => {
      const dish = dishes.get(name)!;
      const quantity = random() < 0.25 ? 2 : 1;
      return { dish, quantity };
    });
    const total = lines.reduce((sum, l) => sum + l.dish.price * l.quantity, 0);
    return {
      restaurant: { connect: { id: restaurant.id } },
      table: { connect: { id: table.id } },
      tableLabel: table.label,
      number: number++,
      status,
      total,
      currency: restaurant.currency,
      createdAt: new Date(when),
      statusChangedAt: new Date(when + 12 * 60_000),
      items: {
        create: lines.map(({ dish, quantity }) => ({
          itemId: dish.id,
          nameAr: dish.nameAr,
          nameEn: dish.nameEn,
          quantity,
          unitPrice: dish.price,
          lineTotal: dish.price * quantity,
        })),
      },
    };
  };

  // Finished orders: busier at lunch and in the evening, and on weekends.
  let history = 0;
  for (let day = 21; day >= 1; day--) {
    const date = new Date(now - day * DAY);
    const perDay = 3 + Math.floor(random() * 4) + (date.getDay() % 6 === 5 ? 3 : 0);
    for (let i = 0; i < perDay; i++) {
      const hour = random() < 0.5 ? 12 + Math.floor(random() * 3) : 18 + Math.floor(random() * 4);
      const when = new Date(date).setHours(hour, Math.floor(random() * 60), 0, 0);
      const basket = picks[Math.floor(random() * picks.length)];
      await prisma.order.create({
        data: orderData(basket, when, tables[Math.floor(random() * tables.length)], 'SERVED'),
      });
      history++;
    }
  }

  // Menu visits and dish views for the analytics page.
  const views: Prisma.MenuViewCreateManyInput[] = [];
  const everyDish = [...dishes.values()];
  for (let day = 21; day >= 0; day--) {
    const count = 14 + Math.floor(random() * 22);
    for (let i = 0; i < count; i++) {
      const when = new Date(now - day * DAY - Math.floor(random() * 12 * 60 * 60_000));
      views.push({
        restaurantId: restaurant.id,
        itemId: random() < 0.6 ? everyDish[Math.floor(random() * everyDish.length)].id : null,
        createdAt: when,
      });
    }
  }
  await prisma.menuView.createMany({ data: views });

  // Guests who tapped a suggestion.
  const reasons = ['pairing', 'together', 'popular'];
  await prisma.suggestionAdd.createMany({
    data: Array.from({ length: 24 }, (_, i) => ({
      restaurantId: restaurant.id,
      itemId: everyDish[(i * 5) % everyDish.length].id,
      reason: reasons[i % 3],
      createdAt: new Date(now - Math.floor(random() * 14 * DAY)),
    })),
  });

  // Owner pairings.
  for (const [dish, partners] of demoPairings[restaurant.slug] ?? []) {
    const from = dishes.get(dish);
    if (!from) continue;
    for (const [index, partner] of partners.entries()) {
      const to = dishes.get(partner);
      if (!to) continue;
      await prisma.itemPairing.create({
        data: {
          restaurantId: restaurant.id,
          itemId: from.id,
          pairedItemId: to.id,
          sortOrder: index,
        },
      });
    }
  }

  // Live tables, so the staff screen has something to show the moment it opens.
  const [t1, t2] = tables;
  const live = (minutes: number) => now - minutes * 60_000;
  await prisma.restaurantTable.update({
    where: { id: t1.id },
    data: { occupiedAt: new Date(live(25)), lastSeenAt: new Date(live(1)) },
  });
  await prisma.order.create({ data: orderData(picks[0], live(8), t1, 'PREPARING') });
  await prisma.order.create({ data: orderData(picks[1], live(2), t1, 'NEW') });
  if (t2) {
    await prisma.restaurantTable.update({
      where: { id: t2.id },
      data: {
        occupiedAt: new Date(live(70)),
        lastSeenAt: new Date(live(3)),
        billRequestedAt: new Date(live(3)),
      },
    });
    await prisma.order.create({ data: orderData(picks[2 % picks.length], live(60), t2, 'SERVED') });
    await prisma.waiterCall.create({
      data: {
        restaurantId: restaurant.id,
        tableId: t2.id,
        tableLabel: t2.label,
        kind: 'BILL',
        createdAt: new Date(live(3)),
      },
    });
  }
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { nextOrderNumber: number },
  });
  return history + 3;
}
