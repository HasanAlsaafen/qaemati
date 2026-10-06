import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestRestaurant, deleteTestRestaurant } from './utils/test-app';

describe('Specials and schedules (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let slug: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant } = await createTestRestaurant(prisma, 'specials');
    restaurantId = restaurant.id;
    slug = restaurant.slug;

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { openTime: '07:00', closeTime: '23:00' },
    });

    const alwaysOnCategory = await prisma.category.create({
      data: { restaurantId, nameAr: 'دائم', nameEn: 'Always On', sortOrder: 0 },
    });
    await prisma.item.create({
      data: {
        restaurantId,
        categoryId: alwaysOnCategory.id,
        nameAr: 'عنصر مميز',
        nameEn: 'Special Item',
        price: 10,
        currency: 'ILS',
        sortOrder: 0,
        isTodaysSpecial: true,
      },
    });
    await prisma.item.create({
      data: {
        restaurantId,
        categoryId: alwaysOnCategory.id,
        nameAr: 'عنصر عادي',
        nameEn: 'Ordinary Item',
        price: 5,
        currency: 'ILS',
        sortOrder: 1,
        isTodaysSpecial: false,
      },
    });

    // A category window that can never be open (00:00-00:01), to prove
    // its items never leak into the specials banner regardless of
    // isTodaysSpecial, and the category itself never renders.
    const neverOpenCategory = await prisma.category.create({
      data: {
        restaurantId,
        nameAr: 'لا يفتح أبدًا',
        nameEn: 'Never Open',
        sortOrder: 1,
        availableFrom: '00:00',
        availableTo: '00:01',
      },
    });
    await prisma.item.create({
      data: {
        restaurantId,
        categoryId: neverOpenCategory.id,
        nameAr: 'مخفي',
        nameEn: 'Hidden Special',
        price: 1,
        currency: 'ILS',
        sortOrder: 0,
        isTodaysSpecial: true,
      },
    });
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('shows the open/closed badge when structured hours are set', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Open now|Closed/);
  });

  it("shows an always-available item in the today's special banner", async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    // Nunjucks HTML-escapes the apostrophe in "Today's special" to &#39;.
    expect(res.text).toContain('Today&#39;s special');
    const bannerSection = res.text.split('data-todays-specials')[1]?.split('</main>')[0] ?? '';
    expect(bannerSection).toContain('Special Item');
  });

  it("does not show a non-special item in the today's special banner", async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    // The banner markup sits between the data-todays-specials wrapper and the
    // sticky search bar that follows it; "Ordinary Item" legitimately
    // appears elsewhere (its own category row, and that row's embedded
    // JSON payload), so scope the check to the banner section specifically
    // rather than counting every occurrence on the page.
    const bannerSection = res.text.split('data-todays-specials')[1]?.split('sticky top-0')[0] ?? '';
    // An empty slice would pass this check for the wrong reason.
    expect(bannerSection).toContain('Special Item');
    expect(bannerSection).not.toContain('Ordinary Item');
  });

  it('hides a category entirely outside its availability window', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.text).not.toContain('Never Open');
  });

  it('excludes a special item from the banner when its category is hidden', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.text).not.toContain('Hidden Special');
  });
});
