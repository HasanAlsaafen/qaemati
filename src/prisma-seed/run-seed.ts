import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generateLogoPlaceholderSvg, generatePlaceholderSvg } from './placeholder-image';
import { seedRestaurants } from './seed-data';

/**
 * Lives under src/ (not prisma/) specifically so it compiles into dist/
 * and the running app can call it directly -- A5's "Reset demo data"
 * action reuses this exact function via the app's own PrismaService,
 * rather than shelling out to `npx prisma db seed` as a child process or
 * keeping a second, drifting copy of the same logic. prisma/seed.ts (the
 * file Prisma's CLI actually looks for) is now a thin wrapper that
 * imports this and supplies its own standalone PrismaClient --
 * tsconfig.build.json excludes the whole prisma/ directory from the Nest
 * build, so anything the running app needs at runtime has to live in
 * src/ regardless of where its "seed data" conceptually belongs.
 */

const UPLOADS_DIR = join(__dirname, '..', '..', 'public', 'uploads', 'seed');
const ITEMS_IMAGE_DIR = join(UPLOADS_DIR, 'items');
const RESTAURANTS_IMAGE_DIR = join(UPLOADS_DIR, 'restaurants');

export const DEMO_ADMIN_PASSWORD = 'Qaemati@Demo123';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function writeItemImage(dir: string, filename: string, seed: string): void {
  writeFileSync(join(dir, filename), generatePlaceholderSvg(seed), 'utf8');
}

function writeLogoImage(dir: string, filename: string, seed: string): void {
  writeFileSync(join(dir, filename), generateLogoPlaceholderSvg(seed), 'utf8');
}

export async function runSeed(prisma: PrismaClient): Promise<string[]> {
  mkdirSync(ITEMS_IMAGE_DIR, { recursive: true });
  mkdirSync(RESTAURANTS_IMAGE_DIR, { recursive: true });

  // Seed data is meant to be re-run from a clean slate; delete in FK order.
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.restaurant.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
  const summary: string[] = [];

  for (const restaurantData of seedRestaurants) {
    const logoFilename = `${restaurantData.slug}-logo.svg`;
    writeLogoImage(RESTAURANTS_IMAGE_DIR, logoFilename, restaurantData.slug);

    const restaurant = await prisma.restaurant.create({
      data: {
        slug: restaurantData.slug,
        nameAr: restaurantData.nameAr,
        nameEn: restaurantData.nameEn,
        descriptionAr: restaurantData.descriptionAr,
        descriptionEn: restaurantData.descriptionEn,
        logoPath: `/uploads/seed/restaurants/${logoFilename}`,
        whatsapp: restaurantData.whatsapp,
        instagramHandle: restaurantData.instagramHandle,
        workingHoursAr: restaurantData.workingHoursAr,
        workingHoursEn: restaurantData.workingHoursEn,
        ...restaurantData.contact,
        openTime: restaurantData.openTime,
        closeTime: restaurantData.closeTime,
        currency: restaurantData.currency,
        primaryColor: restaurantData.primaryColor,
      },
    });

    await prisma.adminUser.create({
      data: {
        restaurantId: restaurant.id,
        email: restaurantData.adminEmail,
        passwordHash,
        name: restaurantData.adminName,
      },
    });

    const menuDefinitions = restaurantData.menus ?? [
      { key: 'main', nameAr: 'القائمة الرئيسية', nameEn: 'Main menu' },
    ];
    const menuIdByKey = new Map<string, string>();
    for (const [index, menuData] of menuDefinitions.entries()) {
      const menu = await prisma.menu.create({
        data: {
          restaurantId: restaurant.id,
          nameAr: menuData.nameAr,
          nameEn: menuData.nameEn,
          availableFrom: menuData.availableFrom,
          availableTo: menuData.availableTo,
          sortOrder: index,
        },
      });
      menuIdByKey.set(menuData.key, menu.id);
    }
    const firstMenuId = menuIdByKey.get(menuDefinitions[0].key)!;

    let categorySortOrder = 0;
    for (const categoryData of restaurantData.categories) {
      const category = await prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          nameAr: categoryData.nameAr,
          nameEn: categoryData.nameEn,
          availableFrom: categoryData.availableFrom,
          availableTo: categoryData.availableTo,
          menuId: (categoryData.menu && menuIdByKey.get(categoryData.menu)) || firstMenuId,
          sortOrder: categorySortOrder++,
        },
      });

      let itemSortOrder = 0;
      for (const itemData of categoryData.items) {
        const imageSeed = `${restaurant.slug}-${slugify(itemData.nameEn)}`;
        const imageFilename = `${imageSeed}.svg`;
        writeItemImage(ITEMS_IMAGE_DIR, imageFilename, imageSeed);

        await prisma.item.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: category.id,
            nameAr: itemData.nameAr,
            nameEn: itemData.nameEn,
            descriptionAr: itemData.descriptionAr,
            descriptionEn: itemData.descriptionEn,
            price: itemData.price,
            currency: restaurantData.currency,
            imagePath: `/uploads/seed/items/${imageFilename}`,
            tags: itemData.tags ?? [],
            available: itemData.available ?? true,
            isTodaysSpecial: itemData.isTodaysSpecial ?? false,
            sortOrder: itemSortOrder++,
          },
        });
      }
    }

    const itemCount = restaurantData.categories.reduce((sum, c) => sum + c.items.length, 0);
    summary.push(
      `Seeded ${restaurant.nameEn}: ${restaurantData.categories.length} categories, ${itemCount} items`,
    );
  }

  return summary;
}
