import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { nowInHebronMinutes } from '../src/common/open-status';
import { RATE_LIMIT_STORE, RateLimitStore } from '../src/common/rate-limit/rate-limit-store';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

// Jerusalem's Old City, used as the restaurant's position.
const HERE = { lat: 31.7767, lng: 35.2345 };
const near = { lat: HERE.lat + 0.0003, lng: HERE.lng, accuracy: 15 }; // about 33 m away
const far = { lat: HERE.lat + 0.02, lng: HERE.lng, accuracy: 15 }; // about 2.2 km away
const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';

describe('Table orders and waiter calls (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let limits: RateLimitStore;
  let guest: ReturnType<typeof request.agent>;
  let token = '';
  const ids: string[] = [];

  let restaurantId: string;
  let slug: string;
  let adminEmail: string;
  let tableA: { id: string; token: string; label: string };
  let tableB: { id: string; token: string };
  let burger: { id: string; addonCheese: string; addonBacon: string };
  let pizza: { id: string; small: string; large: string };
  let hiddenId: string;
  let breakfastItemId: string;
  let other: {
    slug: string;
    tableToken: string;
    itemId: string;
    restaurantId: string;
    adminEmail: string;
  };

  async function resetLimits() {
    for (const key of [
      `order-ip:::ffff:127.0.0.1`,
      `order-ip:127.0.0.1`,
      `call-ip:::ffff:127.0.0.1`,
      `call-ip:127.0.0.1`,
      `order-table:${tableA.id}`,
      `order-table:${tableB.id}`,
      `call-table:${tableA.id}`,
      `call-table:${tableB.id}`,
    ]) {
      await limits.reset(key);
    }
  }

  const post = (path: string, body: object, as = guest) =>
    as
      .post(path)
      .set('X-CSRF-Token', token)
      .set('Accept', 'application/json')
      .set('Cookie', 'qaemati_locale=en')
      .send(body);

  const order = (lines: { key: string; qty: number }[], extra: object = {}, table = tableA.token) =>
    post(`/m/${slug}/orders`, { table, lines, ...near, ...extra });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    limits = app.get<RateLimitStore>(RATE_LIMIT_STORE);

    const fixture = await createTestRestaurant(prisma, 'tableorders');
    restaurantId = fixture.restaurant.id;
    slug = fixture.restaurant.slug;
    adminEmail = fixture.admin.email;
    ids.push(restaurantId);
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { latitude: HERE.lat, longitude: HERE.lng, orderRadiusMeters: 150 },
    });
    tableA = await prisma.restaurantTable.create({ data: { restaurantId, label: '5' } });
    tableB = await prisma.restaurantTable.create({
      data: { restaurantId, label: '6', sortOrder: 1 },
    });

    const mains = await prisma.category.create({
      data: { restaurantId, nameAr: 'رئيسية', nameEn: 'Mains' },
    });
    const bf = await prisma.category.create({
      data: {
        restaurantId,
        nameAr: 'فطور',
        nameEn: 'Breakfast',
        availableFrom: '00:00',
        availableTo: '00:01',
      },
    });
    const b = await prisma.item.create({
      data: {
        restaurantId,
        categoryId: mains.id,
        nameAr: 'برجر',
        nameEn: 'Burger',
        price: 10,
        currency: 'ILS',
        addons: {
          create: [
            { restaurantId, nameAr: 'جبنة', nameEn: 'Cheese', price: 1.5 },
            { restaurantId, nameAr: 'لحم مقدد', nameEn: 'Bacon', price: 2.25 },
          ],
        },
      },
      include: { addons: true },
    });
    burger = {
      id: b.id,
      addonCheese: b.addons.find((a) => a.nameEn === 'Cheese')!.id,
      addonBacon: b.addons.find((a) => a.nameEn === 'Bacon')!.id,
    };
    const p = await prisma.item.create({
      data: {
        restaurantId,
        categoryId: mains.id,
        nameAr: 'بيتزا',
        nameEn: 'Pizza',
        price: 5,
        currency: 'ILS',
        variants: {
          create: [
            { restaurantId, nameAr: 'صغيرة', nameEn: 'Small', price: 8 },
            { restaurantId, nameAr: 'كبيرة', nameEn: 'Large', price: 12 },
          ],
        },
      },
      include: { variants: true },
    });
    pizza = {
      id: p.id,
      small: p.variants.find((v) => v.nameEn === 'Small')!.id,
      large: p.variants.find((v) => v.nameEn === 'Large')!.id,
    };
    hiddenId = (
      await prisma.item.create({
        data: {
          restaurantId,
          categoryId: mains.id,
          nameAr: 'مخفي',
          nameEn: 'Hidden',
          price: 3,
          currency: 'ILS',
          available: false,
        },
      })
    ).id;
    breakfastItemId = (
      await prisma.item.create({
        data: {
          restaurantId,
          categoryId: bf.id,
          nameAr: 'بيض',
          nameEn: 'Eggs',
          price: 4,
          currency: 'ILS',
        },
      })
    ).id;

    const otherFixture = await createTestRestaurant(prisma, 'tableorders-other');
    ids.push(otherFixture.restaurant.id);
    await prisma.restaurant.update({
      where: { id: otherFixture.restaurant.id },
      data: { latitude: HERE.lat, longitude: HERE.lng },
    });
    const otherTable = await prisma.restaurantTable.create({
      data: { restaurantId: otherFixture.restaurant.id, label: 'X1' },
    });
    const otherCategory = await prisma.category.create({
      data: { restaurantId: otherFixture.restaurant.id, nameAr: 'ا', nameEn: 'Other' },
    });
    const otherItem = await prisma.item.create({
      data: {
        restaurantId: otherFixture.restaurant.id,
        categoryId: otherCategory.id,
        nameAr: 'سر',
        nameEn: 'Secret',
        price: 99,
        currency: 'ILS',
      },
    });
    other = {
      slug: otherFixture.restaurant.slug,
      tableToken: otherTable.token,
      itemId: otherItem.id,
      restaurantId: otherFixture.restaurant.id,
      adminEmail: otherFixture.admin.email,
    };

    guest = request.agent(app.getHttpServer());
    token = csrfFrom((await guest.get('/admin/login')).text);
  });

  beforeEach(resetLimits);

  afterAll(async () => {
    for (const id of ids) await deleteTestRestaurant(prisma, id);
    await app.close();
  });

  describe('placing an order', () => {
    it('takes an order from a table, prices it itself and numbers it', async () => {
      const res = await order(
        [
          { key: burger.id, qty: 2 },
          { key: `${burger.id}::${burger.addonCheese},${burger.addonBacon}`, qty: 1 },
          { key: `${pizza.id}:${pizza.large}`, qty: 1 },
        ],
        { note: 'No onions' },
      );
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ number: 1, total: '45.75', currency: 'ILS' });
      const saved = await prisma.order.findUniqueOrThrow({
        where: { id: res.body.id },
        include: { items: true },
      });
      expect(saved).toMatchObject({
        restaurantId,
        tableId: tableA.id,
        tableLabel: '5',
        status: 'NEW',
        note: 'No onions',
      });
      expect(Number(saved.total)).toBe(45.75);
      expect(saved.distanceMeters).toBeGreaterThan(20);
      expect(saved.distanceMeters).toBeLessThan(50);
      const names = saved.items.map((i) => i.nameEn).sort();
      expect(names).toEqual(['Burger', 'Burger + Cheese, Bacon', 'Pizza (Large)']);
      expect(saved.items.find((i) => i.nameEn === 'Burger + Cheese, Bacon')!.nameAr).toBe(
        'برجر + جبنة, لحم مقدد',
      );
    });

    it('numbers orders one after another, with no repeats when they arrive together', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => order([{ key: burger.id, qty: 1 }], {}, tableB.token)),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      const numbers = results.map((r) => r.body.number as number).sort((a, b) => a - b);
      expect(new Set(numbers).size).toBe(5);
      expect(numbers[4] - numbers[0]).toBe(4);
    });

    it('ignores any price or name the browser sends and refuses fields it does not know', async () => {
      const res = await order([{ key: burger.id, qty: 1, price: 0.01, name: 'Free' } as never]);
      expect(res.status).toBe(422);
      const res2 = await order([{ key: burger.id, qty: 1 }], { total: 0.01 });
      expect(res2.status).toBe(422);
    });

    it('keeps what was ordered even after the menu changes', async () => {
      const res = await order([{ key: burger.id, qty: 1 }]);
      await prisma.item.update({
        where: { id: burger.id },
        data: { price: 99, nameEn: 'Renamed' },
      });
      const saved = await prisma.order.findUniqueOrThrow({
        where: { id: res.body.id },
        include: { items: true },
      });
      expect(Number(saved.total)).toBe(10);
      expect(saved.items[0].nameEn).toBe('Burger');
      await prisma.item.update({ where: { id: burger.id }, data: { price: 10, nameEn: 'Burger' } });
    });

    it.each([
      ['no lines', []],
      ['a quantity of zero', [{ key: 'x', qty: 0 }]],
      ['a quantity of 51', [{ key: 'x', qty: 51 }]],
      ['a fractional quantity', [{ key: 'x', qty: 1.5 }]],
      ['more than 40 lines', Array.from({ length: 41 }, (_, i) => ({ key: `i${i}`, qty: 1 }))],
    ])('refuses %s', async (_label, lines) => {
      expect((await order(lines as never)).status).toBe(422);
    });

    it.each([
      ['a key with a separator trick', 'a:b:c:d'],
      ['a key with a path in it', '../etc'],
      ['an unknown dish', 'doesnotexist'],
    ])('refuses %s', async (_label, key) => {
      const res = await order([{ key, qty: 1 }]);
      expect([422]).toContain(res.status);
      expect(res.body.error ?? 'validation').toBeDefined();
    });

    it('needs a size for a dish that has sizes, and refuses a size on one that does not', async () => {
      expect((await order([{ key: pizza.id, qty: 1 }])).body.error).toBe('invalid_order');
      expect((await order([{ key: `${burger.id}:${pizza.small}`, qty: 1 }])).body.error).toBe(
        'invalid_order',
      );
    });

    it('refuses a size or an extra that belongs to another dish', async () => {
      expect(
        (await order([{ key: `${pizza.id}:${pizza.small}:${burger.addonCheese}`, qty: 1 }])).body
          .error,
      ).toBe('invalid_order');
      expect((await order([{ key: `${burger.id}::${pizza.small}`, qty: 1 }])).body.error).toBe(
        'invalid_order',
      );
    });

    it("refuses another restaurant's dish", async () => {
      const res = await order([{ key: other.itemId, qty: 1 }]);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('invalid_order');
    });

    it('refuses a dish whose whole menu is closed right now', async () => {
      const now = nowInHebronMinutes();
      const hhmm = (m: number) => {
        const n = ((m % 1440) + 1440) % 1440;
        return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
      };
      const menu = await prisma.menu.create({
        data: {
          restaurantId,
          nameAr: 'مغلقة',
          nameEn: 'Closed menu',
          sortOrder: 9,
          availableFrom: hhmm(now + 120),
          availableTo: hhmm(now + 180),
        },
      });
      const category = await prisma.category.create({
        data: { restaurantId, menuId: menu.id, nameAr: 'ك', nameEn: 'Closed cat' },
      });
      const dish = await prisma.item.create({
        data: {
          restaurantId,
          categoryId: category.id,
          nameAr: 'طبق',
          nameEn: 'Closed dish',
          price: 5,
          currency: 'ILS',
        },
      });
      try {
        const res = await order([{ key: dish.id, qty: 1 }]);
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ error: 'item_unavailable' });
      } finally {
        await prisma.item.delete({ where: { id: dish.id } });
        await prisma.category.delete({ where: { id: category.id } });
        await prisma.menu.delete({ where: { id: menu.id } });
      }
    });

    it('refuses a dish that is switched off or outside its serving hours, naming it', async () => {
      const hidden = await order([{ key: hiddenId, qty: 1 }]);
      expect(hidden.status).toBe(409);
      expect(hidden.body).toMatchObject({ error: 'item_unavailable' });
      expect(hidden.body.message).toContain('Hidden');
      const eggs = await order([{ key: breakfastItemId, qty: 1 }]);
      expect(eggs.status).toBe(409);
      expect(
        await prisma.order.count({
          where: { restaurantId, items: { some: { itemId: hiddenId } } },
        }),
      ).toBe(0);
    });

    it('cleans the note of control characters and cuts it short', async () => {
      const res = await order([{ key: burger.id, qty: 1 }], {
        note: `a\u0000b\nc${'x'.repeat(400)}`,
      });
      expect(res.status).toBe(201);
      const saved = await prisma.order.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(saved.note).toMatch(/^a b c/);
      expect(saved.note!.length).toBeLessThanOrEqual(300);
    });

    it('answers in Arabic when the visitor reads Arabic', async () => {
      const res = await guest
        .post(`/m/${slug}/orders`)
        .set('X-CSRF-Token', token)
        .set('Accept', 'application/json')
        .set('Cookie', 'qaemati_locale=ar')
        .send({ table: tableA.token, lines: [{ key: hiddenId, qty: 1 }], ...near });
      expect(res.body.message).toMatch(/[؀-ۿ]/);
    });

    it('needs the CSRF token like every other write', async () => {
      const res = await request(app.getHttpServer())
        .post(`/m/${slug}/orders`)
        .send({ table: tableA.token, lines: [{ key: burger.id, qty: 1 }], ...near });
      expect(res.status).toBe(403);
    });
  });

  describe('which table it came from', () => {
    it('refuses a token that does not exist, the table name instead of its token, and another restaurant table', async () => {
      for (const table of ['nonsense', tableA.label, other.tableToken]) {
        const res = await order([{ key: burger.id, qty: 1 }], {}, table);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('unknown_table');
      }
    });

    it('cannot order for a restaurant through the address of another one', async () => {
      const res = await post(`/m/${other.slug}/orders`, {
        table: tableA.token,
        lines: [{ key: other.itemId, qty: 1 }],
        ...near,
      });
      expect(res.status).toBe(404);
      expect(await prisma.order.count({ where: { restaurantId: other.restaurantId } })).toBe(0);
    });
  });

  describe('being at the restaurant', () => {
    it('accepts a guest inside the radius and refuses one outside', async () => {
      expect((await order([{ key: burger.id, qty: 1 }], near)).status).toBe(201);
      const res = await order([{ key: burger.id, qty: 1 }], far);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('too_far');
    });

    it('asks for a position when none is sent, and refuses a vague or impossible one', async () => {
      const lines = [{ key: burger.id, qty: 1 }];
      const none = await post(`/m/${slug}/orders`, { table: tableA.token, lines });
      expect(none.body.error).toBe('location_required');
      expect((await order(lines, { lat: 999, lng: 0 })).body.error).toBe('location_required');
      expect((await order(lines, { accuracy: 5000 })).body.error).toBe('location_inaccurate');
    });

    it('does not need a position when the owner switched the check off', async () => {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { requireLocationCheck: false },
      });
      try {
        const res = await post(`/m/${slug}/orders`, {
          table: tableA.token,
          lines: [{ key: burger.id, qty: 1 }],
        });
        expect(res.status).toBe(201);
      } finally {
        await prisma.restaurant.update({
          where: { id: restaurantId },
          data: { requireLocationCheck: true },
        });
      }
    });

    it('does not block a restaurant that has not set its position yet', async () => {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { latitude: null, longitude: null },
      });
      try {
        const res = await post(`/m/${slug}/orders`, {
          table: tableA.token,
          lines: [{ key: burger.id, qty: 1 }],
        });
        expect(res.status).toBe(201);
      } finally {
        await prisma.restaurant.update({
          where: { id: restaurantId },
          data: { latitude: HERE.lat, longitude: HERE.lng },
        });
      }
    });

    it('applies to waiter calls as well', async () => {
      expect(
        (await post(`/m/${slug}/waiter-calls`, { table: tableA.token, ...far })).body.error,
      ).toBe('too_far');
    });
  });

  describe('the plan and the subscription', () => {
    it('is switched off by a plan without table ordering', async () => {
      const plan = await prisma.plan.create({
        data: {
          nameAr: 'خ',
          nameEn: `NoPOS ${Date.now()}`,
          priceAmount: 1,
          currency: 'ILS',
          features: ['analytics'],
        },
      });
      await prisma.subscription.create({
        data: { restaurantId, planId: plan.id, status: 'ACTIVE' },
      });
      try {
        const res = await order([{ key: burger.id, qty: 1 }]);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('not_available');
        expect(
          (await post(`/m/${slug}/waiter-calls`, { table: tableA.token, ...near })).status,
        ).toBe(403);
      } finally {
        await prisma.subscription.delete({ where: { restaurantId } });
        await prisma.plan.delete({ where: { id: plan.id } });
      }
    });

    it('is switched off with the menu when the subscription is over', async () => {
      const plan = await prisma.plan.create({
        data: {
          nameAr: 'خ',
          nameEn: `Pos ${Date.now()}`,
          priceAmount: 1,
          currency: 'ILS',
          features: ['tableOrdering'],
        },
      });
      await prisma.subscription.create({
        data: { restaurantId, planId: plan.id, status: 'SUSPENDED' },
      });
      try {
        const res = await order([{ key: burger.id, qty: 1 }]);
        expect(res.status).toBe(503);
        expect(res.body.error).toBe('menu_offline');
      } finally {
        await prisma.subscription.delete({ where: { restaurantId } });
        await prisma.plan.delete({ where: { id: plan.id } });
      }
    });
  });

  describe('limits on abuse', () => {
    it('stops a table sending order after order', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 10; i++)
        statuses.push((await order([{ key: burger.id, qty: 1 }])).status);
      expect(statuses.slice(0, 8)).toEqual(Array(8).fill(201));
      expect(statuses.slice(8)).toEqual([429, 429]);
    });

    it('stops one device spreading orders over many tables', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 17; i++) {
        await limits.reset(`order-table:${tableA.id}`);
        statuses.push((await order([{ key: burger.id, qty: 1 }])).status);
      }
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('following an order', () => {
    const status = (slugName: string, trackToken: string) =>
      request(app.getHttpServer())
        .get(`/m/${slugName}/orders/${trackToken}`)
        .set('Cookie', 'qaemati_locale=en');

    it('gives the guest a private token and shows only the number and the status', async () => {
      const placed = await order([{ key: burger.id, qty: 1 }]);
      expect(placed.body.track).toMatch(/^[0-9a-f-]{36}$/);
      expect(placed.body.track).not.toBe(placed.body.id);
      const res = await status(slug, placed.body.track);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ number: placed.body.number, status: 'NEW' });
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('follows the order as staff move it along', async () => {
      const placed = await order([{ key: burger.id, qty: 1 }]);
      await prisma.order.update({ where: { id: placed.body.id }, data: { status: 'READY' } });
      expect((await status(slug, placed.body.track)).body.status).toBe('READY');
      await prisma.order.update({ where: { id: placed.body.id }, data: { status: 'CANCELED' } });
      expect((await status(slug, placed.body.track)).body.status).toBe('CANCELED');
    });

    it('does not find an order by its id, a guess, or through another restaurant', async () => {
      const placed = await order([{ key: burger.id, qty: 1 }]);
      for (const [slugName, token] of [
        [slug, placed.body.id],
        [slug, 'not-a-token'],
        [slug, '00000000-0000-0000-0000-000000000000'],
        [other.slug, placed.body.track],
      ]) {
        const res = await status(slugName, token);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('unknown_order');
      }
    });

    it('answers in Arabic for an Arabic reader', async () => {
      const res = await request(app.getHttpServer())
        .get(`/m/${slug}/orders/00000000-0000-0000-0000-000000000000`)
        .set('Cookie', 'qaemati_locale=ar');
      expect(res.body.message).toMatch(/[\u0600-\u06FF]/);
    });
  });

  describe('calling the waiter', () => {
    it('creates one call, and a second tap while it is open is not a second call', async () => {
      const first = await post(`/m/${slug}/waiter-calls`, { table: tableB.token, ...near });
      expect(first.status).toBe(201);
      expect(first.body.alreadyCalled).toBe(false);
      const second = await post(`/m/${slug}/waiter-calls`, { table: tableB.token, ...near });
      expect(second.body).toMatchObject({ id: first.body.id, alreadyCalled: true });
      expect(
        await prisma.waiterCall.count({
          where: { tableId: tableB.id, status: { not: 'RESOLVED' } },
        }),
      ).toBe(1);
      await prisma.waiterCall.deleteMany({ where: { tableId: tableB.id } });
    });

    it('refuses an unknown table and another restaurant table', async () => {
      expect((await post(`/m/${slug}/waiter-calls`, { table: 'nope', ...near })).status).toBe(404);
      expect(
        (await post(`/m/${slug}/waiter-calls`, { table: other.tableToken, ...near })).status,
      ).toBe(404);
    });

    it('does not let a resolved call be repeated at once', async () => {
      const call = await post(`/m/${slug}/waiter-calls`, { table: tableB.token, ...near });
      await prisma.waiterCall.update({
        where: { id: call.body.id },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
      const again = await post(`/m/${slug}/waiter-calls`, { table: tableB.token, ...near });
      expect(again.status).toBe(429);
      await prisma.waiterCall.deleteMany({ where: { tableId: tableB.id } });
    });
  });

  describe('the staff screen', () => {
    let staff: ReturnType<typeof request.agent>;
    let staffToken: string;

    const staffPost = (path: string, body: object = {}) =>
      staff
        .post(path)
        .set('X-CSRF-Token', staffToken)
        .set('Cookie', 'qaemati_locale=en')
        .type('form')
        .send(body);

    beforeAll(async () => {
      staff = await loginAsAdmin(app, adminEmail);
      staffToken = csrfFrom((await staff.get('/admin')).text);
    });

    async function newOrder(table = tableA.token) {
      await resetLimits();
      const res = await order([{ key: burger.id, qty: 2 }], {}, table);
      return res.body.id as string;
    }

    it('shows the orders and the calls of its own restaurant only', async () => {
      const mine = await newOrder();
      await resetLimits();
      const foreign = await post(`/m/${other.slug}/orders`, {
        table: other.tableToken,
        lines: [{ key: other.itemId, qty: 1 }],
        ...near,
      });
      const board = await staff.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(board.status).toBe(200);
      expect(board.text).toContain(`data-order="${mine}"`);
      expect(board.text).not.toContain(`data-order="${foreign.body.id}"`);
      expect(board.text).toContain('Table 5');
      expect(board.text).toContain('Burger');
    });

    it('moves an order forward one step at a time and records who did it', async () => {
      const id = await newOrder();
      for (const status of ['PREPARING', 'READY', 'SERVED']) {
        const res = await staffPost(`/admin/pos/orders/${id}/status`, { status });
        expect(res.status).toBe(200);
      }
      const saved = await prisma.order.findUniqueOrThrow({ where: { id } });
      expect(saved.status).toBe('SERVED');
      expect(saved.statusChangedById).not.toBeNull();
    });

    it('refuses to skip a step or to reopen a finished order', async () => {
      const id = await newOrder();
      expect((await staffPost(`/admin/pos/orders/${id}/status`, { status: 'SERVED' })).status).toBe(
        409,
      );
      expect(
        (await staffPost(`/admin/pos/orders/${id}/status`, { status: 'CANCELED' })).status,
      ).toBe(200);
      expect(
        (await staffPost(`/admin/pos/orders/${id}/status`, { status: 'PREPARING' })).status,
      ).toBe(409);
      expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELED');
    });

    it('refuses an unknown status', async () => {
      const id = await newOrder();
      expect((await staffPost(`/admin/pos/orders/${id}/status`, { status: 'NEW' })).status).toBe(
        422,
      );
      expect(
        (await staffPost(`/admin/pos/orders/${id}/status`, { status: 'EXPLODED' })).status,
      ).toBe(422);
    });

    it('lets only one of two simultaneous taps win', async () => {
      const id = await newOrder();
      const results = await Promise.all([
        staffPost(`/admin/pos/orders/${id}/status`, { status: 'PREPARING' }),
        staffPost(`/admin/pos/orders/${id}/status`, { status: 'PREPARING' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it("cannot see or change another restaurant's order", async () => {
      await resetLimits();
      const foreign = await post(`/m/${other.slug}/orders`, {
        table: other.tableToken,
        lines: [{ key: other.itemId, qty: 1 }],
        ...near,
      });
      const res = await staffPost(`/admin/pos/orders/${foreign.body.id}/status`, {
        status: 'PREPARING',
      });
      expect(res.status).toBe(404);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: foreign.body.id } })).status,
      ).toBe('NEW');
    });

    it('handles a waiter call from open, to on my way, to done', async () => {
      await resetLimits();
      await prisma.waiterCall.deleteMany({ where: { restaurantId } });
      const call = await post(`/m/${slug}/waiter-calls`, { table: tableA.token, ...near });
      let board = await staff.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(board.text).toContain('Table 5 is calling');
      expect(board.text).toContain('data-open-calls="1"');

      expect((await staffPost(`/admin/pos/calls/${call.body.id}/acknowledge`)).status).toBe(200);
      board = await staff.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(board.text).toContain('data-open-calls="0"');
      expect(board.text).toContain('Someone is on the way');

      expect((await staffPost(`/admin/pos/calls/${call.body.id}/resolve`)).status).toBe(200);
      expect((await staffPost(`/admin/pos/calls/${call.body.id}/resolve`)).status).toBe(409);
      board = await staff.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(board.text).not.toContain('Table 5 is calling');
    });

    it("cannot answer another restaurant's call", async () => {
      await resetLimits();
      const foreign = await post(`/m/${other.slug}/waiter-calls`, {
        table: other.tableToken,
        ...near,
      });
      expect((await staffPost(`/admin/pos/calls/${foreign.body.id}/acknowledge`)).status).toBe(404);
    });

    it('keeps the order screen from anyone not signed in as staff', async () => {
      for (const path of ['/admin/pos', '/admin/pos/board']) {
        const res = await request(app.getHttpServer()).get(path);
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/admin/login');
      }
    });

    it('is closed to a plan without table ordering', async () => {
      const plan = await prisma.plan.create({
        data: {
          nameAr: 'خ',
          nameEn: `NoPOS2 ${Date.now()}`,
          priceAmount: 1,
          currency: 'ILS',
          features: [],
        },
      });
      await prisma.subscription.create({
        data: { restaurantId, planId: plan.id, status: 'ACTIVE' },
      });
      try {
        expect((await staff.get('/admin/pos')).status).toBe(402);
      } finally {
        await prisma.subscription.delete({ where: { restaurantId } });
        await prisma.plan.delete({ where: { id: plan.id } });
      }
    });

    describe('the location settings', () => {
      it('saves a position, a radius and the switch', async () => {
        const res = await staffPost('/admin/pos/settings', {
          latitude: '31.9522',
          longitude: '35.2332',
          orderRadiusMeters: '200',
          requireLocationCheck: 'on',
        });
        expect(res.status).toBe(204);
        const saved = await prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
        expect(Number(saved.latitude)).toBe(31.9522);
        expect(saved.orderRadiusMeters).toBe(200);
        expect(saved.requireLocationCheck).toBe(true);
        await staffPost('/admin/pos/settings', {
          latitude: String(HERE.lat),
          longitude: String(HERE.lng),
          orderRadiusMeters: '150',
          requireLocationCheck: 'on',
        });
      });

      it('turns the check off when the box is not sent', async () => {
        await staffPost('/admin/pos/settings', {
          latitude: '',
          longitude: '',
          orderRadiusMeters: '150',
        });
        const saved = await prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
        expect(saved.requireLocationCheck).toBe(false);
        expect(saved.latitude).toBeNull();
        await prisma.restaurant.update({
          where: { id: restaurantId },
          data: {
            latitude: HERE.lat,
            longitude: HERE.lng,
            requireLocationCheck: true,
            orderRadiusMeters: 150,
          },
        });
      });

      it.each([
        [
          'only a latitude',
          { latitude: '31.9', longitude: '', orderRadiusMeters: '150' },
          'longitude',
        ],
        [
          'a latitude out of range',
          { latitude: '91', longitude: '35', orderRadiusMeters: '150' },
          'latitude',
        ],
        [
          'text as a coordinate',
          { latitude: 'north', longitude: '35', orderRadiusMeters: '150' },
          'latitude',
        ],
        [
          'a radius that is too small',
          { latitude: '31', longitude: '35', orderRadiusMeters: '10' },
          'orderRadiusMeters',
        ],
        [
          'a radius that is too large',
          { latitude: '31', longitude: '35', orderRadiusMeters: '5000' },
          'orderRadiusMeters',
        ],
      ])('refuses %s with a message on that field', async (_label, body, field) => {
        const res = await staffPost('/admin/pos/settings', body);
        expect(res.status).toBe(422);
        expect(Object.keys(res.body.errors)).toContain(field);
      });

      it('only ever changes its own restaurant', async () => {
        const before = await prisma.restaurant.findUniqueOrThrow({
          where: { id: other.restaurantId },
        });
        await staffPost('/admin/pos/settings', {
          latitude: '1',
          longitude: '1',
          orderRadiusMeters: '999',
        });
        const after = await prisma.restaurant.findUniqueOrThrow({
          where: { id: other.restaurantId },
        });
        expect(after.orderRadiusMeters).toBe(before.orderRadiusMeters);
        expect(Number(after.latitude)).toBe(Number(before.latitude));
        await prisma.restaurant.update({
          where: { id: restaurantId },
          data: {
            latitude: HERE.lat,
            longitude: HERE.lng,
            orderRadiusMeters: 150,
            requireLocationCheck: true,
          },
        });
      });
    });
  });
});
