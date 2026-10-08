import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { PlatformReportsService } from '../src/super-admin/platform-reports.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';
const DAY = 86_400_000;

describe('Platform reports (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let reports: PlatformReportsService;
  let agent: ReturnType<typeof request.agent>;
  let superId: string;
  let planId: string;
  const ids: string[] = [];
  const tag = Date.now().toString(36);
  const now = new Date();
  const monthsAgo = (n: number, day = 10) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, day, 12));

  async function tenant(
    name: string,
    subscription: {
      status?: 'TRIALING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELED';
      currentPeriodEnd?: Date;
      trialEndsAt?: Date;
      canceledAt?: Date;
    },
  ) {
    const fixture = await createTestRestaurant(prisma, `sreports-${tag}-${name}`);
    ids.push(fixture.restaurant.id);
    await prisma.restaurant.update({
      where: { id: fixture.restaurant.id },
      data: { nameEn: `SR ${name} ${tag}` },
    });
    const sub = await prisma.subscription.create({
      data: {
        restaurantId: fixture.restaurant.id,
        planId,
        status: 'ACTIVE',
        graceDays: 7,
        ...subscription,
      },
    });
    return {
      id: fixture.restaurant.id,
      subscriptionId: sub.id,
      email: fixture.admin.email,
      name: `SR ${name} ${tag}`,
    };
  }

  async function pay(
    t: { id: string; subscriptionId: string },
    amount: number,
    paidAt: Date,
    status: 'PAID' | 'VOID' = 'PAID',
    currency = 'ILS',
  ) {
    return prisma.payment.create({
      data: {
        restaurantId: t.id,
        subscriptionId: t.subscriptionId,
        amount,
        currency,
        method: 'CASH',
        paidAt,
        periodStart: paidAt,
        periodEnd: new Date(paidAt.getTime() + 30 * DAY),
        periods: 1,
        status,
        ...(status === 'VOID' ? { voidedAt: new Date(), voidReason: 'test' } : {}),
      },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    reports = app.get(PlatformReportsService);
    const email = `op-sreports-${tag}@x.example.com`;
    superId = (
      await prisma.superAdmin.create({
        data: { email, name: 'Op', passwordHash: await bcrypt.hash('Super@Password123', 4) },
      })
    ).id;
    planId = (
      await prisma.plan.create({
        data: {
          nameAr: 'تقارير',
          nameEn: `Reports plan ${tag}`,
          priceAmount: 60,
          currency: 'ILS',
          features: [],
        },
      })
    ).id;
    agent = request.agent(app.getHttpServer());
    const page = await agent.get('/super/login');
    await agent
      .post('/super/login')
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), email, password: 'Super@Password123' });
  });

  afterAll(async () => {
    for (const id of ids) await deleteTestRestaurant(prisma, id);
    await prisma.plan.deleteMany({ where: { id: planId } });
    await prisma.superAdmin.delete({ where: { id: superId } });
    await app.close();
  });

  describe('the numbers', () => {
    it('adds what was received in each month, leaving out voided payments, and counts joiners who paid', async () => {
      const before = await reports.report(12);
      const a = await tenant('a', { currentPeriodEnd: new Date(now.getTime() + 90 * DAY) });
      const b = await tenant('b', { currentPeriodEnd: new Date(now.getTime() + 90 * DAY) });
      await pay(a, 60, monthsAgo(1));
      await pay(a, 60.5, monthsAgo(1, 20));
      await pay(b, 999, monthsAgo(1), 'VOID');
      await pay(b, 25, monthsAgo(2));
      await pay(b, 7, monthsAgo(1, 5), 'PAID', 'USD');
      await pay(b, 5000, monthsAgo(30)); // far before the window

      const after = await reports.report(12);
      const delta = (month: string, currency: string) =>
        (after.revenue.rows.find((r) => r.month === month)?.byCurrency[currency] ?? 0) -
        (before.revenue.rows.find((r) => r.month === month)?.byCurrency[currency] ?? 0);
      const m1 = after.months[after.months.length - 2];
      const m2 = after.months[after.months.length - 3];
      expect(delta(m1, 'ILS')).toBeCloseTo(120.5, 2);
      expect(delta(m2, 'ILS')).toBeCloseTo(25, 2);
      expect(delta(m1, 'USD')).toBeCloseTo(7, 2);
      expect(after.revenue.totals.ILS - (before.revenue.totals.ILS ?? 0)).toBeCloseTo(145.5, 2);

      const thisMonth = (r: typeof after) => r.signups[r.signups.length - 1];
      expect(thisMonth(after).created - thisMonth(before).created).toBe(2);
      expect(thisMonth(after).converted - thisMonth(before).converted).toBe(2);
    });

    it('shows how many restaurants are in each state and what each plan brings in', async () => {
      const before = await reports.report(12);
      await tenant('paying', { currentPeriodEnd: new Date(now.getTime() + 60 * DAY) });
      await tenant('trial', { status: 'TRIALING', trialEndsAt: new Date(now.getTime() + 5 * DAY) });
      await tenant('grace', { currentPeriodEnd: new Date(now.getTime() - 2 * DAY) });
      await tenant('dead', { currentPeriodEnd: new Date(now.getTime() - 60 * DAY) });
      const after = await reports.report(12);
      for (const [key, plus] of [
        ['ok', 1],
        ['trial', 1],
        ['grace', 1],
        ['blocked', 1],
      ] as const) {
        expect(after.states[key] - before.states[key]).toBe(plus);
      }
      const plan = (r: typeof after) =>
        r.plans.find((p) => p.id === planId) ?? { running: 0, paying: 0, mrr: 0 };
      // The paying and the grace restaurants are paid plans, the trial is not. The dead one is not running.
      expect(plan(after).running - plan(before).running).toBe(3);
      expect(plan(after).paying - plan(before).paying).toBe(2);
      expect(plan(after).mrr - plan(before).mrr).toBeCloseTo(120, 2);
    });

    it('counts a cancellation and a lapse in the month they happened', async () => {
      const before = await reports.report(12);
      await tenant('canceled', {
        status: 'CANCELED',
        canceledAt: new Date(now.getTime() - 1 * DAY),
        currentPeriodEnd: new Date(now.getTime() - 20 * DAY),
      });
      const after = await reports.report(12);
      const sum = (r: typeof after, key: 'canceled' | 'lapsed') =>
        r.losses.reduce((s, row) => s + row[key], 0);
      expect(sum(after, 'canceled') - sum(before, 'canceled')).toBe(1);
      // A canceled restaurant is the operator's decision, not a lapse.
      expect(sum(after, 'lapsed') - sum(before, 'lapsed')).toBe(0);
    });

    it('lists what is due in the next 30 days, soonest first, and nothing farther off', async () => {
      const soon = await tenant('due-soon', {
        currentPeriodEnd: new Date(now.getTime() + 4 * DAY),
      });
      const later = await tenant('due-later', {
        currentPeriodEnd: new Date(now.getTime() + 25 * DAY),
      });
      const far = await tenant('due-far', {
        currentPeriodEnd: new Date(now.getTime() + 200 * DAY),
      });
      const report = await reports.report(12);
      const names = report.renewals.map((r) => r.restaurant.id);
      expect(names).toContain(soon.id);
      expect(names).toContain(later.id);
      expect(names).not.toContain(far.id);
      expect(names.indexOf(soon.id)).toBeLessThan(names.indexOf(later.id));
    });
  });

  describe('the page', () => {
    it('shows the reports in the operator area and in Arabic', async () => {
      const en = await agent.get('/super/reports').set('Cookie', 'qaemati_locale=en');
      expect(en.status).toBe(200);
      for (const text of [
        'Revenue received',
        'Joined, paid, lost',
        'Due in the next 30 days',
        'Download payments CSV',
      ]) {
        expect(en.text).toContain(text);
      }
      expect(en.text).toContain('href="/super/reports"');
      const ar = await agent.get('/super/reports').set('Cookie', 'qaemati_locale=ar');
      expect(ar.text).toContain('الإيرادات المستلمة');
    });

    it('lists the restaurants due soon with a link to each', async () => {
      const res = await agent.get('/super/reports').set('Cookie', 'qaemati_locale=en');
      expect(res.text).toContain(`SR due-soon ${tag}`);
      expect(res.text).not.toContain(`SR due-far ${tag}`);
      expect(res.text).toMatch(/href="\/super\/restaurants\/[a-z0-9]+"/);
    });

    it.each([['6'], ['12'], ['24']])('shows %s months and marks it', async (months) => {
      const res = await agent
        .get(`/super/reports?months=${months}`)
        .set('Cookie', 'qaemati_locale=en');
      expect(res.text).toMatch(
        new RegExp(`href="/super/reports\\?months=${months}" aria-current="true"`),
      );
      expect(
        (res.text.match(/<th scope="row"[^>]*dir="ltr">20\d\d-\d\d<\/th>/g) ?? []).length,
      ).toBeGreaterThanOrEqual(Number(months));
    });

    it.each([['7'], ['abc'], ['999999'], ['12; DROP TABLE "Payment"'], ['-3']])(
      'falls back to 12 months for %s',
      async (months) => {
        const res = await agent
          .get(`/super/reports?months=${encodeURIComponent(months)}`)
          .set('Cookie', 'qaemati_locale=en');
        expect(res.status).toBe(200);
        expect(res.text).toMatch(/href="\/super\/reports\?months=12" aria-current="true"/);
        expect(await prisma.payment.count()).toBeGreaterThan(0);
      },
    );
  });

  describe('the payments file', () => {
    const csv = (query = 'months=12') =>
      agent
        .get(`/super/reports/payments.csv?${query}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks).toString('utf8')));
        });

    it('is a download for the books, with voided payments marked, that Excel reads in Arabic', async () => {
      const res = await csv();
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="payments-last-12-months.csv"',
      );
      expect(res.headers['content-type']).toContain('text/csv');
      const text = res.body as string;
      expect(text.charCodeAt(0)).toBe(0xfeff);
      expect(text).toContain('receipt,paid_on,restaurant_en');
      expect(text).toContain(`SR a ${tag}`);
      expect(text).toContain('VOID');
      expect(text).toMatch(/R-\d{6}/);
    });

    it('leaves out payments from before the period', async () => {
      const text = (await csv('months=6')).body as string;
      expect(text).not.toContain('5000.00');
    });

    it('defuses a restaurant named like a spreadsheet formula', async () => {
      const t = await tenant('formula', { currentPeriodEnd: new Date(now.getTime() + 60 * DAY) });
      await prisma.restaurant.update({
        where: { id: t.id },
        data: { nameEn: '=HYPERLINK("http://evil.example")' },
      });
      await pay(t, 10, monthsAgo(0, 1));
      const text = (await csv()).body as string;
      expect(text).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
    });
  });

  describe('who can open it', () => {
    it('sends someone who is not signed in to the platform sign in', async () => {
      for (const path of ['/super/reports', '/super/reports/payments.csv']) {
        const res = await request(app.getHttpServer()).get(path);
        expect([path, res.status, res.headers.location]).toEqual([path, 302, '/super/login']);
      }
    });

    it('keeps a restaurant owner out of it', async () => {
      const { restaurant, admin } = await createTestRestaurant(prisma, `sreports-owner-${tag}`);
      ids.push(restaurant.id);
      const owner = await loginAsAdmin(app, admin.email);
      for (const path of ['/super/reports', '/super/reports/payments.csv']) {
        const res = await owner.get(path);
        expect([path, res.status, res.headers.location]).toEqual([path, 302, '/super/login']);
      }
    });
  });
});
