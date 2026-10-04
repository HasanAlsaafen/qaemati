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
 * A2 (variants/add-ons): the parsing logic (indexed form fields -> a flat
 * option list) is unit tested in items.controller.spec.ts. This covers
 * the full round trip -- admin saves variants/addons through the real
 * item PATCH endpoint, they persist, and the public menu reflects them
 * (the "from" price and the option data used to build the detail sheet).
 */
describe('Variants and add-ons (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let slug: string;
  let adminEmail: string;
  let itemId: string;

  async function csrfToken(agent: ReturnType<typeof request.agent>, path: string): Promise<string> {
    const res = await agent.get(path);
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'variants');
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
        nameAr: 'قهوة',
        nameEn: 'Coffee',
        price: 10,
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

  it('saves variants and add-ons through the item PATCH endpoint', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    const token = await csrfToken(agent, '/admin?lang=en');

    const res = await agent
      .patch(`/admin/items/${itemId}`)
      .set('X-CSRF-Token', token)
      .type('form')
      .send({
        nameAr: 'قهوة',
        nameEn: 'Coffee',
        price: '10',
        currency: 'ILS',
        'variants[0][nameAr]': 'صغير',
        'variants[0][nameEn]': 'Small',
        'variants[0][price]': '10',
        'variants[1][nameAr]': 'كبير',
        'variants[1][nameEn]': 'Large',
        'variants[1][price]': '15',
        'addons[0][nameAr]': 'سكر إضافي',
        'addons[0][nameEn]': 'Extra sugar',
        'addons[0][price]': '1',
      });

    expect(res.status).toBe(200);

    const variants = await prisma.itemVariant.findMany({
      where: { itemId },
      orderBy: { sortOrder: 'asc' },
    });
    expect(variants.map((v) => v.nameEn)).toEqual(['Small', 'Large']);
    expect(Number(variants[1].price)).toBe(15);

    const addons = await prisma.itemAddon.findMany({ where: { itemId } });
    expect(addons).toHaveLength(1);
    expect(addons[0].nameEn).toBe('Extra sugar');
  });

  it('replaces the whole list on a second save rather than appending', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    const token = await csrfToken(agent, '/admin?lang=en');

    await agent
      .patch(`/admin/items/${itemId}`)
      .set('X-CSRF-Token', token)
      .type('form')
      .send({
        nameAr: 'قهوة',
        nameEn: 'Coffee',
        price: '10',
        currency: 'ILS',
        'variants[0][nameAr]': 'وسط',
        'variants[0][nameEn]': 'Medium',
        'variants[0][price]': '12',
      })
      .expect(200);

    const variants = await prisma.itemVariant.findMany({ where: { itemId } });
    expect(variants).toHaveLength(1);
    expect(variants[0].nameEn).toBe('Medium');

    // addons[] was omitted from this submission -- should now be empty,
    // not still carrying the previous save's "Extra sugar".
    const addons = await prisma.itemAddon.findMany({ where: { itemId } });
    expect(addons).toHaveLength(0);
  });

  it('shows the "from" price on the public menu once the item has variants', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('From');
    expect(res.text).toContain('12.00');
  });
});
