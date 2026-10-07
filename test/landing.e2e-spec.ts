import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestRestaurant, deleteTestRestaurant } from './utils/test-app';

const ENV_KEYS = [
  'DEMO_MODE',
  'NODE_ENV',
  'THMANYAH_WEB_LICENSED',
  'LANDING_CONTACT_EMAIL',
  'LANDING_CONTACT_WHATSAPP',
  'LANDING_DEMO_SLUG',
];

describe('Landing page (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  const planIds: string[] = [];
  const saved: Record<string, string | undefined> = {};
  const tag = Date.now().toString(36);

  const page = (lang = 'en') =>
    request(app.getHttpServer()).get('/').set('Cookie', `qaemati_locale=${lang}`);

  beforeAll(async () => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant } = await createTestRestaurant(prisma, 'landing');
    restaurantId = restaurant.id;
    for (const [nameEn, price, active] of [
      [`Landing Basic ${tag}`, 30, true],
      [`Landing Archived ${tag}`, 99, false],
    ] as const) {
      const plan = await prisma.plan.create({
        data: {
          nameAr: 'باقة',
          nameEn,
          priceAmount: price,
          currency: 'ILS',
          isActive: active,
          trialDays: 14,
          maxMenus: 2,
          features: ['analytics'],
        },
      });
      planIds.push(plan.id);
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
    await app.close();
  });

  it('sells the product in English with the main sections', async () => {
    const res = await page('en');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<html lang="en" dir="ltr">');
    expect(res.text).toContain('Your menu, one scan away.');
    for (const id of ['how', 'features', 'faq']) expect(res.text).toContain(`id="${id}"`);
    expect(res.text).toContain(
      '<title>Qaemati: digital QR menus for restaurants and cafes</title>',
    );
  });

  it('is right to left and fully translated in Arabic', async () => {
    const res = await page('ar');
    expect(res.text).toContain('<html lang="ar" dir="rtl">');
    expect(res.text).toContain('قائمتك على بُعد مسحة واحدة.');
    expect(res.text).not.toContain('Your menu, one scan away');
    expect(res.text).not.toMatch(/common\.home\.landing/);
  });

  it('lists the active plans with prices, and leaves out archived ones', async () => {
    const res = await page('en');
    expect(res.text).toContain(`Landing Basic ${tag}`);
    expect(res.text).not.toContain(`Landing Archived ${tag}`);
    expect(res.text).toContain('id="pricing"');
    expect(res.text).toContain('14 days free');
  });

  it('puts the plans in the structured data search engines read', async () => {
    const res = await page('en');
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(res.text)![1];
    const data = JSON.parse(json);
    expect(data['@type']).toBe('SoftwareApplication');
    expect(data.offers.map((o: { name: string }) => o.name)).toContain(`Landing Basic ${tag}`);
  });

  describe('who it names', () => {
    it('lists sample restaurants and demo logins on a demo site', async () => {
      process.env.DEMO_MODE = 'true';
      const res = await page('en');
      expect(res.text).toContain('id="demo"');
      expect(res.text).toContain('/m/test-restaurant-landing');
      expect(res.text).toContain('super@qaemati.example.com');
    });

    it('never lists restaurants or credentials on a real site', async () => {
      process.env.DEMO_MODE = 'false';
      const res = await page('en');
      expect(res.text).not.toContain('test-restaurant-landing');
      expect(res.text).not.toContain('id="demo"');
      expect(res.text).not.toContain('super@qaemati.example.com');
      expect(res.text).not.toContain('Qaemati@Demo123');
    });

    it('points the live menu button at the chosen sample menu', async () => {
      process.env.DEMO_MODE = 'false';
      process.env.LANDING_DEMO_SLUG = 'my-showcase';
      expect((await page('en')).text).toContain('href="/m/my-showcase"');
    });
  });

  describe('getting in touch', () => {
    it('uses WhatsApp when it is set', async () => {
      process.env.LANDING_CONTACT_WHATSAPP = '+970 599 123456';
      expect((await page('en')).text).toContain('href="https://wa.me/970599123456"');
    });

    it('uses email when there is no WhatsApp number', async () => {
      delete process.env.LANDING_CONTACT_WHATSAPP;
      process.env.LANDING_CONTACT_EMAIL = 'hello@example.org';
      expect((await page('en')).text).toContain('href="mailto:hello@example.org"');
    });

    it('falls back to owner sign in rather than a dead button', async () => {
      delete process.env.LANDING_CONTACT_WHATSAPP;
      delete process.env.LANDING_CONTACT_EMAIL;
      const res = await page('en');
      expect(res.text).not.toContain('mailto:');
      expect(res.text).not.toContain('wa.me');
      expect(res.text).toContain('href="/admin/login"');
    });
  });

  describe('the Thmanyah font', () => {
    it('is used on the landing page and served while developing', async () => {
      const res = await page('en');
      expect(res.text).toContain('/css/thmanyah.css');
      expect(res.text).toContain("'Thmanyah Sans', 'Tajawal'");
      const font = await request(app.getHttpServer()).get(
        '/fonts/thmanyah/thmanyahsans-Regular.woff2',
      );
      expect(font.status).toBe(200);
    });

    it('is not served or linked in production until the license is confirmed', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.THMANYAH_WEB_LICENSED;
      const res = await page('en');
      expect(res.text).not.toContain('thmanyah.css');
      expect(res.text).toContain("'Tajawal'");
      for (const file of ['thmanyahsans-Regular.woff2', 'LICENSE.pdf']) {
        const font = await request(app.getHttpServer()).get(`/fonts/thmanyah/${file}`);
        expect(font.status).toBe(404);
      }
    });

    it('is served in production once the owner confirms the license', async () => {
      process.env.NODE_ENV = 'production';
      process.env.THMANYAH_WEB_LICENSED = 'true';
      expect((await page('en')).text).toContain('thmanyah.css');
      const font = await request(app.getHttpServer()).get(
        '/fonts/thmanyah/thmanyahsans-Bold.woff2',
      );
      expect(font.status).toBe(200);
    });

    it('stays off every page except the landing page', async () => {
      const menu = await request(app.getHttpServer()).get('/m/test-restaurant-landing');
      expect(menu.text).not.toContain('thmanyah');
      const login = await request(app.getHttpServer()).get('/admin/login');
      expect(login.text).not.toContain('thmanyah');
    });
  });
});
