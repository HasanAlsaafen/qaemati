import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

/**
 * B2 (Pack B): whole-menu page loads and item detail opens are recorded
 * as MenuView rows (see AnalyticsService/MenuService), excluding the
 * restaurant's own admin viewing/previewing their own menu, and surfaced
 * on the new /admin/analytics page (last 7/30 days, most-viewed items).
 */
describe('Analytics (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let slug: string;
  let adminEmail: string;
  let itemId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'analytics');
    restaurantId = restaurant.id;
    slug = restaurant.slug;
    adminEmail = admin.email;

    const category = await prisma.category.create({
      data: { restaurantId, nameAr: 'قسم', nameEn: 'Category', sortOrder: 0 },
    });
    const item = await prisma.item.create({
      data: {
        restaurantId,
        categoryId: category.id,
        nameAr: 'كنافة',
        nameEn: 'Kunafa',
        price: 15,
        currency: 'ILS',
        sortOrder: 0,
      },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('records anonymous menu page loads and item opens as MenuView rows', async () => {
    await request(app.getHttpServer()).get(`/m/${slug}?lang=en`).expect(200);
    await request(app.getHttpServer()).get(`/m/${slug}?lang=en`).expect(200);
    await request(app.getHttpServer()).get(`/m/${slug}/items/${itemId}/view`).expect(204);

    const menuViews = await prisma.menuView.count({ where: { restaurantId, itemId: null } });
    expect(menuViews).toBe(2);
    const itemViews = await prisma.menuView.count({ where: { restaurantId, itemId } });
    expect(itemViews).toBe(1);
  });

  it('does not record a view when the restaurant owns the session viewing its own menu', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    const before = await prisma.menuView.count({ where: { restaurantId, itemId: null } });

    await agent.get(`/m/${slug}?lang=en`).expect(200);

    const after = await prisma.menuView.count({ where: { restaurantId, itemId: null } });
    expect(after).toBe(before);
  });

  it('does not record an item view when the restaurant owns the session opening it', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    const before = await prisma.menuView.count({ where: { restaurantId, itemId } });

    await agent.get(`/m/${slug}/items/${itemId}/view`).expect(204);

    const after = await prisma.menuView.count({ where: { restaurantId, itemId } });
    expect(after).toBe(before);
  });

  it('ignores an item-view beacon for an item that belongs to a different restaurant', async () => {
    const { restaurant: otherRestaurant } = await createTestRestaurant(prisma, 'analytics-other');
    try {
      const before = await prisma.menuView.count({ where: { itemId } });
      await request(app.getHttpServer())
        .get(`/m/${otherRestaurant.slug}/items/${itemId}/view`)
        .expect(204);
      const after = await prisma.menuView.count({ where: { itemId } });
      expect(after).toBe(before);
    } finally {
      await deleteTestRestaurant(prisma, otherRestaurant.id);
    }
  });

  it('shows recorded views and the most-viewed item on the admin analytics page', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    const res = await agent.get('/admin/analytics?lang=en').expect(200);

    expect(res.text).toContain('Analytics');
    expect(res.text).toContain('Kunafa');
    expect(res.text).toContain('1 view');
  });
});
