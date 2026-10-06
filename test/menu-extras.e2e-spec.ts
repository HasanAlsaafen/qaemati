import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

describe('All chip and logo divider (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let slug: string;
  let agent: ReturnType<typeof request.agent>;

  async function saveBranding(fields: Record<string, string>) {
    const page = await agent.get('/admin?lang=en');
    const csrf = /name="csrf_token" value="([^"]*)"/.exec(page.text)?.[1] ?? '';
    return agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', csrf)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ nameAr: 'مطعم تجريبي', nameEn: 'Test Restaurant', currency: 'ILS', ...fields });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'extras');
    restaurantId = restaurant.id;
    slug = restaurant.slug;
    agent = await loginAsAdmin(app, admin.email);
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
    expect(res.text).toMatch(
      /data-category-chip="#all"[\s\S]{0,400}aria-current="true"[\s\S]{0,60}All/,
    );
  });

  it('translates the All chip', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=ar`);
    expect(res.text).toMatch(/data-category-chip="#all"[\s\S]{0,500}الكل/);
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

  it('shows no divider by default', async () => {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { logoPath: '/uploads/test-logo.png' },
    });
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.text).not.toContain('data-item-divider');
  });

  it('puts the logo between dishes but not after the last one', async () => {
    const saved = await saveBranding({ itemDivider: 'logo' });
    expect(saved.status).toBe(200);
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.text.match(/data-item-divider/g)).toHaveLength(2);
    expect(res.text).toContain('src="/uploads/test-logo.png"');
  });

  it('shows nothing when the logo divider is chosen but there is no logo', async () => {
    await prisma.restaurant.update({ where: { id: restaurantId }, data: { logoPath: null } });
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.text).not.toContain('data-item-divider');
  });

  it('rejects an unknown divider value and keeps the saved one', async () => {
    const res = await saveBranding({ itemDivider: 'stars' });
    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');
    const row = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(row?.itemDivider).toBe('logo');
  });

  it('applies the unsaved divider to the admin preview only for the owner', async () => {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { logoPath: '/uploads/test-logo.png', itemDivider: 'none' },
    });
    const owner = await agent.get(`/m/${slug}?lang=en&previewItemDivider=logo`);
    expect(owner.text).toContain('data-item-divider');
    const visitor = await request(app.getHttpServer()).get(
      `/m/${slug}?lang=en&previewItemDivider=logo`,
    );
    expect(visitor.text).not.toContain('data-item-divider');
  });
});
