import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestRestaurant, deleteTestRestaurant } from './utils/test-app';

describe('All chip (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let slug: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant } = await createTestRestaurant(prisma, 'extras');
    restaurantId = restaurant.id;
    slug = restaurant.slug;
    const category = await prisma.category.create({
      data: { restaurantId, nameAr: 'مقبلات', nameEn: 'Starters' },
    });
    for (const [index, name] of ['Hummus', 'Falafel', 'Salad'].entries()) {
      await prisma.item.create({
        data: {
          restaurantId,
          categoryId: category.id,
          nameAr: name,
          nameEn: name,
          price: 5,
          currency: 'ILS',
          sortOrder: index,
        },
      });
    }
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('puts an active All chip before the category chips', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    const all = res.text.indexOf('data-category-chip="#all"');
    const first = res.text.indexOf('data-category-chip="#category-');
    expect(all).toBeGreaterThan(-1);
    expect(all).toBeLessThan(first);
    expect(res.text).toMatch(/data-category-chip="#all"[^>]*aria-current="true"/);
    expect(res.text).toMatch(
      /data-category-chip="#all"[\s\S]{0,1600}data-chip-label[^>]*>\s*All\s*</,
    );
  });

  it('draws the All chip as four squares in the restaurant accent, not a dish glyph', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    const chip = /data-category-chip="#all"[\s\S]*?<\/a>/.exec(res.text)![0];
    expect(chip).toContain('data-all-icon');
    expect(chip.match(/<rect /g)).toHaveLength(4);
    expect(chip).toContain('bg-primary-soft');
    expect(chip).toContain('text-primary-text');
    // The earlier glyph drew a broken fork and knife.
    expect(chip).not.toContain('M7 3v8a2 2 0 0 0 2 2v8');
  });

  it('translates the All chip', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=ar`);
    expect(res.text).toMatch(
      /data-category-chip="#all"[\s\S]{0,1600}data-chip-label[^>]*>\s*الكل\s*</,
    );
  });

  it('shows no chip bar entries for a menu with no categories', async () => {
    await prisma.category.updateMany({
      where: { restaurantId },
      data: { availableFrom: '00:00', availableTo: '00:01' },
    });
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.text).not.toContain('data-category-chip="#all"');
    await prisma.category.updateMany({
      where: { restaurantId },
      data: { availableFrom: null, availableTo: null },
    });
  });

  describe('reference design details', () => {
    beforeAll(async () => {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { logoPath: '/uploads/test-logo.png' },
      });
    });

    it('prints the currency symbol after the number instead of the code', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      expect(res.text).toMatch(/5\.00 ₪/);
    });

    it('uses the restaurant logo as the picture for a dish and a category with no photo', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      expect(res.text).toMatch(/menu-item-card__image[\s\S]{0,300}src="\/uploads\/test-logo\.png"/);
      expect(res.text).toMatch(/data-chip-circle[\s\S]{0,200}src="\/uploads\/test-logo\.png"/);
    });

    it('draws the category chip from the category image when it has one', async () => {
      const category = await prisma.category.findFirst({ where: { restaurantId } });
      await prisma.category.update({
        where: { id: category!.id },
        data: { imagePath: '/uploads/categories/test-cat.png' },
      });
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      expect(res.text).toMatch(
        /data-chip-circle[\s\S]{0,300}src="\/uploads\/categories\/test-cat\.png"/,
      );
    });

    it('does not borrow a dish photo for the category chip', async () => {
      const category = await prisma.category.findFirst({ where: { restaurantId } });
      await prisma.category.update({ where: { id: category!.id }, data: { imagePath: null } });
      await prisma.item.updateMany({
        where: { categoryId: category!.id, nameEn: 'Hummus' },
        data: { imagePath: '/uploads/test-hummus.png' },
      });
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      const chip = /data-category-chip="#category-[\s\S]{0,600}/.exec(res.text)?.[0] ?? '';
      expect(chip).toContain('/uploads/test-logo.png');
      expect(chip).not.toContain('test-hummus');
    });

    it('uses the built in image when there is no category image and no logo', async () => {
      await prisma.restaurant.update({ where: { id: restaurantId }, data: { logoPath: null } });
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      const chip = /data-category-chip="#category-[\s\S]{0,600}/.exec(res.text)?.[0] ?? '';
      expect(chip).toContain('/images/category-fallback.svg');
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { logoPath: '/uploads/test-logo.png' },
      });
    });

    it('marks the active language in the AR | EN pill', async () => {
      const en = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      expect(en.text).toMatch(/href="\/lang\/en"[^>]*aria-current="true"/);
      const ar = await request(app.getHttpServer()).get(`/m/${slug}?lang=ar`);
      expect(ar.text).toMatch(/href="\/lang\/ar"[^>]*aria-current="true"/);
    });

    it('translates every close button, none is left in English', async () => {
      const ar = await request(app.getHttpServer()).get(`/m/${slug}?lang=ar`);
      expect(ar.text).not.toContain('aria-label="Close"');
      // item sheet and filter sheet are in the markup, the selection bar's is in its data
      expect(ar.text.match(/aria-label="إغلاق"/g)?.length).toBeGreaterThanOrEqual(2);
      expect(ar.text).toContain('closeLabel&quot;:&quot;إغلاق');
    });

    it('shows the currency symbol in the selection data, not just the code', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      expect(res.text).toContain('currencySymbol');
      expect(res.text).toContain('$store.selection.currencySymbol');
    });
  });
});
