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
    await prisma.menu.create({
      data: { restaurantId, nameAr: 'القائمة', nameEn: 'Menu', sortOrder: 0 },
    });
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
    it('has no demo section, demo logins or customer list, in any mode', async () => {
      for (const mode of ['true', 'false']) {
        process.env.DEMO_MODE = mode;
        const res = await page('en');
        expect(res.text).not.toContain('id="demo"');
        expect(res.text).not.toContain('Try it yourself');
        expect(res.text).not.toContain('Qaemati@Demo123');
        expect(res.text).not.toContain('super@qaemati.example.com');
        expect(res.text).not.toContain('/demo/reset');
        expect(res.text).not.toContain('Test Restaurant');
      }
    });

    it('points the live menu button at the chosen sample menu', async () => {
      process.env.DEMO_MODE = 'false';
      process.env.LANDING_DEMO_SLUG = 'test-restaurant-landing';
      expect((await page('en')).text).toContain('href="/m/test-restaurant-landing"');
    });

    it('on a demo site shows the first sample restaurant in the phone with nothing configured', async () => {
      process.env.DEMO_MODE = 'true';
      delete process.env.LANDING_DEMO_SLUG;
      expect((await page('en')).text).toMatch(/<iframe src="\/m\/[a-z0-9-]+\?lang=en"/);
    });
  });

  describe('the phone', () => {
    it('is an iPhone showing the real menu, in the language being read', async () => {
      process.env.DEMO_MODE = 'false';
      process.env.LANDING_DEMO_SLUG = 'test-restaurant-landing';
      const en = (await page('en')).text;
      expect(en).toContain('class="iphone"');
      expect(en).toContain('iphone__island');
      expect(en).toContain('iphone__home');
      expect(en).toMatch(/<iframe src="\/m\/test-restaurant-landing\?lang=en" title="[^"]+"/);
      expect((await page('ar')).text).toContain('src="/m/test-restaurant-landing?lang=ar"');
      expect(en).toContain('<a href="/m/test-restaurant-landing?lang=en" class="iphone__cover"');
    });

    it('stays left to right in the Arabic page, like the real device', async () => {
      process.env.DEMO_MODE = 'false';
      process.env.LANDING_DEMO_SLUG = 'test-restaurant-landing';
      expect((await page('ar')).text).toContain('<div class="iphone" dir="ltr">');
    });

    it('is left out when there is no real menu to show, rather than faked', async () => {
      process.env.DEMO_MODE = 'false';
      delete process.env.LANDING_DEMO_SLUG;
      expect((await page('en')).text).not.toContain('class="iphone"');
      process.env.LANDING_DEMO_SLUG = 'a-menu-that-does-not-exist';
      expect((await page('en')).text).not.toContain('class="iphone"');
    });

    it('is left out when the restaurant behind it is switched off', async () => {
      process.env.DEMO_MODE = 'false';
      process.env.LANDING_DEMO_SLUG = 'test-restaurant-landing';
      await prisma.subscription.create({
        data: { restaurantId, planId: planIds[0], status: 'SUSPENDED' },
      });
      try {
        expect((await page('en')).text).not.toContain('class="iphone"');
      } finally {
        await prisma.subscription.delete({ where: { restaurantId } });
      }
    });

    it('can be framed by the page itself and by nobody else', async () => {
      const res = await request(app.getHttpServer()).get('/m/test-restaurant-landing');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'self'");
    });
  });

  describe('looks designed, not generated', () => {
    it('has none of the template tells, and no gradient anywhere in the page', async () => {
      process.env.DEMO_MODE = 'false';
      process.env.LANDING_DEMO_SLUG = 'test-restaurant-landing';
      for (const lang of ['en', 'ar']) {
        const html = (await page(lang)).text;
        expect(html).not.toMatch(/gradient/i);
        const body = html.slice(html.indexOf('<header'), html.indexOf('</footer>'));
        expect(body).not.toMatch(/bg-gradient|from-primary|text-transparent/);
        expect(body).not.toMatch(/backdrop-blur|shadow-(raised|overlay)/);
        expect(body).not.toMatch(/ring-2/);
        const text = body.replace(
          /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g,
          ' ',
        );
        expect(text).not.toMatch(/[\u2013\u2014]|--/);
        expect(text.replace('©', '')).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(text).not.toMatch(/popular|most chosen|الأكثر اختيارا|seamless|all-in-one/i);
      }
    });

    it('does not dress features and steps up as a grid of identical icon cards', async () => {
      const html = (await page('en')).text;
      const features = /id="features"[\s\S]*?<\/section>/.exec(html)![0];
      expect(features).toContain('<dl');
      expect(features).not.toContain('<svg');
      expect(features).not.toContain('rounded-card');
      const how = /id="how"[\s\S]*?<\/section>/.exec(html)![0];
      expect(how).not.toContain('rounded-full');
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
