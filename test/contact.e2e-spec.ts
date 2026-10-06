import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

describe('Contact, address and social (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let slug: string;
  let agent: ReturnType<typeof request.agent>;

  const base = { nameAr: 'مطعم تجريبي', nameEn: 'Test Restaurant', currency: 'ILS' };

  async function save(fields: Record<string, string>) {
    const page = await agent.get('/admin/branding?lang=en');
    const token = /name="csrf_token" value="([^"]*)"/.exec(page.text)?.[1] ?? '';
    return agent
      .patch('/admin/branding')
      .set('X-CSRF-Token', token || (await tokenFromAdmin()))
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ ...base, ...fields });
  }

  async function tokenFromAdmin(): Promise<string> {
    const res = await agent.get('/admin?lang=en');
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'contact');
    restaurantId = restaurant.id;
    slug = restaurant.slug;
    agent = await loginAsAdmin(app, admin.email);
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('shows no footer when the owner has entered nothing beyond WhatsApp', async () => {
    await prisma.restaurant.update({ where: { id: restaurantId }, data: { whatsapp: null } });
    const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(res.text).not.toContain('<footer');
  });

  it('saves contact details and shows them in the header, footer and structured data', async () => {
    const res = await save({
      taglineEn: 'Slow coffee',
      taglineAr: 'قهوة على مهلها',
      phone: '+970 2 222 0111',
      facebookUrl: 'testplace',
      addressEn: 'Downtown, Hebron',
      addressAr: 'وسط البلد، الخليل',
      mapUrl: 'https://maps.example.org/place/1',
    });
    expect(res.status).toBe(200);

    const page = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
    expect(page.text).toContain('Slow coffee');
    expect(page.text).toContain('href="tel:+97022220111"');
    expect(page.text).toContain('<footer');
    expect(page.text).toContain('Downtown, Hebron');
    expect(page.text).toContain('href="https://facebook.com/testplace"');
    expect(page.text).toContain('href="https://maps.example.org/place/1"');
    expect(page.text).toContain('"streetAddress":"Downtown, Hebron"');
    expect(page.text).toContain('"telephone":"+97022220111"');

    const arabic = await request(app.getHttpServer()).get(`/m/${slug}?lang=ar`);
    expect(arabic.text).toContain('وسط البلد، الخليل');
    expect(arabic.text).toContain('قهوة على مهلها');
  });

  it.each([
    ['phone', { phone: 'call me' }, 'field-phone-error'],
    ['facebookUrl', { facebookUrl: 'http://facebook.com/x' }, 'field-facebookUrl-error'],
    ['mapUrl', { mapUrl: 'javascript:alert(1)' }, 'field-mapUrl-error'],
  ])('flags an invalid %s on that field and saves nothing', async (_field, fields, errorId) => {
    const before = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    const res = await save(fields);
    expect(res.status).toBe(200);
    expect(res.text).toContain(errorId);
    const after = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    expect(after?.phone).toBe(before?.phone);
    expect(after?.mapUrl).toBe(before?.mapUrl);
  });
});
