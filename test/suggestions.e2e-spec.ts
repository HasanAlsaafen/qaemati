import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { RATE_LIMIT_STORE, RateLimitStore } from '../src/common/rate-limit/rate-limit-store';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  TEST_ADMIN_PASSWORD,
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';

describe('Dish suggestions (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let limits: RateLimitStore;
  const ids: string[] = [];
  let restaurantId: string;
  let slug: string;
  let ownerEmail: string;
  let cashierEmail: string;
  let dish: Record<string, string> = {};
  let foreign: { id: string; slug: string; itemId: string };
  let seq = 0;

  const suggest = (items: string[] | string = [], target = slug) =>
    request(app.getHttpServer()).get(
      `/m/${target}/suggestions?items=${Array.isArray(items) ? items.join(',') : items}`,
    );
  const idsOf = (res: request.Response) =>
    (res.body.suggestions as { id: string }[]).map((s) => s.id);
  const reasonsOf = (res: request.Response) =>
    (res.body.suggestions as { reason: string }[]).map((s) => s.reason);

  async function item(categoryId: string, name: string, extra: Record<string, unknown> = {}) {
    return (
      await prisma.item.create({
        data: {
          restaurantId,
          categoryId,
          nameAr: name,
          nameEn: name,
          price: 10,
          currency: 'ILS',
          sortOrder: ++seq,
          ...extra,
        },
      })
    ).id;
  }

  async function orderWith(
    itemIds: string[],
    status: 'SERVED' | 'CANCELED' = 'SERVED',
    rid = restaurantId,
  ) {
    return prisma.order.create({
      data: {
        restaurantId: rid,
        tableLabel: '1',
        number: 5000 + ++seq,
        status,
        total: 10,
        currency: 'ILS',
        items: {
          create: itemIds.map((itemId) => ({
            itemId,
            nameAr: 'x',
            nameEn: 'x',
            quantity: 1,
            unitPrice: 5,
            lineTotal: 5,
          })),
        },
      },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    limits = app.get<RateLimitStore>(RATE_LIMIT_STORE);
    const fixture = await createTestRestaurant(prisma, 'suggest');
    restaurantId = fixture.restaurant.id;
    slug = fixture.restaurant.slug;
    ownerEmail = fixture.admin.email;
    ids.push(restaurantId);
    cashierEmail = `cashier-sg-${Date.now().toString(36)}@x.example.com`;
    await prisma.adminUser.create({
      data: {
        restaurantId,
        email: cashierEmail,
        name: 'C',
        role: 'CASHIER',
        passwordHash: await bcrypt.hash(TEST_ADMIN_PASSWORD, 4),
      },
    });

    const mains = (
      await prisma.category.create({
        data: { restaurantId, nameAr: 'رئيسية', nameEn: 'Mains', sortOrder: 0 },
      })
    ).id;
    const drinks = (
      await prisma.category.create({
        data: { restaurantId, nameAr: 'مشروبات', nameEn: 'Drinks', sortOrder: 1 },
      })
    ).id;
    const sweets = (
      await prisma.category.create({
        data: { restaurantId, nameAr: 'حلويات', nameEn: 'Sweets', sortOrder: 2 },
      })
    ).id;
    const late = (
      await prisma.category.create({
        data: {
          restaurantId,
          nameAr: 'متأخر',
          nameEn: 'Late',
          sortOrder: 3,
          availableFrom: '00:00',
          availableTo: '00:01',
        },
      })
    ).id;
    dish = {
      burger: await item(mains, 'Burger'),
      fries: await item(mains, 'Fries'),
      cola: await item(drinks, 'Cola'),
      shake: await item(drinks, 'Shake', { tags: ['POPULAR'] }),
      cake: await item(sweets, 'Cake'),
      hidden: await item(mains, 'Hidden', { available: false }),
      midnight: await item(late, 'Midnight snack'),
    };
    const other = await createTestRestaurant(prisma, 'suggest-other');
    ids.push(other.restaurant.id);
    const otherCategory = await prisma.category.create({
      data: { restaurantId: other.restaurant.id, nameAr: 'ا', nameEn: 'Other' },
    });
    const otherItem = await prisma.item.create({
      data: {
        restaurantId: other.restaurant.id,
        categoryId: otherCategory.id,
        nameAr: 'سر',
        nameEn: 'Secret',
        price: 1,
        currency: 'ILS',
        tags: ['POPULAR'],
      },
    });
    foreign = { id: other.restaurant.id, slug: other.restaurant.slug, itemId: otherItem.id };
  });

  beforeEach(async () => {
    for (const ip of ['127.0.0.1', '::ffff:127.0.0.1', '::1']) {
      await limits.reset(`suggest-ip:${ip}`);
      await limits.reset(`suggest-add-ip:${ip}`);
    }
    await prisma.order.deleteMany({ where: { restaurantId } });
    await prisma.itemPairing.deleteMany({ where: { restaurantId } });
    await prisma.suggestionAdd.deleteMany({ where: { restaurantId } });
  });

  afterAll(async () => {
    for (const id of ids) await deleteTestRestaurant(prisma, id);
    await app.close();
  });

  describe('with nothing to go on', () => {
    it('offers popular dishes from other parts of the menu, one per category first, as popular', async () => {
      const res = await suggest([dish.burger]);
      expect(res.status).toBe(200);
      expect(reasonsOf(res)).toEqual(['popular', 'popular', 'popular']);
      expect(idsOf(res)).toEqual([dish.shake, dish.cake, dish.fries]);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('never offers a dish already chosen, one switched off, or one outside its serving hours', async () => {
      const res = await suggest([dish.burger, dish.fries, dish.cola, dish.shake, dish.cake]);
      expect(idsOf(res)).toEqual([]);
      const wide = await suggest([]);
      for (const hidden of [dish.hidden, dish.midnight]) expect(idsOf(wide)).not.toContain(hidden);
    });

    it("never offers another restaurant's dish, and ignores a foreign dish in the selection", async () => {
      const plain = await suggest([dish.burger]);
      expect(idsOf(plain)).not.toContain(foreign.itemId);
      const steered = await suggest([foreign.itemId, dish.burger]);
      expect(idsOf(steered)).toEqual(idsOf(plain));
      expect(idsOf(await suggest([foreign.itemId]))).not.toContain(foreign.itemId);
    });
  });

  describe("the owner's picks", () => {
    it('come first, in the owner order, whatever else is popular', async () => {
      await prisma.itemPairing.createMany({
        data: [
          { restaurantId, itemId: dish.burger, pairedItemId: dish.cola, sortOrder: 0 },
          { restaurantId, itemId: dish.burger, pairedItemId: dish.cake, sortOrder: 1 },
        ],
      });
      const res = await suggest([dish.burger]);
      expect(idsOf(res).slice(0, 2)).toEqual([dish.cola, dish.cake]);
      expect(reasonsOf(res).slice(0, 2)).toEqual(['pairing', 'pairing']);
      expect(reasonsOf(res)[2]).toBe('popular');
    });

    it('are skipped when the dish is switched off or already chosen', async () => {
      await prisma.itemPairing.createMany({
        data: [
          { restaurantId, itemId: dish.burger, pairedItemId: dish.hidden, sortOrder: 0 },
          { restaurantId, itemId: dish.burger, pairedItemId: dish.cola, sortOrder: 1 },
        ],
      });
      const res = await suggest([dish.burger, dish.cola]);
      expect(idsOf(res)).not.toContain(dish.hidden);
      expect(idsOf(res)).not.toContain(dish.cola);
    });

    it('only apply to the dishes in the selection', async () => {
      await prisma.itemPairing.create({
        data: { restaurantId, itemId: dish.burger, pairedItemId: dish.cola, sortOrder: 0 },
      });
      const res = await suggest([dish.fries]);
      expect(reasonsOf(res)).not.toContain('pairing');
    });
  });

  describe('what orders show', () => {
    it('offers dishes ordered together at least three times, after the owner picks', async () => {
      for (let i = 0; i < 3; i++) await orderWith([dish.burger, dish.fries]);
      await orderWith([dish.burger, dish.cake]);
      const res = await suggest([dish.burger]);
      expect(idsOf(res)[0]).toBe(dish.fries);
      expect(reasonsOf(res)[0]).toBe('together');
      expect(reasonsOf(res).filter((r) => r === 'together')).toHaveLength(1);
    });

    it('does not call two orders a pattern', async () => {
      for (let i = 0; i < 2; i++) await orderWith([dish.burger, dish.fries]);
      expect(reasonsOf(await suggest([dish.burger]))).not.toContain('together');
    });

    it('ignores canceled orders and other restaurants', async () => {
      for (let i = 0; i < 5; i++) await orderWith([dish.burger, dish.fries], 'CANCELED');
      const category = await prisma.category.findFirstOrThrow({
        where: { restaurantId: foreign.id },
      });
      for (let i = 0; i < 5; i++)
        await orderWith([foreign.itemId, dish.burger], 'SERVED', foreign.id);
      const res = await suggest([dish.burger]);
      expect(reasonsOf(res)).not.toContain('together');
      expect(idsOf(res)).not.toContain(foreign.itemId);
      expect(category).toBeDefined();
    });

    it('lets the owner picks outrank the orders', async () => {
      for (let i = 0; i < 4; i++) await orderWith([dish.burger, dish.fries]);
      await prisma.itemPairing.create({
        data: { restaurantId, itemId: dish.burger, pairedItemId: dish.cake, sortOrder: 0 },
      });
      expect(idsOf(await suggest([dish.burger])).slice(0, 2)).toEqual([dish.cake, dish.fries]);
    });
  });

  describe('what the guest sends', () => {
    it('reads the dish out of a key with a size and extras', async () => {
      const res = await suggest([`${dish.burger}:someVariant:extraA,extraB`]);
      expect(idsOf(res)).not.toContain(dish.burger);
    });

    it.each([['nonsense'], ['a:b:c:d:e'], ['../etc/passwd'], [''], ['x'.repeat(500)], ['%00']])(
      'ignores %p',
      async (junk) => {
        const res = await suggest(junk);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.suggestions)).toBe(true);
      },
    );

    it('survives an enormous selection', async () => {
      const many = Array.from({ length: 500 }, (_, i) => `item${i}`);
      expect((await suggest(many)).status).toBe(200);
    });

    it('answers an empty list for an unknown restaurant', async () => {
      const res = await suggest([dish.burger], 'no-such-restaurant');
      expect(res.status).toBe(200);
      expect(res.body.suggestions).toEqual([]);
    });

    it('is limited per device', async () => {
      let last = 0;
      for (let i = 0; i < 125; i++) last = idsOf(await suggest([dish.burger])).length;
      expect(last).toBe(0);
    });

    it('is switched off with the menu when the subscription is over', async () => {
      const plan = await prisma.plan.create({
        data: {
          nameAr: 'خ',
          nameEn: `Sg ${Date.now()}`,
          priceAmount: 1,
          currency: 'ILS',
          features: [],
        },
      });
      await prisma.subscription.create({
        data: { restaurantId, planId: plan.id, status: 'SUSPENDED' },
      });
      try {
        expect((await suggest([dish.burger])).body.suggestions).toEqual([]);
      } finally {
        await prisma.subscription.delete({ where: { restaurantId } });
        await prisma.plan.delete({ where: { id: plan.id } });
      }
    });
  });

  describe('counting what guests add', () => {
    const added = (itemId: string, reason = 'pairing', target = slug) =>
      request(app.getHttpServer()).get(`/m/${target}/suggestions/${itemId}/added?reason=${reason}`);

    it('counts a tap with its reason and nothing about the guest', async () => {
      const res = await added(dish.cola, 'together');
      expect(res.status).toBe(204);
      const rows = await prisma.suggestionAdd.findMany({ where: { restaurantId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ itemId: dish.cola, reason: 'together' });
      expect(Object.keys(rows[0]).sort()).toEqual([
        'createdAt',
        'id',
        'itemId',
        'reason',
        'restaurantId',
      ]);
    });

    it('ignores an unknown reason, a dish of another restaurant, and a dish through the wrong address', async () => {
      await added(dish.cola, 'because');
      await added(foreign.itemId, 'pairing');
      await added(dish.cola, 'pairing', foreign.slug);
      await added('nope');
      expect(await prisma.suggestionAdd.count({ where: { restaurantId } })).toBe(0);
      expect(await prisma.suggestionAdd.count({ where: { restaurantId: foreign.id } })).toBe(0);
    });

    it('is limited per device', async () => {
      for (let i = 0; i < 205; i++) await added(dish.cola, 'popular');
      expect(await prisma.suggestionAdd.count({ where: { restaurantId } })).toBe(200);
    });
  });

  describe("the owner's picker", () => {
    let owner: ReturnType<typeof request.agent>;
    let token: string;
    const post = (item: string, body: object) =>
      owner
        .post(`/admin/items/${item}/pairings`)
        .set('X-CSRF-Token', token)
        .set('Cookie', 'qaemati_locale=en')
        .type('form')
        .send(body);

    beforeAll(async () => {
      owner = await loginAsAdmin(app, ownerEmail);
      token = csrfFrom((await owner.get('/admin')).text);
    });

    it('lists every other dish of the restaurant in menu order, and none of anyone else', async () => {
      const res = await owner
        .get(`/admin/items/${dish.burger}/pairings`)
        .set('Cookie', 'qaemati_locale=en');
      expect(res.status).toBe(200);
      for (const id of [dish.fries, dish.cola, dish.shake, dish.cake, dish.hidden])
        expect(res.text).toContain(`value="${id}"`);
      expect(res.text).not.toContain(`value="${dish.burger}"`);
      expect(res.text).not.toContain(foreign.itemId);
      expect(res.text.indexOf(dish.fries)).toBeLessThan(res.text.indexOf(dish.cola));
    });

    it('saves a choice and shows it ticked next time', async () => {
      const res = await post(dish.burger, { pairings: [dish.cola, dish.cake] });
      expect(res.status).toBe(200);
      expect(res.headers['hx-trigger']).toContain('toast');
      const saved = await prisma.itemPairing.findMany({
        where: { itemId: dish.burger },
        orderBy: { sortOrder: 'asc' },
      });
      expect(saved.map((p) => p.pairedItemId).sort()).toEqual([dish.cola, dish.cake].sort());
      const again = await owner.get(`/admin/items/${dish.burger}/pairings`);
      expect(again.text).toMatch(new RegExp(`value="${dish.cola}"[^>]*`));
      expect(again.text).toContain('picked: [&quot;');
    });

    it('replaces the old choice, and clears it when nothing is ticked', async () => {
      await post(dish.burger, { pairings: [dish.cola] });
      await post(dish.burger, { pairings: [dish.cake] });
      expect(
        (await prisma.itemPairing.findMany({ where: { itemId: dish.burger } })).map(
          (p) => p.pairedItemId,
        ),
      ).toEqual([dish.cake]);
      await post(dish.burger, {});
      expect(await prisma.itemPairing.count({ where: { itemId: dish.burger } })).toBe(0);
    });

    it('drops itself, a dish of another restaurant and junk instead of trusting them', async () => {
      await post(dish.burger, { pairings: [dish.burger, dish.cola, foreign.itemId, 'junk'] });
      expect(
        (await prisma.itemPairing.findMany({ where: { itemId: dish.burger } })).map(
          (p) => p.pairedItemId,
        ),
      ).toEqual([dish.cola]);
    });

    it('keeps one of a dish ticked twice', async () => {
      await post(dish.burger, { pairings: [dish.cola, dish.cola] });
      expect(await prisma.itemPairing.count({ where: { itemId: dish.burger } })).toBe(1);
    });

    it('allows four and refuses a fifth', async () => {
      const four = [dish.fries, dish.cola, dish.shake, dish.cake];
      expect((await post(dish.burger, { pairings: four })).status).toBe(200);
      const five = await post(dish.burger, { pairings: [...four, dish.hidden] });
      expect(five.status).toBe(422);
      expect(await prisma.itemPairing.count({ where: { itemId: dish.burger } })).toBe(4);
    });

    it("cannot read or change another restaurant's dish", async () => {
      expect((await owner.get(`/admin/items/${foreign.itemId}/pairings`)).status).toBe(404);
      expect((await post(foreign.itemId, { pairings: [dish.cola] })).status).toBe(404);
      expect(await prisma.itemPairing.count({ where: { restaurantId: foreign.id } })).toBe(0);
    });

    it('is closed to cashier and kitchen accounts', async () => {
      const staff = await loginAsAdmin(app, cashierEmail);
      const res = await staff.get(`/admin/items/${dish.burger}/pairings`);
      expect([res.status, res.headers.location]).toEqual([302, '/admin/pos']);
    });

    it('needs the CSRF token, and a signed in owner to read', async () => {
      expect(
        (
          await request(app.getHttpServer())
            .post(`/admin/items/${dish.burger}/pairings`)
            .type('form')
            .send({})
        ).status,
      ).toBe(403);
      expect(
        (await owner.post(`/admin/items/${dish.burger}/pairings`).type('form').send({})).status,
      ).toBe(403);
      const unauthenticated = await request(app.getHttpServer()).get(
        `/admin/items/${dish.burger}/pairings`,
      );
      expect([unauthenticated.status, unauthenticated.headers.location]).toEqual([
        302,
        expect.stringContaining('/admin/login'),
      ]);
    });

    it('appears as a panel on each dish in the admin, in both languages', async () => {
      const en = await owner.get('/admin').set('Cookie', 'qaemati_locale=en');
      expect(en.text).toContain(`hx-get="/admin/items/${dish.burger}/pairings"`);
      expect(en.text).toContain('Goes well with');
      expect((await owner.get('/admin').set('Cookie', 'qaemati_locale=ar')).text).toContain(
        'يناسبه',
      );
    });

    it("removes a dish photo, only for the owner's own dish", async () => {
      await prisma.item.update({
        where: { id: dish.cake },
        data: { imagePath: '/uploads/items/x.jpg' },
      });
      const res = await owner
        .delete(`/admin/items/${dish.cake}/image`)
        .set('X-CSRF-Token', token)
        .set('Cookie', 'qaemati_locale=en');
      expect(res.status).toBe(200);
      expect(
        (await prisma.item.findUniqueOrThrow({ where: { id: dish.cake } })).imagePath,
      ).toBeNull();
      const foreignRes = await owner
        .delete(`/admin/items/${foreign.itemId}/image`)
        .set('X-CSRF-Token', token);
      expect([403, 404]).toContain(foreignRes.status);
    });

    it('is removed with the dish', async () => {
      const temp = await item(
        (await prisma.category.findFirstOrThrow({ where: { restaurantId, nameEn: 'Mains' } })).id,
        'Temp',
      );
      await post(dish.burger, { pairings: [temp] });
      await prisma.item.delete({ where: { id: temp } });
      expect(await prisma.itemPairing.count({ where: { pairedItemId: temp } })).toBe(0);
    });
  });
});
