import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { RATE_LIMIT_STORE, RateLimitStore } from '../src/common/rate-limit/rate-limit-store';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  TEST_ADMIN_PASSWORD,
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
} from './utils/test-app';

const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';
const HERE = { lat: 31.7767, lng: 35.2345 };

describe('Owner, cashier and kitchen accounts (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: MailService;
  let base: string;
  const ids: string[] = [];

  let restaurantId: string;
  let slug: string;
  let owner: { id: string; email: string };
  let cashier: { id: string; email: string };
  let kitchen: { id: string; email: string };
  let tableToken: string;
  let itemId: string;
  let other: { id: string; ownerEmail: string; memberId: string };

  const hash = () => bcrypt.hash(TEST_ADMIN_PASSWORD, 10);

  async function member(rid: string, name: string, role: 'OWNER' | 'CASHIER' | 'KITCHEN') {
    const email = `${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@roles.example.com`;
    const row = await prisma.adminUser.create({
      data: { restaurantId: rid, name, email, role, passwordHash: await hash() },
    });
    return { id: row.id, email };
  }

  /** Signs in through the real form and returns an agent plus where the sign in sent it. */
  async function signIn(email: string, redirect = '/admin') {
    const agent = request.agent(app.getHttpServer());
    const page = await agent.get('/admin/login');
    const res = await agent
      .post('/admin/login')
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), email, password: TEST_ADMIN_PASSWORD, redirect });
    expect(res.status).toBe(302);
    return { agent, landing: res.headers.location as string };
  }

  async function tokenFor(agent: ReturnType<typeof request.agent>) {
    return csrfFrom((await agent.get('/admin/pos').set('Cookie', 'qaemati_locale=en')).text) || '';
  }

  /** A fresh order and a fresh call at the table, straight into the database. */
  async function seedOrder(status: 'NEW' | 'PREPARING' | 'READY' = 'NEW') {
    const count = await prisma.order.count({ where: { restaurantId } });
    return prisma.order.create({
      data: {
        restaurantId,
        tableLabel: '4',
        number: 1000 + count + Math.floor(Math.random() * 100000),
        status,
        note: 'No salt',
        total: 17.5,
        currency: 'ILS',
        items: {
          create: [
            {
              itemId,
              nameAr: 'طبق',
              nameEn: 'Dish',
              quantity: 2,
              unitPrice: 8.75,
              lineTotal: 17.5,
            },
          ],
        },
      },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    mail = app.get(MailService);

    const fixture = await createTestRestaurant(prisma, 'roles');
    restaurantId = fixture.restaurant.id;
    slug = fixture.restaurant.slug;
    ids.push(restaurantId);
    owner = { id: fixture.admin.id, email: fixture.admin.email };
    cashier = await member(restaurantId, 'cashier', 'CASHIER');
    kitchen = await member(restaurantId, 'kitchen', 'KITCHEN');
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { latitude: HERE.lat, longitude: HERE.lng },
    });
    const table = await prisma.restaurantTable.create({ data: { restaurantId, label: '4' } });
    tableToken = table.token;
    const category = await prisma.category.create({
      data: { restaurantId, nameAr: 'ق', nameEn: 'Cat' },
    });
    itemId = (
      await prisma.item.create({
        data: {
          restaurantId,
          categoryId: category.id,
          nameAr: 'طبق',
          nameEn: 'Dish',
          price: 8.75,
          currency: 'ILS',
        },
      })
    ).id;

    const o = await createTestRestaurant(prisma, 'roles-other');
    ids.push(o.restaurant.id);
    const m = await member(o.restaurant.id, 'foreign-cashier', 'CASHIER');
    other = { id: o.restaurant.id, ownerEmail: o.admin.email, memberId: m.id };
  });

  afterAll(async () => {
    for (const id of ids) await deleteTestRestaurant(prisma, id);
    await app.close();
  });

  describe('signing in', () => {
    it('sends an owner to the dashboard and cashier and kitchen accounts to the orders screen', async () => {
      expect((await signIn(owner.email)).landing).toBe('/admin');
      expect((await signIn(cashier.email)).landing).toBe('/admin/pos');
      expect((await signIn(kitchen.email)).landing).toBe('/admin/pos');
    });

    it('does not let a cashier land on an owner page by asking for it', async () => {
      expect((await signIn(cashier.email, '/admin/billing')).landing).toBe('/admin/pos');
      expect((await signIn(kitchen.email, '/admin/team')).landing).toBe('/admin/pos');
    });

    it('treats a restaurant account created before roles existed as an owner', async () => {
      const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: owner.id } });
      expect(row.role).toBe('OWNER');
    });
  });

  describe('what each account can open', () => {
    const ownerPages = [
      '/admin',
      '/admin/branding',
      '/admin/billing',
      '/admin/qr',
      '/admin/qr/print',
      '/admin/analytics',
      '/admin/bulk',
      '/admin/team',
    ];

    it.each(['cashier', 'kitchen'] as const)(
      'keeps the %s account to the orders screen',
      async (who) => {
        const { agent } = await signIn((who === 'cashier' ? cashier : kitchen).email);
        for (const path of ownerPages) {
          const res = await agent.get(path);
          expect([path, res.status, res.headers.location]).toEqual([path, 302, '/admin/pos']);
        }
        expect((await agent.get('/admin/pos')).status).toBe(200);
        expect((await agent.get('/admin/pos/board')).status).toBe(200);
      },
    );

    it('refuses staff the writes that belong to owners, even with a valid token', async () => {
      const { agent } = await signIn(cashier.email);
      const token = await tokenFor(agent);
      for (const [path, body] of [
        ['/admin/team', { name: 'x', email: 'x@y.example.com', role: 'OWNER' }],
        ['/admin/categories', { nameAr: 'ق', nameEn: 'x' }],
        ['/admin/branding', { name: 'x' }],
      ] as const) {
        const res = await agent.post(path).set('X-CSRF-Token', token).type('form').send(body);
        expect([path, res.status]).toEqual([path, 403]);
      }
      expect(await prisma.adminUser.count({ where: { email: 'x@y.example.com' } })).toBe(0);
    });

    it('lets owners open all of it', async () => {
      const { agent } = await signIn(owner.email);
      for (const path of ownerPages)
        expect([path, (await agent.get(path)).status]).toEqual([path, 200]);
    });

    it('shows staff only the orders link, and an owner the team link', async () => {
      const staff = (await signIn(kitchen.email)).agent;
      const html = (await staff.get('/admin/pos').set('Cookie', 'qaemati_locale=en')).text;
      expect(html).toContain('href="/admin/pos"');
      for (const href of [
        '/admin/branding',
        '/admin/billing',
        '/admin/team',
        '/admin/qr',
        '/admin/analytics',
      ]) {
        expect(html).not.toContain(`href="${href}"`);
      }
      expect(html).not.toContain('Preview menu');
      const boss = (await signIn(owner.email)).agent;
      expect((await boss.get('/admin').set('Cookie', 'qaemati_locale=en')).text).toContain(
        'href="/admin/team"',
      );
    });

    it('shows no first-login tour to staff', async () => {
      const { agent } = await signIn(cashier.email);
      expect((await agent.get('/admin/pos')).text).not.toContain('tour-title');
    });
  });

  describe('the orders screen for each role', () => {
    it('hides prices and waiter calls from the kitchen, and shows what to cook', async () => {
      await seedOrder('NEW');
      await prisma.waiterCall.create({ data: { restaurantId, tableLabel: '4' } });
      const { agent } = await signIn(kitchen.email);
      const html = (await agent.get('/admin/pos').set('Cookie', 'qaemati_locale=en')).text;
      expect(html).toContain('Dish');
      expect(html).toContain('No salt');
      expect(html).not.toContain('17.50');
      expect(html).not.toContain('is calling');
      expect(html).not.toContain('Cancel order');
      expect(html).not.toContain('Location check');
      expect(html).toContain('Start preparing');
      expect(html).toContain('data-open-calls="0"');
    });

    it('gives the kitchen no button for the step after ready', async () => {
      await prisma.order.deleteMany({ where: { restaurantId } });
      await seedOrder('READY');
      const { agent } = await signIn(kitchen.email);
      const html = (await agent.get('/admin/pos/board').set('Cookie', 'qaemati_locale=en')).text;
      expect(html).not.toContain('Mark served');
      expect(html).not.toContain('Mark ready');
    });

    it('shows a cashier prices, calls and every step, but not the location settings', async () => {
      await prisma.order.deleteMany({ where: { restaurantId } });
      await prisma.waiterCall.deleteMany({ where: { restaurantId } });
      await seedOrder('READY');
      await prisma.waiterCall.create({ data: { restaurantId, tableLabel: '4' } });
      const { agent } = await signIn(cashier.email);
      const html = (await agent.get('/admin/pos').set('Cookie', 'qaemati_locale=en')).text;
      expect(html).toContain('17.50');
      expect(html).toContain('Table 4 is calling');
      expect(html).toContain('Mark served');
      expect(html).toContain('Cancel order');
      expect(html).not.toContain('Location check');
    });

    it('shows an owner the location settings too', async () => {
      const { agent } = await signIn(owner.email);
      expect((await agent.get('/admin/pos').set('Cookie', 'qaemati_locale=en')).text).toContain(
        'Location check',
      );
    });
  });

  describe('what each role may change, enforced on the server', () => {
    async function post(email: string, path: string, body: object = {}) {
      const { agent } = await signIn(email);
      const token = await tokenFor(agent);
      return agent.post(path).set('X-CSRF-Token', token).type('form').send(body);
    }

    it('lets the kitchen start and finish a dish and nothing else', async () => {
      await prisma.order.deleteMany({ where: { restaurantId } });
      const order = await seedOrder('NEW');
      expect(
        (await post(kitchen.email, `/admin/pos/orders/${order.id}/status`, { status: 'PREPARING' }))
          .status,
      ).toBe(200);
      expect(
        (await post(kitchen.email, `/admin/pos/orders/${order.id}/status`, { status: 'READY' }))
          .status,
      ).toBe(200);
      expect(
        (await post(kitchen.email, `/admin/pos/orders/${order.id}/status`, { status: 'SERVED' }))
          .status,
      ).toBe(403);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
        'READY',
      );
      const other2 = await seedOrder('NEW');
      expect(
        (await post(kitchen.email, `/admin/pos/orders/${other2.id}/status`, { status: 'CANCELED' }))
          .status,
      ).toBe(403);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: other2.id } })).status).toBe(
        'NEW',
      );
    });

    it('keeps the kitchen away from waiter calls and the settings', async () => {
      const call = await prisma.waiterCall.create({ data: { restaurantId, tableLabel: '4' } });
      expect((await post(kitchen.email, `/admin/pos/calls/${call.id}/acknowledge`)).status).toBe(
        403,
      );
      expect((await post(kitchen.email, `/admin/pos/calls/${call.id}/resolve`)).status).toBe(403);
      expect((await prisma.waiterCall.findUniqueOrThrow({ where: { id: call.id } })).status).toBe(
        'OPEN',
      );
      const settings = { latitude: '1', longitude: '1', orderRadiusMeters: '999' };
      expect((await post(kitchen.email, '/admin/pos/settings', settings)).status).toBe(403);
      expect((await post(cashier.email, '/admin/pos/settings', settings)).status).toBe(403);
      expect(
        Number(
          (await prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId } })).latitude,
        ),
      ).toBe(HERE.lat);
    });

    it('lets a cashier take an order all the way, cancel, and answer calls', async () => {
      const order = await seedOrder('NEW');
      for (const status of ['PREPARING', 'READY', 'SERVED']) {
        expect(
          (await post(cashier.email, `/admin/pos/orders/${order.id}/status`, { status })).status,
        ).toBe(200);
      }
      const second = await seedOrder('NEW');
      expect(
        (await post(cashier.email, `/admin/pos/orders/${second.id}/status`, { status: 'CANCELED' }))
          .status,
      ).toBe(200);
      const call = await prisma.waiterCall.create({ data: { restaurantId, tableLabel: '4' } });
      expect((await post(cashier.email, `/admin/pos/calls/${call.id}/acknowledge`)).status).toBe(
        200,
      );
      expect((await post(cashier.email, `/admin/pos/calls/${call.id}/resolve`)).status).toBe(200);
    });

    it('lets an owner change the settings', async () => {
      const res = await post(owner.email, '/admin/pos/settings', {
        latitude: String(HERE.lat),
        longitude: String(HERE.lng),
        orderRadiusMeters: '150',
        requireLocationCheck: 'on',
      });
      expect(res.status).toBe(204);
    });
  });

  describe('the live screen', () => {
    const cookiesOf = (res: Response): string[] =>
      res.headers.getSetCookie().map((c) => c.split(';')[0]);
    const merge = (...lists: string[][]) => {
      const m = new Map<string, string>();
      for (const l of lists) for (const c of l) m.set(c.split('=')[0], c);
      return [...m.values()].join('; ');
    };
    async function cookieFor(email: string): Promise<string> {
      const page = await fetch(`${base}/admin/login`);
      const jar = cookiesOf(page);
      const res = await fetch(`${base}/admin/login`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.join('; ') },
        body: new URLSearchParams({
          csrf_token: csrfFrom(await page.text()),
          email,
          password: TEST_ADMIN_PASSWORD,
        }),
      });
      return merge(jar, cookiesOf(res));
    }
    const sockets: Socket[] = [];
    const open = async (email: string) => {
      const socket = io(`${base}/pos`, {
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: { Cookie: await cookieFor(email) },
      });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });
      return socket;
    };
    const heard = (socket: Socket, event: string, ms = 700) =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), ms);
        socket.once(event, () => {
          clearTimeout(timer);
          resolve(true);
        });
      });
    afterEach(() => {
      while (sockets.length) sockets.pop()!.disconnect();
    });

    async function guestCall() {
      const limits = app.get<RateLimitStore>(RATE_LIMIT_STORE);
      await limits.reset(`call-ip:127.0.0.1`);
      await limits.reset(`call-ip:::ffff:127.0.0.1`);
      const t = await prisma.restaurantTable.findFirstOrThrow({ where: { token: tableToken } });
      await limits.reset(`call-table:${t.id}`);
      await prisma.waiterCall.deleteMany({ where: { restaurantId } });
      const page = await fetch(`${base}/admin/login`);
      const res = await fetch(`${base}/m/${slug}/waiter-calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfFrom(await page.text()),
          Cookie: cookiesOf(page).join('; '),
        },
        body: JSON.stringify({ table: tableToken, ...HERE, accuracy: 10 }),
      });
      expect(res.status).toBe(201);
    }

    it('tells the floor about a waiter call and keeps the kitchen out of it', async () => {
      const floor = await open(cashier.email);
      const cooks = await open(kitchen.email);
      const floorHears = heard(floor, 'call.new');
      const kitchenHears = heard(cooks, 'call.new');
      await guestCall();
      expect(await floorHears).toBe(true);
      expect(await kitchenHears).toBe(false);
    });
  });

  describe('the team page', () => {
    let ownerAgent: ReturnType<typeof request.agent>;
    let token: string;
    const as = (path: string, body: object = {}) =>
      ownerAgent
        .post(path)
        .set('X-CSRF-Token', token)
        .set('Cookie', 'qaemati_locale=en')
        .type('form')
        .send(body);
    const fresh = () =>
      `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@roles.example.com`;

    async function relogin() {
      ownerAgent = (await signIn(owner.email)).agent;
      token = csrfFrom((await ownerAgent.get('/admin/team')).text);
    }

    beforeAll(relogin);

    it('lists everyone with their role, and who you are', async () => {
      const res = await ownerAgent.get('/admin/team').set('Cookie', 'qaemati_locale=en');
      expect(res.text).toContain(cashier.email);
      expect(res.text).toContain(kitchen.email);
      expect(res.text).toContain('(you)');
      expect(res.text).not.toContain('foreign-cashier');
    });

    it('adds a cashier with a password shown once, an invitation, and a working sign in', async () => {
      mail.outbox.length = 0;
      const email = fresh();
      const res = await as('/admin/team', { name: 'Dana', email, role: 'CASHIER' });
      expect(res.status).toBe(200);
      const password = /data-secret>([^<]+)</.exec(res.text)?.[1] ?? '';
      expect(password).toHaveLength(12);
      expect(mail.outbox.some((m) => m.to === email)).toBe(true);
      const row = await prisma.adminUser.findUniqueOrThrow({ where: { email } });
      expect(row).toMatchObject({ role: 'CASHIER', restaurantId, name: 'Dana' });
      expect(row.passwordHash).not.toContain(password);
      const again = await ownerAgent.get('/admin/team');
      expect(again.text).not.toContain(password);

      const agent = request.agent(app.getHttpServer());
      const page = await agent.get('/admin/login');
      const login = await agent
        .post('/admin/login')
        .type('form')
        .send({ csrf_token: csrfFrom(page.text), email, password });
      expect(login.headers.location).toBe('/admin/pos');
    });

    it.each([
      ['a missing name', { name: '', email: 'a@b.example.com', role: 'CASHIER' }, 'name'],
      ['an invalid email', { name: 'x', email: 'nope', role: 'CASHIER' }, 'email'],
      ['an unknown role', { name: 'x', email: 'a@b.example.com', role: 'ADMIN' }, 'role'],
    ])('refuses %s with a message on that field', async (_label, body, field) => {
      const res = await as('/admin/team', body);
      expect(res.status).toBe(422);
      expect(Object.keys(res.body.errors)).toContain(field);
    });

    it('refuses an email that already has an account, anywhere', async () => {
      const res = await as('/admin/team', { name: 'x', email: other.ownerEmail, role: 'KITCHEN' });
      expect(res.status).toBe(422);
      expect(res.body.errors.email).toBeDefined();
    });

    it('stops at the plan limit for team accounts', async () => {
      const plan = await prisma.plan.create({
        data: {
          nameAr: 'خ',
          nameEn: `Team ${Date.now()}`,
          priceAmount: 1,
          currency: 'ILS',
          maxAdminUsers: 1,
          features: ['tableOrdering'],
        },
      });
      await prisma.subscription.create({
        data: { restaurantId, planId: plan.id, status: 'ACTIVE' },
      });
      try {
        const res = await as('/admin/team', { name: 'x', email: fresh(), role: 'KITCHEN' });
        expect(res.status).toBe(402);
      } finally {
        await prisma.subscription.delete({ where: { restaurantId } });
        await prisma.plan.delete({ where: { id: plan.id } });
      }
    });

    it('changes a role, and signs that person out so the new role applies', async () => {
      const target = await member(restaurantId, 'promote', 'CASHIER');
      const session = (await signIn(target.email)).agent;
      expect((await session.get('/admin/pos')).status).toBe(200);
      expect((await as(`/admin/team/${target.id}/role`, { role: 'KITCHEN' })).status).toBe(200);
      expect((await prisma.adminUser.findUniqueOrThrow({ where: { id: target.id } })).role).toBe(
        'KITCHEN',
      );
      const after = await session.get('/admin/pos');
      expect(after.status).toBe(302);
      expect(after.headers.location).toContain('/admin/login');
    });

    it('does not let you change your own role or remove your own account', async () => {
      expect((await as(`/admin/team/${owner.id}/role`, { role: 'KITCHEN' })).status).toBe(409);
      expect((await as(`/admin/team/${owner.id}/remove`)).status).toBe(409);
      expect((await prisma.adminUser.findUniqueOrThrow({ where: { id: owner.id } })).role).toBe(
        'OWNER',
      );
    });

    it('always keeps one owner', async () => {
      const second = await member(restaurantId, 'second-owner', 'OWNER');
      const secondAgent = (await signIn(second.email)).agent;
      const secondToken = csrfFrom((await secondAgent.get('/admin/team')).text);
      // The second owner may remove the first (not themselves) only while they remain an owner.
      const demote = await secondAgent
        .post(`/admin/team/${owner.id}/role`)
        .set('X-CSRF-Token', secondToken)
        .type('form')
        .send({ role: 'CASHIER' });
      expect(demote.status).toBe(200);
      const back = await secondAgent
        .post(`/admin/team/${second.id}/remove`)
        .set('X-CSRF-Token', secondToken)
        .type('form');
      expect(back.status).toBe(409);
      await prisma.adminUser.update({ where: { id: owner.id }, data: { role: 'OWNER' } });
      await prisma.adminUser.delete({ where: { id: second.id } });
    });

    it('resets a password: the old one stops, the new one works, the person is signed out', async () => {
      await relogin();
      mail.outbox.length = 0;
      const target = await member(restaurantId, 'resetme', 'KITCHEN');
      const session = (await signIn(target.email)).agent;
      const res = await as(`/admin/team/${target.id}/reset-password`);
      const fresh2 = /data-secret>([^<]+)</.exec(res.text)?.[1] ?? '';
      expect(fresh2).toHaveLength(12);
      const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: target.id } });
      expect(await bcrypt.compare(fresh2, row.passwordHash)).toBe(true);
      expect(await bcrypt.compare(TEST_ADMIN_PASSWORD, row.passwordHash)).toBe(false);
      expect(mail.outbox.some((m) => m.to === target.email)).toBe(true);
      expect((await session.get('/admin/pos')).status).toBe(302);
    });

    it('removes an account and ends its session', async () => {
      await relogin();
      const target = await member(restaurantId, 'leaver', 'CASHIER');
      const session = (await signIn(target.email)).agent;
      expect((await as(`/admin/team/${target.id}/remove`)).status).toBe(200);
      expect(await prisma.adminUser.count({ where: { id: target.id } })).toBe(0);
      expect((await session.get('/admin/pos')).status).toBe(302);
    });

    it("cannot touch another restaurant's team", async () => {
      await relogin();
      for (const path of [
        `/admin/team/${other.memberId}/role`,
        `/admin/team/${other.memberId}/reset-password`,
        `/admin/team/${other.memberId}/remove`,
      ]) {
        const res = await as(path, { role: 'OWNER' });
        expect([path, res.status]).toEqual([path, 404]);
      }
      expect(await prisma.adminUser.count({ where: { id: other.memberId, role: 'CASHIER' } })).toBe(
        1,
      );
    });
  });
});
