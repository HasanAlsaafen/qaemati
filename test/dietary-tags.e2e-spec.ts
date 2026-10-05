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
 * B1 (Pack B): extended dietary tags (vegan/gluten-free/contains-nuts/
 * contains-dairy) and an owner-editable allergen note, both round-
 * tripped through the real item PATCH endpoint and reflected on the
 * public menu -- the tag badges, the data-tags attribute the client-side
 * filter (public/js/menu.js) reads, and the allergen note text.
 */
describe('Dietary tags and allergen note (e2e)', () => {
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
    const { restaurant, admin } = await createTestRestaurant(prisma, 'dietary-tags');
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
        nameAr: 'منقوشة',
        nameEn: 'Manakeesh',
        price: 12,
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

  it('saves the new dietary tags and an allergen note through the item PATCH endpoint', async () => {
    const agent = await loginAsAdmin(app, adminEmail);
    const token = await csrfToken(agent, '/admin?lang=en');

    const res = await agent
      .patch(`/admin/items/${itemId}`)
      .set('X-CSRF-Token', token)
      .type('form')
      .send({
        nameAr: 'منقوشة',
        nameEn: 'Manakeesh',
        price: '12',
        currency: 'ILS',
        tags: ['VEGAN', 'GLUTEN_FREE', 'CONTAINS_NUTS'],
        allergenNoteAr: 'يُحضّر في مطبخ يحتوي أيضًا على المكسرات.',
        allergenNoteEn: 'Prepared in a kitchen that also handles nuts.',
      });

    expect(res.status).toBe(200);

    const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.tags.sort()).toEqual(['CONTAINS_NUTS', 'GLUTEN_FREE', 'VEGAN']);
    expect(item.allergenNoteEn).toBe('Prepared in a kitchen that also handles nuts.');
  });

  it('reflects the new tags, data-tags attribute, and allergen note on the public menu', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.status).toBe(200);

    expect(res.text).toContain('Vegan');
    expect(res.text).toContain('Gluten-free');
    expect(res.text).toContain('Contains nuts');
    expect(res.text).toContain('data-tags="VEGAN,GLUTEN_FREE,CONTAINS_NUTS"');
    expect(res.text).toContain('Prepared in a kitchen that also handles nuts.');
  });

  it('exposes every tag as a filter checkbox on the public menu', async () => {
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.status).toBe(200);

    for (const code of [
      'SPICY',
      'VEGETARIAN',
      'NEW',
      'POPULAR',
      'VEGAN',
      'GLUTEN_FREE',
      'CONTAINS_NUTS',
      'CONTAINS_DAIRY',
    ]) {
      expect(res.text).toContain(`data-filter-tag="${code}"`);
    }
  });
});
