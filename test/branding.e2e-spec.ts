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

    // The error is attached to the primary color field specifically (not
    // just a toast) -- the P1-4 gap from docs/ux/audit.md.
    expect(res.text).toContain('field-primaryColor-error');
    expect(res.text).not.toContain('field-secondaryColor-error');
  });

  it('rejects a malformed primary color hex, distinctly from a contrast failure', async () => {
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
        primaryColor: 'not-a-color',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Enter a valid color.');
    expect(res.text).toContain('field-primaryColor-error');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.primaryColor).toBe('#1E5F74');
  });

  it('keeps what was typed in the other fields when a save is rejected', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي',
        nameEn: 'Test Restaurant',
        currency: 'JOD',
        primaryColor: 'not-a-color',
        whatsapp: '+970599123456',
        workingHoursEn: 'Daily 8 to 10',
      });

    expect(res.text).toContain('field-primaryColor-error');
    expect(res.text).toContain('value="+970599123456"');
    expect(res.text).toContain('value="Daily 8 to 10"');
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.whatsapp).not.toBe('+970599123456');
  });

  it('requires both a nameAr and nameEn, flagging only the one left blank', async () => {
    const token = await csrfToken('/admin/branding?lang=en');
    const res = await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: '',
        currency: 'JOD',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');
    expect(res.text).toContain('field-nameEn-error');
    expect(res.text).not.toContain('field-nameAr-error');
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

    // closeTime is the one left blank -- openTime (which was filled in)
    // isn't the problem and shouldn't be flagged.
    expect(res.text).toContain('field-closeTime-error');
    expect(res.text).not.toContain('field-openTime-error');
  });

  it('applies the saved primary color to the public menu as a CSS override', async () => {
    const res = await request(app.getHttpServer()).get(`/m/test-restaurant-branding?lang=en`);
    expect(res.status).toBe(200);
    // #1E5F74 -> "30 95 116"
    expect(res.text).toContain('--color-primary: 30 95 116');
  });

  it('saves a background color, card style, and button shape, applied to the public menu', async () => {
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
        backgroundColor: '#F0F0F0',
        cardStyle: 'raised',
        buttonShape: 'pill',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Branding saved');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.backgroundColor).toBe('#F0F0F0');
    expect(restaurant?.cardStyle).toBe('raised');
    expect(restaurant?.buttonShape).toBe('pill');

    const menuRes = await request(app.getHttpServer()).get(`/m/test-restaurant-branding?lang=en`);
    expect(menuRes.status).toBe(200);
    // #F0F0F0 -> "240 240 240"
    expect(menuRes.text).toContain('--color-bg: 240 240 240');
    expect(menuRes.text).toContain('--radius-button: 9999px');
    expect(menuRes.text).toContain('data-card-style="raised"');
  });

  it('rejects a background color too dark for the fixed body text', async () => {
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
        backgroundColor: '#2B2622',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(toast.variant).toBe('danger');
    expect(res.text).toContain('field-backgroundColor-error');

    // The rejected background must not overwrite the valid one saved above.
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.backgroundColor).toBe('#F0F0F0');
  });

  it('saves category divider and a pattern background, applied to the public menu', async () => {
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
        categoryDivider: 'dashed',
        backgroundStyle: 'pattern',
        backgroundPattern: 'grid',
        sectionSpacing: 'spacious',
      });

    expect(res.status).toBe(200);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Branding saved');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.categoryDivider).toBe('dashed');
    expect(restaurant?.backgroundStyle).toBe('pattern');
    expect(restaurant?.backgroundPattern).toBe('grid');
    expect(restaurant?.sectionSpacing).toBe('spacious');

    const menuRes = await request(app.getHttpServer()).get(`/m/test-restaurant-branding?lang=en`);
    expect(menuRes.status).toBe(200);
    expect(menuRes.text).toContain('data-category-divider="dashed"');
    expect(menuRes.text).toContain('data-background-style="pattern"');
    expect(menuRes.text).toContain('data-background-pattern="grid"');
    expect(menuRes.text).toContain('data-section-spacing="spacious"');
  });

  it('uploads a background image and applies it as an inline style when backgroundStyle is image', async () => {
    const saveToken = await csrfToken('/admin/branding?lang=en');
    await agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', saveToken)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({
        nameAr: 'مطعم تجريبي محدث',
        nameEn: 'Updated Test Restaurant',
        currency: 'JOD',
        backgroundStyle: 'image',
      });

    const uploadToken = await csrfToken('/admin/branding?lang=en');
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const res = await agent
      .post('/admin/branding/background')
      .set('X-CSRF-Token', uploadToken)
      .set('Cookie', 'qaemati_locale=en')
      .attach('image', pngBytes, { filename: 'bg.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    const { toast } = JSON.parse(res.headers['hx-trigger']);
    expect(decodeURIComponent(toast.message)).toBe('Background image updated');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(restaurant?.backgroundImagePath).toMatch(/^\/uploads\/restaurants\//);

    const menuRes = await request(app.getHttpServer()).get(`/m/test-restaurant-branding?lang=en`);
    expect(menuRes.status).toBe(200);
    expect(menuRes.text).toContain(`background-image: url('${restaurant?.backgroundImagePath}')`);
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
