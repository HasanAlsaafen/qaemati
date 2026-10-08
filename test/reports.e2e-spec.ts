import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  TEST_ADMIN_PASSWORD,
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

describe('Reports (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const ids: string[] = [];
  let restaurantId: string;
  let ownerEmail: string;
  let cashierEmail: string;
  let otherId: string;
  let owner: ReturnType<typeof request.agent>;
  let dishX: string;
  let dishY: string;
  let seq = 100;

  const RANGE = 'from=2026-11-15&to=2026-11-20';
  const page = (query = RANGE, lang = 'en') =>
    owner.get(`/admin/reports?${query}`).set('Cookie', `qaemati_locale=${lang}`);

  async function order(
    rid: string,
    at: string,
    data: {
      table: string;
      status?: 'NEW' | 'SERVED' | 'READY' | 'CANCELED';
      total: number;
      currency?: string;
      note?: string;
      lines: {
        itemId?: string | null;
        nameEn: string;
        nameAr?: string;
        qty: number;
        unit: number;
      }[];
    },
  ) {
    return prisma.order.create({
      data: {
        restaurantId: rid,
        tableLabel: data.table,
        number: ++seq,
        status: data.status ?? 'SERVED',
        note: data.note,
        total: data.total,
        currency: data.currency ?? 'ILS',
        createdAt: new Date(at),
        items: {
          create: data.lines.map((l) => ({
            itemId: l.itemId ?? null,
            nameEn: l.nameEn,
            nameAr: l.nameAr ?? l.nameEn,
            quantity: l.qty,
            unitPrice: l.unit,
            lineTotal: l.qty * l.unit,
          })),
        },
      },
    });
  }

  beforeAll(async () => {
    const app0 = await createTestApp();
    app = app0;
    prisma = app.get(PrismaService);
    const fixture = await createTestRestaurant(prisma, 'reports');
    restaurantId = fixture.restaurant.id;
    ownerEmail = fixture.admin.email;
    ids.push(restaurantId);
    cashierEmail = `cashier-reports-${Date.now().toString(36)}@reports.example.com`;
    await prisma.adminUser.create({
      data: {
        restaurantId,
        email: cashierEmail,
        name: 'C',
        role: 'CASHIER',
        passwordHash: await bcrypt.hash(TEST_ADMIN_PASSWORD, 4),
      },
    });
    const category = await prisma.category.create({
      data: { restaurantId, nameAr: 'ق', nameEn: 'Cat' },
    });
    dishX = (
      await prisma.item.create({
        data: {
          restaurantId,
          categoryId: category.id,
          nameAr: 'إكس',
          nameEn: 'Dish X',
          price: 10,
          currency: 'ILS',
        },
      })
    ).id;
    dishY = (
      await prisma.item.create({
        data: {
          restaurantId,
          categoryId: category.id,
          nameAr: 'واي',
          nameEn: 'Dish Y',
          price: 5,
          currency: 'ILS',
        },
      })
    ).id;

    // Winter, so Hebron is UTC+2.
    await order(restaurantId, '2026-11-18T07:30:00Z', {
      table: '1',
      total: 25,
      note: 'No salt',
      lines: [
        { itemId: dishX, nameEn: 'Dish X', qty: 2, unit: 10 },
        { itemId: dishY, nameEn: 'Dish Y', qty: 1, unit: 5 },
      ],
    }); // 18th 09:30
    await order(restaurantId, '2026-11-18T08:10:00Z', {
      table: '1',
      status: 'CANCELED',
      total: 30,
      lines: [{ itemId: dishX, nameEn: 'Dish X', qty: 3, unit: 10 }],
    }); // canceled
    await order(restaurantId, '2026-11-18T22:30:00Z', {
      table: '2',
      status: 'READY',
      total: 15,
      lines: [{ itemId: dishX, nameEn: 'Dish X (Large)', qty: 1, unit: 15 }],
    }); // 19th 00:30 local
    await order(restaurantId, '2026-11-14T22:30:00Z', {
      table: '2',
      total: 5,
      lines: [{ itemId: dishY, nameEn: 'Dish Y', qty: 1, unit: 5 }],
    }); // 00:30 on the 15th locally, though 22:30 UTC on the 14th
    await order(restaurantId, '2026-11-20T22:30:00Z', {
      table: '9',
      total: 400,
      lines: [{ itemId: dishX, nameEn: 'Dish X', qty: 40, unit: 10 }],
    }); // 00:30 on the 21st locally though still the 20th in UTC: outside
    await order(restaurantId, '2026-11-14T21:30:00Z', {
      table: '9',
      total: 400,
      lines: [{ itemId: dishX, nameEn: 'Dish X', qty: 40, unit: 10 }],
    }); // 23:30 on the 14th locally: outside
    await order(restaurantId, '2026-11-16T10:00:00Z', {
      table: '3',
      total: 8,
      lines: [{ itemId: null, nameEn: '=HYPERLINK("http://evil.example")', qty: 1, unit: 8 }],
    }); // a deleted dish with a hostile name
    await prisma.waiterCall.create({
      data: {
        restaurantId,
        tableLabel: '1',
        createdAt: new Date('2026-11-18T07:00:00Z'),
        acknowledgedAt: new Date('2026-11-18T07:01:30Z'),
      },
    });
    await prisma.waiterCall.create({
      data: { restaurantId, tableLabel: '2', createdAt: new Date('2026-11-19T07:00:00Z') },
    });

    const other = await createTestRestaurant(prisma, 'reports-other');
    otherId = other.restaurant.id;
    ids.push(otherId);
    await order(otherId, '2026-11-18T07:30:00Z', {
      table: 'Z',
      total: 999,
      lines: [{ nameEn: 'Secret dish', qty: 9, unit: 111 }],
    });
    await prisma.waiterCall.create({
      data: { restaurantId: otherId, tableLabel: 'Z', createdAt: new Date('2026-11-18T07:00:00Z') },
    });

    owner = await loginAsAdmin(app, ownerEmail);
  });

  afterAll(async () => {
    for (const id of ids) await deleteTestRestaurant(prisma, id);
    await app.close();
  });

  describe('the numbers', () => {
    it('reports the suggested dishes guests added in the range, most added first, and no other restaurant', async () => {
      const at = (iso: string) => new Date(iso);
      await prisma.suggestionAdd.createMany({
        data: [
          { restaurantId, itemId: dishX, reason: 'popular', createdAt: at('2026-11-16T10:00:00Z') },
          { restaurantId, itemId: dishX, reason: 'pairing', createdAt: at('2026-11-17T10:00:00Z') },
          {
            restaurantId,
            itemId: dishY,
            reason: 'together',
            createdAt: at('2026-11-17T11:00:00Z'),
          },
          {
            restaurantId,
            itemId: dishY,
            reason: 'together',
            createdAt: at('2026-12-30T11:00:00Z'),
          },
        ],
      });
      try {
        const res = await page();
        expect(res.text).toContain('Added from suggestions');
        expect(res.text).toContain('Guests added 3 suggested dishes');
        const section = res.text.slice(res.text.indexOf('suggested-title'));
        expect(section.indexOf('Dish X')).toBeGreaterThan(-1);
        expect(section.indexOf('Dish X')).toBeLessThan(section.indexOf('Dish Y'));
      } finally {
        await prisma.suggestionAdd.deleteMany({ where: { restaurantId } });
      }
    });

    it('counts orders that were not canceled, in the restaurant own days', async () => {
      const res = await page();
      expect(res.status).toBe(200);
      // 25 + 15 + 5 + 8 = 53 over 4 orders. The canceled one and two outside the range are not in.
      expect(res.text).toMatch(/Orders<\/dt>\s*<dd[^>]*>4</);
      expect(res.text).toMatch(/Revenue<\/dt>\s*<dd[^>]*>53\.00/);
      expect(res.text).toMatch(/Average order<\/dt>\s*<dd[^>]*>13\.25/);
      expect(res.text).toMatch(/Canceled<\/dt>\s*<dd[^>]*>1 /);
    });

    it('puts an order just after local midnight on the next day, and one just before midnight on its day', async () => {
      const res = await page();
      const row = (date: string) =>
        new RegExp(`${date}</th>\\s*<td[^>]*>(\\d+)</td>`).exec(res.text)?.[1];
      expect(row('2026-11-15')).toBe('1'); // 22:30 UTC the day before is already the 15th here
      expect(row('2026-11-18')).toBe('1'); // the canceled one is not counted
      expect(row('2026-11-19')).toBe('1'); // 22:30 UTC on the 18th is 00:30 on the 19th here
      expect(row('2026-11-16')).toBe('1');
    });

    it('lists days with no orders as zero instead of leaving them out', async () => {
      const res = await page();
      for (const date of ['2026-11-17', '2026-11-20']) {
        expect(res.text).toMatch(new RegExp(`${date}</th>\\s*<td[^>]*>0</td>`));
      }
      expect(
        (res.text.match(/<th scope="row"[^>]*dir="ltr">2026-11-\d\d<\/th>/g) ?? []).length,
      ).toBe(6);
    });

    it('groups hours by the restaurant clock', async () => {
      const res = await page();
      for (const hour of ['09:00', '00:00', '12:00']) expect(res.text).toContain(`${hour}`);
      // Two orders were placed just after local midnight, both counted at 00:00.
      expect(res.text).toMatch(/00:00<\/th>\s*<td[^>]*>2</);
      expect(res.text).not.toContain('07:00</th>');
      expect(res.text).not.toContain('22:00</th>');
    });

    it('adds up a dish across its sizes and ranks by how many were sold', async () => {
      const res = await page();
      // X: 2 plain + 1 large = 3, Y: 1 + 1 = 2.
      const x = /Dish X<\/th><td[^>]*>(\d+)</.exec(res.text)?.[1];
      const y = /Dish Y<\/th><td[^>]*>(\d+)</.exec(res.text)?.[1];
      expect([x, y]).toEqual(['3', '2']);
      expect(res.text.indexOf('Dish X')).toBeLessThan(res.text.indexOf('Dish Y'));
      expect(res.text).not.toContain('Dish X (Large)');
    });

    it('ranks tables and counts waiter calls with the average time to answer', async () => {
      const res = await page();
      expect(res.text).toMatch(/<th scope="row"[^>]*>2<\/th><td[^>]*>2</); // table 2 has two orders
      expect(res.text).toMatch(/Calls<\/dt>\s*<dd[^>]*>2</);
      expect(res.text).toContain('1.5 minutes');
    });

    it('never mixes in another restaurant', async () => {
      const res = await page();
      expect(res.text).not.toContain('Secret dish');
      expect(res.text).not.toContain('999');
    });

    it('says when orders in more than one currency were found, and does not add them up', async () => {
      const usd = await order(restaurantId, '2026-11-17T10:00:00Z', {
        table: '5',
        currency: 'USD',
        total: 700,
        lines: [{ nameEn: 'Imported', qty: 1, unit: 700 }],
      });
      try {
        const res = await page();
        expect(res.text).toContain('more than one currency');
        expect(res.text).toMatch(/Revenue<\/dt>\s*<dd[^>]*>700\.00/);
        expect(res.text).toMatch(/Orders<\/dt>\s*<dd[^>]*>5</);
      } finally {
        await prisma.order.delete({ where: { id: usd.id } });
      }
    });

    it('shows an empty state for a period with nothing', async () => {
      const res = await page('from=2025-01-01&to=2025-01-07');
      expect(res.text).toContain('No table orders in this period');
    });

    it('is in Arabic for an Arabic reader', async () => {
      const res = await page(RANGE, 'ar');
      expect(res.text).toContain('التقارير');
      expect(res.text).toContain('الأطباق الأكثر طلبا');
      expect(res.text).toContain('إكس');
    });
  });

  describe('choosing the period', () => {
    it('knows the presets and marks the one in use', async () => {
      const res = await owner.get('/admin/reports?range=30d').set('Cookie', 'qaemati_locale=en');
      expect(res.text).toMatch(/href="\/admin\/reports\?range=30d" aria-current="true"/);
    });

    it.each([
      ['an impossible date', 'from=2026-02-31&to=2026-03-05'],
      ['dates in the wrong order', 'from=2026-03-05&to=2026-03-01'],
      ['more than a year', 'from=2020-01-01&to=2026-01-01'],
      ['words', 'from=yesterday&to=today'],
      ['an attempt to inject SQL', 'from=2026-01-01\';DROP TABLE "Order";--&to=2026-01-02'],
      ['a repeated parameter', 'range=7d&range=30d'],
    ])('falls back to the last 7 days for %s', async (_label, query) => {
      const res = await owner.get(`/admin/reports?${query}`).set('Cookie', 'qaemati_locale=en');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/href="\/admin\/reports\?range=7d" aria-current="true"/);
      expect(await prisma.order.count({ where: { restaurantId } })).toBeGreaterThan(0);
    });
  });

  describe('the CSV download', () => {
    const csv = (query = RANGE) =>
      owner
        .get(`/admin/reports/export.csv?${query}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks).toString('utf8')));
        });

    it('is a download named for the period, readable by Excel in Arabic', async () => {
      const res = await csv();
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="orders-2026-11-15-to-2026-11-20.csv"',
      );
      expect(res.headers['cache-control']).toBe('no-store');
      expect((res.body as string).charCodeAt(0)).toBe(0xfeff);
    });

    it('has one row per ordered dish in the period, canceled ones included and marked', async () => {
      const text = (await csv()).body as string;
      const lines = text.trim().split('\r\n');
      expect(lines[0]).toContain('order,date,table,status,dish_ar,dish_en,quantity');
      // 25 (2 lines) + 30 canceled (1) + 15 (1) + 5 (1) + 8 (1) = 6 rows.
      expect(lines).toHaveLength(7);
      expect(text).toContain('CANCELED');
      expect(text).toContain('2026-11-19 00:30');
      expect(text).toContain('2026-11-15 00:30');
      expect(text).not.toContain('Secret dish');
    });

    it('puts the order total and the note on the first line of an order only', async () => {
      const text = (await csv()).body as string;
      const rows = text
        .trim()
        .split('\r\n')
        .filter((l) => l.includes('Dish X') || l.includes('Dish Y'))
        .filter((l) => l.includes(',SERVED,'));
      const noteRows = rows.filter((l) => l.includes('No salt'));
      expect(noteRows).toHaveLength(1);
    });

    it('defuses a dish named like a spreadsheet formula', async () => {
      const text = (await csv()).body as string;
      expect(text).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
      expect(text).not.toMatch(/,=HYPERLINK/);
    });
  });

  describe('who can open it', () => {
    it('sends someone who is not signed in to the sign in page', async () => {
      for (const path of ['/admin/reports', '/admin/reports/export.csv']) {
        const res = await request(app.getHttpServer()).get(path);
        expect([path, res.status]).toEqual([path, 302]);
        expect(res.headers.location).toContain('/admin/login');
      }
    });

    it('keeps cashier and kitchen accounts out, including the download', async () => {
      const cashier = await loginAsAdmin(app, cashierEmail);
      for (const path of ['/admin/reports', '/admin/reports/export.csv']) {
        const res = await cashier.get(path);
        expect([path, res.status, res.headers.location]).toEqual([path, 302, '/admin/pos']);
      }
    });

    it('needs a plan with analytics', async () => {
      const plan = await prisma.plan.create({
        data: {
          nameAr: 'خ',
          nameEn: `NoAnalytics ${Date.now()}`,
          priceAmount: 1,
          currency: 'ILS',
          features: [],
        },
      });
      await prisma.subscription.create({
        data: { restaurantId, planId: plan.id, status: 'ACTIVE' },
      });
      try {
        expect((await owner.get('/admin/reports')).status).toBe(402);
        expect((await owner.get('/admin/reports/export.csv')).status).toBe(402);
      } finally {
        await prisma.subscription.delete({ where: { restaurantId } });
        await prisma.plan.delete({ where: { id: plan.id } });
      }
    });

    it('shows the other restaurant only its own numbers', async () => {
      const other = await prisma.adminUser.findFirstOrThrow({ where: { restaurantId: otherId } });
      const agent = await loginAsAdmin(app, other.email);
      const res = await agent.get(`/admin/reports?${RANGE}`).set('Cookie', 'qaemati_locale=en');
      expect(res.text).toContain('Secret dish');
      expect(res.text).not.toContain('Dish X');
      expect(res.text).toMatch(/Revenue<\/dt>\s*<dd[^>]*>999\.00/);
    });
  });
});
