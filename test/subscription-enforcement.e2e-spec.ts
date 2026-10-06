import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { addDays } from '../src/tenancy/billing-dates';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

describe('Subscriptions, limits and features (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let planId: string;
  let openPlanId: string;
  const restaurantIds: string[] = [];
  let seq = 0;

  async function tenant(options: {
    status?: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
    trialEndsAt?: Date | null;
    currentPeriodEnd?: Date | null;
    graceDays?: number;
    plan?: 'limited' | 'open';
  }) {
    const suffix = `sub-${++seq}`;
    const { restaurant, admin } = await createTestRestaurant(prisma, suffix);
    restaurantIds.push(restaurant.id);
    await prisma.subscription.create({
      data: {
        restaurantId: restaurant.id,
        planId: options.plan === 'open' ? openPlanId : planId,
        status: options.status ?? 'ACTIVE',
        trialEndsAt: options.trialEndsAt ?? null,
        currentPeriodEnd:
          options.currentPeriodEnd === undefined
            ? addDays(new Date(), 20)
            : options.currentPeriodEnd,
        graceDays: options.graceDays ?? 7,
      },
    });
    const category = await prisma.category.create({
      data: { restaurantId: restaurant.id, nameAr: 'قسم', nameEn: 'Starters' },
    });
    const agent = await loginAsAdmin(app, admin.email);
    return { restaurant, agent, categoryId: category.id, slug: restaurant.slug };
  }

  async function write(
    agent: ReturnType<typeof request.agent>,
    verb: 'post' | 'patch' | 'delete',
    path: string,
    body: Record<string, string> = {},
  ) {
    const page = await agent.get('/admin/billing?lang=en').set('Cookie', 'qaemati_locale=en');
    const csrf = /name="csrf_token" value="([^"]*)"/.exec(page.text)?.[1] ?? '';
    return agent[verb](path)
      .set('X-CSRF-Token', csrf)
      .set('HX-Request', 'true')
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send(body);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    planId = (
      await prisma.plan.create({
        data: {
          nameAr: 'محدودة',
          nameEn: 'Limited',
          priceAmount: 30,
          currency: 'ILS',
          maxItems: 1,
          maxCategories: 2,
          maxMenus: 1,
          features: [],
        },
      })
    ).id;
    openPlanId = (
      await prisma.plan.create({
        data: {
          nameAr: 'مفتوحة',
          nameEn: 'Open',
          priceAmount: 60,
          currency: 'ILS',
          features: ['bulkTools', 'analytics', 'whatsappOrdering'],
        },
      })
    ).id;
  });

  afterAll(async () => {
    for (const id of restaurantIds) await deleteTestRestaurant(prisma, id);
    await prisma.plan.deleteMany({ where: { id: { in: [planId, openPlanId] } } });
    await app.close();
  });

  describe('plan limits', () => {
    it('allows dishes up to the limit, then answers 402 with a toast naming the limit', async () => {
      const { agent, categoryId, restaurant } = await tenant({});
      const first = await write(agent, 'post', `/admin/categories/${categoryId}/items`, {
        nameAr: 'ص',
        nameEn: 'One',
        price: '1',
        currency: 'ILS',
      });
      expect(first.status).toBe(201);
      const second = await write(agent, 'post', `/admin/categories/${categoryId}/items`, {
        nameAr: 'ص',
        nameEn: 'Two',
        price: '1',
        currency: 'ILS',
      });
      expect(second.status).toBe(402);
      const toast = JSON.parse(second.headers['hx-trigger']).toast;
      expect(decodeURIComponent(toast.message)).toBe(
        'Your plan allows 1 dishes. Upgrade to add more.',
      );
      expect(await prisma.item.count({ where: { restaurantId: restaurant.id } })).toBe(1);
    });

    it('limits menus and categories the same way', async () => {
      const { agent } = await tenant({});
      const menu = await write(agent, 'post', '/admin/menus', {
        nameAr: 'ق',
        nameEn: 'Second menu',
      });
      expect(menu.status).toBe(402);
      await write(agent, 'post', '/admin/categories', { nameAr: 'ق', nameEn: 'Second' });
      const third = await write(agent, 'post', '/admin/categories', {
        nameAr: 'ق',
        nameEn: 'Third',
      });
      expect(third.status).toBe(402);
    });

    it('turns CSV rows beyond the limit into row errors instead of creating them', async () => {
      const { agent, restaurant } = await tenant({});
      const page = await agent.get('/admin/billing?lang=en');
      const csrf = /name="csrf_token" value="([^"]*)"/.exec(page.text)?.[1] ?? '';
      const csv =
        'id,category,nameAr,nameEn,price,currency,available\n,Starters,أ,Dish A,1,ILS,true\n,Starters,ب,Dish B,1,ILS,true\n';
      const res = await agent
        .post('/admin/bulk/import')
        .set('X-CSRF-Token', csrf)
        .set('HX-Request', 'true')
        .attach('file', Buffer.from(csv), { filename: 'x.csv', contentType: 'text/csv' });
      // The limited plan has no bulk tools, so the whole route is refused.
      expect(res.status).toBe(402);
      expect(await prisma.item.count({ where: { restaurantId: restaurant.id } })).toBe(0);
    });

    it('with bulk tools but a cap, turns rows beyond the limit into row errors', async () => {
      const capped = await prisma.plan.create({
        data: {
          nameAr: 'مجمّعة',
          nameEn: 'Bulk capped',
          priceAmount: 10,
          currency: 'ILS',
          maxItems: 1,
          features: ['bulkTools'],
        },
      });
      const { agent, restaurant } = await tenant({});
      await prisma.subscription.update({
        where: { restaurantId: restaurant.id },
        data: { planId: capped.id },
      });
      const page = await agent.get('/admin/billing?lang=en');
      const csrf = /name="csrf_token" value="([^"]*)"/.exec(page.text)?.[1] ?? '';
      const csv =
        'id,category,nameAr,nameEn,price,currency,available\n,Starters,أ,Dish A,1,ILS,true\n,Starters,ب,Dish B,1,ILS,true\n';
      const res = await agent
        .post('/admin/bulk/import')
        .set('X-CSRF-Token', csrf)
        .attach('file', Buffer.from(csv), { filename: 'x.csv', contentType: 'text/csv' });
      expect(res.status).toBe(201);
      expect(res.text).toContain('Plan limit of 1 dishes reached');
      expect(await prisma.item.count({ where: { restaurantId: restaurant.id } })).toBe(1);
      await prisma.subscription.update({
        where: { restaurantId: restaurant.id },
        data: { planId },
      });
      await prisma.plan.delete({ where: { id: capped.id } });
    });

    it('does not limit a plan that has no cap', async () => {
      const { agent, categoryId } = await tenant({ plan: 'open' });
      for (const n of ['A', 'B', 'C']) {
        const res = await write(agent, 'post', `/admin/categories/${categoryId}/items`, {
          nameAr: 'ص',
          nameEn: `Dish ${n}`,
          price: '1',
          currency: 'ILS',
        });
        expect(res.status).toBe(201);
      }
    });
  });

  describe('feature flags', () => {
    it('refuses bulk tools and analytics the plan does not include, and hides them from the menu', async () => {
      const { agent } = await tenant({});
      const bulk = await agent.get('/admin/bulk?lang=en');
      expect(bulk.status).toBe(402);
      expect((await agent.get('/admin/analytics?lang=en')).status).toBe(402);
      const dash = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
      expect(dash.text).not.toContain('href="/admin/bulk"');
      expect(dash.text).not.toContain('href="/admin/analytics"');
      expect(dash.text).toContain('href="/admin/billing"');
    });

    it('serves them when the plan includes them', async () => {
      const { agent } = await tenant({ plan: 'open' });
      expect((await agent.get('/admin/bulk?lang=en')).status).toBe(200);
      expect((await agent.get('/admin/analytics?lang=en')).status).toBe(200);
    });

    it('turns off the WhatsApp selection list but keeps the plain WhatsApp link', async () => {
      const limited = await tenant({});
      const off = await request(app.getHttpServer()).get(`/m/${limited.slug}?lang=en`);
      expect(off.text).not.toContain('selection.js');
      expect(off.text).not.toContain('data-menu-item="true"[^>]*>[\\s\\S]*add-to');
      expect(off.text).toContain('https://wa.me/');
      const open = await tenant({ plan: 'open' });
      await prisma.item.create({
        data: {
          restaurantId: open.restaurant.id,
          categoryId: open.categoryId,
          nameAr: 'ص',
          nameEn: 'Dish',
          price: 2,
          currency: 'ILS',
        },
      });
      const on = await request(app.getHttpServer()).get(`/m/${open.slug}?lang=en`);
      expect(on.text).toContain('selection.js');
    });
  });

  describe('subscription states', () => {
    it('shows a trial banner with the days left', async () => {
      const { agent } = await tenant({
        status: 'TRIALING',
        trialEndsAt: addDays(new Date(), 5),
        currentPeriodEnd: null,
      });
      const res = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
      expect(res.text).toMatch(/Free trial: [45] days left/);
    });

    it('keeps everything working in the grace period and warns that the menu is about to go offline', async () => {
      const { agent, slug, categoryId } = await tenant({
        currentPeriodEnd: addDays(new Date(), -2),
        graceDays: 7,
      });
      const dash = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
      expect(dash.text).toMatch(/goes offline in [45] days/);
      const created = await write(agent, 'post', `/admin/categories/${categoryId}/items`, {
        nameAr: 'ص',
        nameEn: 'During grace',
        price: '1',
        currency: 'ILS',
      });
      expect(created.status).toBe(201);
      expect((await request(app.getHttpServer()).get(`/m/${slug}?lang=en`)).status).toBe(200);
    });

    it.each([
      [
        'expired past the grace period',
        { currentPeriodEnd: addDays(new Date(), -30), graceDays: 7 },
      ],
      ['suspended', { status: 'SUSPENDED' as const }],
      ['canceled', { status: 'CANCELED' as const }],
    ])('takes the public menu offline when %s', async (_label, options) => {
      const { slug } = await tenant(options);
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      expect(res.status).toBe(503);
      expect(res.headers['retry-after']).toBeDefined();
      expect(res.text).toContain('not available right now');
      const json = await request(app.getHttpServer())
        .get(`/m/${slug}`)
        .set('Accept', 'application/json');
      expect(json.body).toMatchObject({ statusCode: 503, code: 'MENU_UNAVAILABLE' });
      expect(
        (await request(app.getHttpServer()).get(`/m/${slug}/manifest.webmanifest`)).status,
      ).toBe(404);
      const sitemap = await request(app.getHttpServer()).get('/sitemap.xml');
      expect(sitemap.text).not.toContain(`/m/${slug}<`);
    });

    it('keeps the owner able to read and see why, but refuses every change', async () => {
      const { agent, categoryId, restaurant } = await tenant({
        currentPeriodEnd: addDays(new Date(), -30),
      });
      const dash = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
      expect(dash.status).toBe(200);
      expect(dash.text).toContain('Your menu is offline and changes are turned off');
      expect((await agent.get('/admin/billing?lang=en')).status).toBe(200);
      for (const [verb, path, body] of [
        [
          'post',
          `/admin/categories/${categoryId}/items`,
          { nameAr: 'ص', nameEn: 'Nope', price: '1', currency: 'ILS' },
        ],
        ['post', '/admin/categories', { nameAr: 'ق', nameEn: 'Nope' }],
        ['patch', `/admin/categories/${categoryId}`, { nameAr: 'ق', nameEn: 'Renamed' }],
        ['delete', `/admin/categories/${categoryId}`, {}],
      ] as const) {
        const res = await write(agent, verb, path, body);
        expect(res.status).toBe(402);
      }
      expect(
        await prisma.category.count({ where: { restaurantId: restaurant.id, nameEn: 'Starters' } }),
      ).toBe(1);
    });

    it('lets a blocked owner still sign out', async () => {
      const { agent } = await tenant({ status: 'SUSPENDED' });
      const page = await agent.get('/admin/billing?lang=en');
      const csrf = /name="csrf_token" value="([^"]*)"/.exec(page.text)?.[1] ?? '';
      const res = await agent
        .post('/admin/logout')
        .set('X-CSRF-Token', csrf)
        .type('form')
        .send({ csrf_token: csrf });
      expect(res.status).toBe(302);
    });

    it('lets the owner preview their own menu while it is offline for diners', async () => {
      const { agent, slug } = await tenant({ status: 'SUSPENDED' });
      const res = await agent.get(`/m/${slug}?lang=en&previewName=Preview%20Name`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Preview Name');
    });

    it('brings the menu back as soon as the subscription is renewed', async () => {
      const { slug, restaurant } = await tenant({ status: 'SUSPENDED' });
      expect((await request(app.getHttpServer()).get(`/m/${slug}?lang=en`)).status).toBe(503);
      await prisma.subscription.update({
        where: { restaurantId: restaurant.id },
        data: { status: 'ACTIVE', currentPeriodEnd: addDays(new Date(), 30) },
      });
      expect((await request(app.getHttpServer()).get(`/m/${slug}?lang=en`)).status).toBe(200);
    });
  });

  describe('billing page and receipts', () => {
    it('shows the plan, the days, usage against limits and the included features', async () => {
      const { agent } = await tenant({});
      const res = await agent.get('/admin/billing?lang=en').set('Cookie', 'qaemati_locale=en');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Limited');
      expect(res.text).toContain('Paid until');
      expect(res.text).toMatch(/0 \/ 1/);
      expect(res.text).toContain('Not included');
    });

    it("opens its own receipts and refuses another restaurant's", async () => {
      const a = await tenant({ plan: 'open' });
      const b = await tenant({ plan: 'open' });
      const sub = await prisma.subscription.findUniqueOrThrow({
        where: { restaurantId: b.restaurant.id },
      });
      const payment = await prisma.payment.create({
        data: {
          restaurantId: b.restaurant.id,
          subscriptionId: sub.id,
          amount: 60,
          currency: 'ILS',
          method: 'CASH',
          paidAt: new Date(),
          periodStart: new Date(),
          periodEnd: addDays(new Date(), 30),
        },
      });
      const own = await b.agent.get(`/admin/billing/receipts/${payment.id}?lang=en`);
      expect(own.status).toBe(200);
      expect(own.text).toMatch(/R-\d{6}/);
      expect((await a.agent.get(`/admin/billing/receipts/${payment.id}`)).status).toBe(404);
    });
  });
});
