import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

describe('Branding settings (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let adminEmail: string;
  let agent: ReturnType<typeof request.agent>;

  async function csrfToken(path: string): Promise<string> {
    const res = await agent.get(path).set('Cookie', 'qaemati_locale=en');
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'branding');
    restaurantId = restaurant.id;
    adminEmail = admin.email;
    agent = await loginAsAdmin(app, adminEmail);
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('saves restaurant details and a primary color that passes AA contrast', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        whatsapp: '+970599000123',
        currency: 'JOD',
        primaryColor: '#1E5F74',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Branding saved');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.nameEn).toBe('Updated Test Restaurant');
    expect(restaurant?.currency).toBe('JOD');
    expect(restaurant?.primaryColor).toBe('#1E5F74');
  });

  it('rejects a primary color too light for white text, with a visible toast', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        currency: 'JOD',
        primaryColor: '#FFD1A9',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');

    // The rejected color must not have been saved over the valid one
    // from the previous test.
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.primaryColor).toBe('#1E5F74');
  });

  it('rejects a one-sided open/close time window', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        currency: 'JOD',
        openTime: '09:00',
        closeTime: '',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.openTime).toBeNull();
  });

  it('applies the saved primary color to the public menu as a CSS override', async () => {
    const res = await request(app.getHttpServer()).get(`/m/test-restaurant-branding?lang=en`);
    expect(res.status).toBe(200);
    // #1E5F74 -> "30 95 116"
    expect(res.text).toContain('--color-primary: 30 95 116');
  });

  it('rejects a non-image file upload for the logo', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .post('/admin/branding/logo')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .attach('image', Buffer.from('not an image'), {
        filename: 'fake.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });
});
