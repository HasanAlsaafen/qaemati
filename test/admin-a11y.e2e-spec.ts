import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

const SKIP_LINK = 'href="#main-content"';
const MAIN = /<main[^>]*id="main-content"/;

describe('Skip link and admin accessibility markup (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let slug: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'a11y');
    restaurantId = restaurant.id;
    slug = restaurant.slug;
    const category = await prisma.category.create({
      data: { restaurantId, nameAr: 'قسم', nameEn: 'Section' },
    });
    await prisma.item.create({
      data: {
        restaurantId,
        categoryId: category.id,
        nameAr: 'صنف',
        nameEn: 'Falafel',
        price: 5,
        currency: 'ILS',
      },
    });
    agent = await loginAsAdmin(app, admin.email);
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it.each([
    ['home (base layout)', '/?lang=en', false],
    ['404 (base layout)', '/missing?lang=en', false],
    ['menu layout', '/m/__slug__?lang=en', false],
    ['admin layout', '/admin?lang=en', true],
    ['print layout', '/admin/qr/print?lang=en', true],
  ])('%s has a skip link and a matching main landmark', async (_name, path, asAdmin) => {
    const client = asAdmin ? agent : request(app.getHttpServer());
    const res = await client.get(path.replace('__slug__', slug));
    expect(res.text).toContain(SKIP_LINK);
    expect(res.text).toMatch(MAIN);
    expect(res.text.indexOf(SKIP_LINK)).toBeLessThan(res.text.indexOf('<main'));
  });

  it('translates the skip link', async () => {
    const res = await request(app.getHttpServer()).get('/?lang=ar');
    expect(res.text).toContain('انتقل إلى المحتوى الرئيسي');
  });

  it('labels every bulk page input, including each row checkbox by item name', async () => {
    const res = await agent.get('/admin/bulk?lang=en');
    expect(res.text).toContain('for="bulk-import-file"');
    expect(res.text).toContain('for="bulk-percent"');
    expect(res.text).toMatch(/name="itemIds"[^>]*>\s*<span class="sr-only">Select Falafel<\/span>/);
  });

  it('sizes the admin reorder buttons at 44px', async () => {
    const res = await agent.get('/admin?lang=en');
    expect(res.text).not.toMatch(/h-9 w-9/);
    expect(res.text).toContain('h-11 w-11');
  });
});
