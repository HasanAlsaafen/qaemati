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
 * Regression coverage for a bug found while building this test suite:
 * HTTP header values can't carry raw non-ASCII bytes, so every toast
 * message in Arabic (this app's default locale) crashed the triggering
 * request with a 500 -- invisible in every prior manual browser test,
 * since Chrome's Accept-Language header always won locale resolution for
 * htmx calls regardless of the displayed page's language. See
 * src/admin/htmx-toast.ts.
 */
describe('Admin category/item CRUD (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let adminEmail: string;
  let agent: ReturnType<typeof request.agent>;

  async function csrfToken(path: string, localeCookie?: string): Promise<string> {
    const req = agent.get(path);
    if (localeCookie) req.set('Cookie', `qaemati_locale=${localeCookie}`);
    const res = await req;
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'crud');
    restaurantId = restaurant.id;
    adminEmail = admin.email;
    agent = await loginAsAdmin(app, adminEmail);
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('creates a category under the Arabic locale without crashing', async () => {
    const token = await csrfToken('/admin?lang=ar');
    const res = await agent
      .post('/admin/categories')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=ar')
      .type('form')
      .send({ nameAr: 'قسم تجريبي', nameEn: 'Test Category' });

    expect(res.status).toBe(201);
    const trigger = res.headers['hx-trigger'];
    expect(trigger).toBeDefined();
    const { toast } = JSON.parse(trigger);
    expect(decodeURIComponent(toast.message)).toBe('تمت إضافة القسم');
  });

  it('creates a category under the English locale without crashing', async () => {
    const token = await csrfToken('/admin?lang=en', 'en');
    const res = await agent
      .post('/admin/categories')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ nameAr: 'قسم آخر', nameEn: 'Another Category' });

    expect(res.status).toBe(201);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Category added');
  });

  it('rejects an empty category name with a visible toast, not silence', async () => {
    const token = await csrfToken('/admin?lang=en', 'en');
    const res = await agent
      .post('/admin/categories')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ nameAr: '', nameEn: '' });

    expect(res.status).toBe(201);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');
  });
});
