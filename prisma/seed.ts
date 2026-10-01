import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generatePlaceholderSvg } from './seed/placeholder-image';
import { seedRestaurants } from './seed/data';

const prisma = new PrismaClient();

const UPLOADS_DIR = join(__dirname, '..', 'public', 'uploads', 'seed');
const ITEMS_IMAGE_DIR = join(UPLOADS_DIR, 'items');
const RESTAURANTS_IMAGE_DIR = join(UPLOADS_DIR, 'restaurants');

const DEMO_ADMIN_PASSWORD = 'Qaemati@Demo123';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function writeImage(dir: string, filename: string, seed: string, label: string): string {
  const svg = generatePlaceholderSvg(seed, label);
  writeFileSync(join(dir, filename), svg, 'utf8');
  return filename;
}

async function main() {
  mkdirSync(ITEMS_IMAGE_DIR, { recursive: true });
  mkdirSync(RESTAURANTS_IMAGE_DIR, { recursive: true });

  // Seed data is meant to be re-run from a clean slate; delete in FK order.
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.restaurant.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);

  for (const restaurantData of seedRestaurants) {
    const logoFilename = `${restaurantData.slug}-logo.svg`;
    writeImage(RESTAURANTS_IMAGE_DIR, logoFilename, restaurantData.slug, restaurantData.nameEn);

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

    let categorySortOrder = 0;
    for (const categoryData of restaurantData.categories) {
      const category = await prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          nameAr: categoryData.nameAr,
          nameEn: categoryData.nameEn,
          sortOrder: categorySortOrder++,
        },
      });

      let itemSortOrder = 0;
      for (const itemData of categoryData.items) {
        const imageSeed = `${restaurant.slug}-${slugify(itemData.nameEn)}`;
        const imageFilename = `${imageSeed}.svg`;
        writeImage(ITEMS_IMAGE_DIR, imageFilename, imageSeed, itemData.nameEn);

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
            sortOrder: itemSortOrder++,
          },
        });
      }
    }

    const itemCount = restaurantData.categories.reduce((sum, c) => sum + c.items.length, 0);
    console.log(
      `Seeded ${restaurant.nameEn}: ${restaurantData.categories.length} categories, ${itemCount} items`,
    );
  }

  console.log(`\nDemo admin password for every seeded account: ${DEMO_ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
