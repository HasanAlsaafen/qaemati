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
const CATEGORIES_IMAGE_DIR = join(UPLOADS_DIR, 'categories');

export const DEMO_ADMIN_PASSWORD = 'Qaemati@Demo123';
export const DEMO_SUPER_ADMIN_EMAIL = 'super@qaemati.example.com';

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
  mkdirSync(CATEGORIES_IMAGE_DIR, { recursive: true });

  // Seed data is meant to be re-run from a clean slate; delete in FK order.
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.superAdmin.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.restaurant.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
  const summary: string[] = [];

  // Demo plans, platform operator and billing history. A real deployment
  // creates its own super admin with `npm run super:create` instead.
  const plans = {
    starter: await prisma.plan.create({
      data: {
        nameAr: 'الأساسية',
        nameEn: 'Starter',
        priceAmount: 30,
        currency: 'ILS',
        interval: 'MONTHLY',
        trialDays: 14,
        maxMenus: 1,
        maxCategories: 8,
        maxItems: 40,
        maxAdminUsers: 1,
        features: [],
        sortOrder: 1,
      },
    }),
    standard: await prisma.plan.create({
      data: {
        nameAr: 'المتوسطة',
        nameEn: 'Standard',
        priceAmount: 60,
        currency: 'ILS',
        interval: 'MONTHLY',
        trialDays: 14,
        maxMenus: 2,
        maxCategories: 20,
        maxItems: 150,
        maxAdminUsers: 3,
        features: ['whatsappOrdering', 'analytics', 'tableOrdering'],
        sortOrder: 2,
      },
    }),
    pro: await prisma.plan.create({
      data: {
        nameAr: 'المتقدمة',
        nameEn: 'Pro',
        priceAmount: 120,
        currency: 'ILS',
        interval: 'MONTHLY',
        trialDays: 14,
        features: ['bulkTools', 'analytics', 'whatsappOrdering', 'tableOrdering'],
        sortOrder: 3,
      },
    }),
  };
  const superAdmin = await prisma.superAdmin.create({
    data: { email: DEMO_SUPER_ADMIN_EMAIL, name: 'Platform Owner', passwordHash },
  });
  summary.push(`Super admin: ${DEMO_SUPER_ADMIN_EMAIL} (sign in at /super/login)`);
  const day = 24 * 60 * 60 * 1000;

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
        // A demo visitor is not standing in the restaurant, so the location
        // check is off. Turn it on from the POS page to see it work.
        latitude: 31.5326,
        longitude: 35.0998,
        requireLocationCheck: false,
        // Three tables, so the demo's QR page has codes that open the POS flow.
        tables: {
          create: ['1', '2', '3'].map((label, index) => ({ label, sortOrder: index })),
        },
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
    // A cashier and a kitchen account, so the orders screen can be tried as each.
    const domain = restaurantData.adminEmail.split('@')[1];
    for (const [local, name, role] of [
      ['cashier', 'Demo Cashier', 'CASHIER'],
      ['kitchen', 'Demo Kitchen', 'KITCHEN'],
    ] as const) {
      await prisma.adminUser.create({
        data: { restaurantId: restaurant.id, email: `${local}@${domain}`, passwordHash, name, role },
      });
    }

    // The cafe is a paying Pro customer, the restaurant is still on a trial.
    if (restaurantData.slug === 'bayt-al-zaytoun') {
      const periodEnd = new Date(Date.now() + 24 * day);
      const subscription = await prisma.subscription.create({
        data: {
          restaurantId: restaurant.id,
          planId: plans.pro.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(Date.now() - 6 * day),
          currentPeriodEnd: periodEnd,
        },
      });
      for (const [index, daysAgo] of [66, 36, 6].entries()) {
        const paidAt = new Date(Date.now() - daysAgo * day);
        await prisma.payment.create({
          data: {
            restaurantId: restaurant.id,
            subscriptionId: subscription.id,
            amount: 120,
            currency: 'ILS',
            method: index === 1 ? 'BANK_TRANSFER' : 'CASH',
            reference: index === 1 ? 'TRF-20260905' : null,
            paidAt,
            periodStart: paidAt,
            periodEnd: new Date(paidAt.getTime() + 30 * day),
            recordedById: superAdmin.id,
          },
        });
      }
    } else {
      await prisma.subscription.create({
        data: {
          restaurantId: restaurant.id,
          planId: plans.standard.id,
          status: 'TRIALING',
          trialEndsAt: new Date(Date.now() + 9 * day),
        },
      });
    }

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
      const categoryImageFilename = `${restaurantData.slug}-${slugify(categoryData.nameEn)}.svg`;
      writeItemImage(
        CATEGORIES_IMAGE_DIR,
        categoryImageFilename,
        `category-${restaurantData.slug}-${slugify(categoryData.nameEn)}`,
      );
      const category = await prisma.category.create({
        data: {
          imagePath: `/uploads/seed/categories/${categoryImageFilename}`,
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
