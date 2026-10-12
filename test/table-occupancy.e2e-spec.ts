import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { RATE_LIMIT_STORE, RateLimitStore } from '../src/common/rate-limit/rate-limit-store';
import { PrismaService } from '../src/prisma/prisma.service';
import { IDLE_MS } from '../src/pos/table-state';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
  TEST_ADMIN_PASSWORD,
} from './utils/test-app';

const HERE = { lat: 31.7767, lng: 35.2345 };
const near = { lat: HERE.lat + 0.0003, lng: HERE.lng, accuracy: 15 };
const far = { lat: HERE.lat + 0.02, lng: HERE.lng, accuracy: 15 };
const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';

describe('Table reservation, bill and checkout (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let limits: RateLimitStore;
  let guest: ReturnType<typeof request.agent>;
  let guestToken = '';
  let owner: ReturnType<typeof request.agent>;
  const ids: string[] = [];

  let restaurantId: string;
  let slug: string;
  let table: { id: string; token: string; label: string };
  let tableB: { id: string; token: string };
  let itemId: string;
  let other: { restaurantId: string; email: string; tableId: string };

  const post = (path: string, body: object) =>
    guest
      .post(path)
      .set('X-CSRF-Token', guestToken)
      .set('Accept', 'application/json')
      .set('Cookie', 'qaemati_locale=en')
      .send(body);
  const occupy = (token = table.token, position: object = near) =>
    post(`/m/${slug}/tables/occupy`, { table: token, ...position });
  const row = (id = table.id) => prisma.restaurantTable.findUniqueOrThrow({ where: { id } });
  const placeOrder = () =>
    post(`/m/${slug}/orders`, {
      table: table.token,
      lines: [{ key: itemId, qty: 2 }],
      ...near,
    });

  async function staffAgent(role: 'CASHIER' | 'KITCHEN') {
    const email = `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@occupancy.example.com`;
    await prisma.adminUser.create({
      data: {
        restaurantId,
        name: role,
        email,
        role,
        passwordHash: await bcrypt.hash(TEST_ADMIN_PASSWORD, 10),
      },
    });
    const agent = request.agent(app.getHttpServer());
    const page = await agent.get('/admin/login');
    await agent
      .post('/admin/login')
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), email, password: TEST_ADMIN_PASSWORD });
    return agent;
  }

  async function adminToken(agent: ReturnType<typeof request.agent>) {
    const page = await agent.get('/admin/pos').set('Cookie', 'qaemati_locale=en');
    return csrfFrom(page.text);
  }

  const checkout = async (agent: ReturnType<typeof request.agent>, id = table.id) => {
    const csrf = await adminToken(agent);
    return agent
      .post(`/admin/pos/tables/${id}/checkout`)
      .set('X-CSRF-Token', csrf)
      .set('Cookie', 'qaemati_locale=en');
  };

  async function reset() {
    await prisma.waiterCall.deleteMany({ where: { restaurantId } });
    await prisma.order.deleteMany({ where: { restaurantId } });
    await prisma.restaurantTable.updateMany({
      where: { restaurantId },
      data: { occupiedAt: null, lastSeenAt: null, billRequestedAt: null },
    });
    for (const key of ['127.0.0.1', '::ffff:127.0.0.1']) {
      for (const prefix of ['order-ip', 'call-ip', 'occupy-ip', 'bill-ip']) {
        await limits.reset(`${prefix}:${key}`);
      }
    }
    for (const t of [table.id, tableB.id]) {
      for (const prefix of ['order-table', 'call-table', 'occupy-table']) {
        await limits.reset(`${prefix}:${t}`);
      }
    }
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    limits = app.get<RateLimitStore>(RATE_LIMIT_STORE);

    const fixture = await createTestRestaurant(prisma, 'occupancy');
    restaurantId = fixture.restaurant.id;
    slug = fixture.restaurant.slug;
    ids.push(restaurantId);
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { latitude: HERE.lat, longitude: HERE.lng, orderRadiusMeters: 150 },
    });
    table = await prisma.restaurantTable.create({ data: { restaurantId, label: '7' } });
    tableB = await prisma.restaurantTable.create({
      data: { restaurantId, label: '8', sortOrder: 1 },
    });
    const category = await prisma.category.create({
      data: { restaurantId, nameAr: 'رئيسية', nameEn: 'Mains' },
    });
    itemId = (
      await prisma.item.create({
        data: {
          restaurantId,
          categoryId: category.id,
          nameAr: 'برجر',
          nameEn: 'Burger',
          price: 10,
          currency: 'ILS',
        },
      })
    ).id;

    const foreign = await createTestRestaurant(prisma, 'occupancy-other');
    ids.push(foreign.restaurant.id);
    const foreignTable = await prisma.restaurantTable.create({
      data: { restaurantId: foreign.restaurant.id, label: 'Z' },
    });
    other = {
      restaurantId: foreign.restaurant.id,
      email: foreign.admin.email,
      tableId: foreignTable.id,
    };

    guest = request.agent(app.getHttpServer());
    guestToken = csrfFrom((await guest.get('/admin/login')).text);
    owner = await loginAsAdmin(app, fixture.admin.email);
  });

  beforeEach(reset);

  afterAll(async () => {
    for (const id of ids) await deleteTestRestaurant(prisma, id);
    await app.close();
  });

  describe('reserving by scanning', () => {
    it('reserves the table for a guest inside the allowed area', async () => {
      const res = await occupy();
      expect(res.status).toBe(200);
      expect((await row()).occupiedAt).not.toBeNull();
    });

    it('does not reserve it for a phone that is too far away', async () => {
      const res = await occupy(table.token, far);
      expect(res.status).toBe(403);
      expect((await row()).occupiedAt).toBeNull();
    });

    it('does not reserve it without a location when the check is on', async () => {
      const res = await occupy(table.token, {});
      expect(res.status).toBe(403);
      expect((await row()).occupiedAt).toBeNull();
    });

    it('ignores a code that is not a table of this restaurant', async () => {
      const foreignToken = (
        await prisma.restaurantTable.findUniqueOrThrow({ where: { id: other.tableId } })
      ).token;
      expect((await occupy(foreignToken)).status).toBe(404);
      expect((await occupy('nope')).status).toBe(404);
    });

    it('keeps the same visit on a second scan', async () => {
      await occupy();
      const first = (await row()).occupiedAt;
      await occupy();
      expect((await row()).occupiedAt).toEqual(first);
    });

    it('is also reserved by an order and by a waiter call', async () => {
      expect((await placeOrder()).status).toBe(201);
      expect((await row()).occupiedAt).not.toBeNull();
      await prisma.restaurantTable.update({ where: { id: tableB.id }, data: {} });
      const call = await post(`/m/${slug}/waiter-calls`, { table: tableB.token, ...near });
      expect(call.status).toBe(201);
      expect((await row(tableB.id)).occupiedAt).not.toBeNull();
    });
  });

  describe('the staff board', () => {
    it('lists every table with its state, and updates when one is reserved', async () => {
      const before = await owner.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(before.text).toContain(`data-table="${table.id}" data-table-state="FREE"`);
      await occupy();
      const after = await owner.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(after.text).toContain(`data-table="${table.id}" data-table-state="OCCUPIED"`);
      expect(after.text).toContain(`data-table="${tableB.id}" data-table-state="FREE"`);
    });

    it('shows how many orders and what they come to', async () => {
      await placeOrder();
      const board = await owner.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(board.text).toContain('1 orders');
      expect(board.text).toContain('20.00');
    });

    it('shows no tables to the kitchen', async () => {
      const kitchen = await staffAgent('KITCHEN');
      await occupy();
      const board = await kitchen.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(board.text).not.toContain('data-table=');
    });

    it('lets a scan with no orders lapse after the idle time', async () => {
      await occupy();
      await prisma.restaurantTable.update({
        where: { id: table.id },
        data: { lastSeenAt: new Date(Date.now() - IDLE_MS - 1000) },
      });
      const board = await owner.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(board.text).toContain(`data-table="${table.id}" data-table-state="FREE"`);
    });

    it('does not let a table with an order lapse', async () => {
      await placeOrder();
      const old = new Date(Date.now() - 5 * IDLE_MS);
      await prisma.restaurantTable.update({
        where: { id: table.id },
        data: { lastSeenAt: old },
      });
      const board = await owner.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(board.text).toContain(`data-table="${table.id}" data-table-state="OCCUPIED"`);
    });
  });

  describe('the bill', () => {
    it('shows what was ordered since the table was reserved', async () => {
      await placeOrder();
      const res = await guest.get(`/m/${slug}/tables/${table.token}/bill`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ occupied: true, billRequested: false, total: '20.00' });
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].items[0]).toMatchObject({ nameEn: 'Burger', quantity: 2 });
    });

    it('leaves out canceled orders', async () => {
      await placeOrder();
      await prisma.order.updateMany({ where: { restaurantId }, data: { status: 'CANCELED' } });
      const res = await guest.get(`/m/${slug}/tables/${table.token}/bill`);
      expect(res.body.orders).toHaveLength(0);
    });

    it('is empty for a free table, and for a table code from another restaurant', async () => {
      const free = await guest.get(`/m/${slug}/tables/${table.token}/bill`);
      expect(free.body).toMatchObject({ occupied: false, orders: [] });
      const foreignToken = (
        await prisma.restaurantTable.findUniqueOrThrow({ where: { id: other.tableId } })
      ).token;
      const wrong = await guest.get(`/m/${slug}/tables/${foreignToken}/bill`);
      expect(wrong.status).toBe(404);
    });

    it('lets the guest ask for the bill once, and alerts the floor', async () => {
      await placeOrder();
      const first = await post(`/m/${slug}/tables/bill-request`, { table: table.token, ...near });
      expect(first.status).toBe(200);
      expect(first.body.alreadyRequested).toBe(false);
      const second = await post(`/m/${slug}/tables/bill-request`, { table: table.token, ...near });
      expect(second.body.alreadyRequested).toBe(true);

      const calls = await prisma.waiterCall.findMany({ where: { restaurantId } });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ kind: 'BILL', status: 'OPEN' });
      const board = await owner.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en');
      expect(board.text).toContain('asked for the bill');
      expect(board.text).toContain(`data-table="${table.id}" data-table-state="BILL"`);
    });

    it('refuses a bill request with nothing ordered, or from far away', async () => {
      await occupy();
      const empty = await post(`/m/${slug}/tables/bill-request`, { table: table.token, ...near });
      expect(empty.status).toBe(409);
      await placeOrder();
      const away = await post(`/m/${slug}/tables/bill-request`, { table: table.token, ...far });
      expect(away.status).toBe(403);
    });
  });

  describe('checkout', () => {
    it('frees the table, closes its calls and empties the guest bill', async () => {
      await placeOrder();
      await post(`/m/${slug}/tables/bill-request`, { table: table.token, ...near });
      const res = await checkout(owner);
      expect(res.status).toBe(200);

      expect(await row()).toMatchObject({
        occupiedAt: null,
        lastSeenAt: null,
        billRequestedAt: null,
      });
      expect(
        await prisma.waiterCall.count({ where: { restaurantId, status: { not: 'RESOLVED' } } }),
      ).toBe(0);
      const bill = await guest.get(`/m/${slug}/tables/${table.token}/bill`);
      expect(bill.body).toMatchObject({ occupied: false, orders: [] });
    });

    it('starts the next party with a clean bill', async () => {
      await placeOrder();
      await checkout(owner);
      await new Promise((resolve) => setTimeout(resolve, 20));
      await occupy();
      const bill = await guest.get(`/m/${slug}/tables/${table.token}/bill`);
      // Scanning alone joins no session, so the old cookie shows an empty bill, not the next party's.
      expect(bill.body).toMatchObject({ occupied: false, total: '0.00' });
      expect(bill.body.orders).toHaveLength(0);
    });

    it('lets a cashier check out but not the kitchen', async () => {
      await occupy();
      const kitchen = await staffAgent('KITCHEN');
      expect((await checkout(kitchen)).status).toBe(403);
      expect((await row()).occupiedAt).not.toBeNull();
      const cashier = await staffAgent('CASHIER');
      expect((await checkout(cashier)).status).toBe(200);
      expect((await row()).occupiedAt).toBeNull();
    });

    it("cannot check out another restaurant's table", async () => {
      await prisma.restaurantTable.update({
        where: { id: other.tableId },
        data: { occupiedAt: new Date() },
      });
      const res = await checkout(owner, other.tableId);
      expect(res.status).toBe(404);
      expect((await row(other.tableId)).occupiedAt).not.toBeNull();
    });
  });
});
