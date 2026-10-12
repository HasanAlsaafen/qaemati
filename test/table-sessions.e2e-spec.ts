import { NestExpressApplication } from '@nestjs/platform-express';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { RATE_LIMIT_STORE, RateLimitStore } from '../src/common/rate-limit/rate-limit-store';
import { PrismaService } from '../src/prisma/prisma.service';
import { TableSessionService } from '../src/pos/table-session.service';
import {
  TEST_ADMIN_PASSWORD,
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
} from './utils/test-app';

const HERE = { lat: 31.7767, lng: 35.2345 };
const SESSION_COOKIE = 'qaemati_ts';

interface Place {
  id: string;
  slug: string;
  email: string;
  itemId: string;
  tables: { id: string; token: string }[];
}

/** One phone: it keeps its own cookies, like a browser would. */
class Guest {
  private jar = new Map<string, string>();
  constructor(
    private readonly base: string,
    private readonly limits: RateLimitStore,
  ) {}

  private header(): string {
    return [...this.jar.values()].join('; ');
  }

  private remember(res: Response): void {
    for (const c of res.headers.getSetCookie()) {
      const pair = c.split(';')[0];
      this.jar.set(pair.split('=')[0], pair);
    }
  }

  /** The raw session cookie this phone holds, to replay it somewhere it should not work. */
  get sessionCookie(): string {
    return this.jar.get(SESSION_COOKIE) ?? '';
  }

  forgetSession(): void {
    this.jar.delete(SESSION_COOKIE);
  }

  async send(path: string, body?: unknown, cookieOverride?: string): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Cookie: cookieOverride ?? this.header(),
    };
    if (body !== undefined) {
      if (!this.warmed) await this.warm();
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = this.csrf;
      headers.Cookie = cookieOverride ?? this.header();
    }
    const res = await fetch(`${this.base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.remember(res);
    return res;
  }

  private csrf = '';
  private warmed = false;
  private async warm(): Promise<void> {
    const page = await fetch(`${this.base}/admin/login`);
    this.remember(page);
    this.csrf = /name="csrf_token" value="([^"]*)"/.exec(await page.text())![1];
    this.warmed = true;
  }

  async order(place: Place, tableIndex = 0): Promise<{ track: string; id?: string }> {
    await Promise.all(
      ['127.0.0.1', '::ffff:127.0.0.1']
        .map((ip) => this.limits.reset(`order-ip:${ip}`))
        .concat(this.limits.reset(`order-table:${place.tables[tableIndex].id}`)),
    );
    const res = await this.send(`/m/${place.slug}/orders`, {
      table: place.tables[tableIndex].token,
      lines: [{ key: place.itemId, qty: 1 }],
      ...HERE,
      accuracy: 10,
    });
    expect(res.status).toBe(201);
    return res.json();
  }

  bill(place: Place, tableIndex = 0, cookie?: string) {
    return this.send(
      `/m/${place.slug}/tables/${place.tables[tableIndex].token}/bill`,
      undefined,
      cookie,
    );
  }
}

describe('Table sessions (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sessions: TableSessionService;
  let limits: RateLimitStore;
  let base: string;
  let a: Place;
  let b: Place;
  const sockets: Socket[] = [];

  async function place(suffix: string): Promise<Place> {
    const { restaurant, admin } = await createTestRestaurant(prisma, suffix);
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { latitude: HERE.lat, longitude: HERE.lng },
    });
    const tables = [];
    for (const label of ['1', '2']) {
      tables.push(
        await prisma.restaurantTable.create({ data: { restaurantId: restaurant.id, label } }),
      );
    }
    const category = await prisma.category.create({
      data: { restaurantId: restaurant.id, nameAr: 'ق', nameEn: 'Cat' },
    });
    const item = await prisma.item.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: category.id,
        nameAr: 'ص',
        nameEn: 'Dish',
        price: 5,
        currency: 'ILS',
      },
    });
    return {
      id: restaurant.id,
      slug: restaurant.slug,
      email: admin.email,
      itemId: item.id,
      tables: tables.map((t) => ({ id: t.id, token: t.token })),
    };
  }

  const guest = () => new Guest(base, limits);

  const cookiesOf = (res: Response): string[] =>
    res.headers.getSetCookie().map((c) => c.split(';')[0]);

  const merge = (...lists: string[][]): string => {
    const merged = new Map<string, string>();
    for (const list of lists) for (const c of list) merged.set(c.split('=')[0], c);
    return [...merged.values()].join('; ');
  };

  /** Staff check a table out over real HTTP. */
  async function checkout(p: Place, tableIndex = 0): Promise<number> {
    const login = await fetch(`${base}/admin/login`);
    const jar = cookiesOf(login);
    const token = /name="csrf_token" value="([^"]*)"/.exec(await login.text())![1];
    const signed = await fetch(`${base}/admin/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.join('; ') },
      body: new URLSearchParams({
        csrf_token: token,
        email: p.email,
        password: TEST_ADMIN_PASSWORD,
        redirect: '/admin',
      }),
    });
    const cookie = merge(jar, cookiesOf(signed));
    const page = await fetch(`${base}/admin`, { headers: { Cookie: cookie } });
    const csrf = /name="csrf_token" value="([^"]*)"/.exec(await page.text())?.[1] ?? '';
    const res = await fetch(`${base}/admin/pos/tables/${p.tables[tableIndex].id}/checkout`, {
      method: 'POST',
      headers: { Cookie: merge(cookie.split('; '), cookiesOf(page)), 'X-CSRF-Token': csrf },
    });
    return res.status;
  }

  async function ticketFor(p: Place, g: Guest, cookie?: string): Promise<string | null> {
    const res = await g.send(`/m/${p.slug}/tables/session-ticket`, undefined, cookie);
    return (await res.json()).ticket;
  }

  function watchTable(tableToken: string, ticket: string | null): Socket {
    const socket = io(`${base}/track`, {
      transports: ['websocket'],
      reconnection: false,
      auth: { table: tableToken, ticket },
    });
    sockets.push(socket);
    return socket;
  }

  function watchOrder(token: string, ticket: string | null): Socket {
    const socket = io(`${base}/track`, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token, ticket },
    });
    sockets.push(socket);
    return socket;
  }

  const once = <T>(socket: Socket, event: string, ms = 3000): Promise<T> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms} ms`)), ms);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  const EMPTY = { occupied: false, billRequested: false, orders: [], total: '0.00' };

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    sessions = app.get(TableSessionService);
    limits = app.get<RateLimitStore>(RATE_LIMIT_STORE);
    a = await place('ts-a');
    b = await place('ts-b');
  });

  afterEach(() => {
    while (sockets.length) sockets.pop()!.disconnect();
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, a.id);
    await deleteTestRestaurant(prisma, b.id);
    await app.close();
  });

  it('issues an httpOnly, SameSite=Lax cookie scoped to the restaurant menu when a table order is placed', async () => {
    await limits.reset('order-ip:127.0.0.1');
    const g = guest();
    await g.order(a, 0);
    const probe = guest();
    await probe.order(a, 1);
    const page = await fetch(`${base}/admin/login`);
    const csrf = /name="csrf_token" value="([^"]*)"/.exec(await page.text())![1];
    await limits.reset(`order-table:${a.tables[0].id}`);
    const res = await fetch(`${base}/m/${a.slug}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        Cookie: cookiesOf(page).join('; '),
      },
      body: JSON.stringify({
        table: a.tables[0].token,
        lines: [{ key: a.itemId, qty: 1 }],
        ...HERE,
        accuracy: 10,
      }),
    });
    const set = res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(set).toContain('HttpOnly');
    expect(set).toContain('SameSite=Lax');
    expect(set).toContain(`Path=/m/${a.slug}`);
    expect(JSON.stringify(await res.json())).not.toContain('sessionId');
    await checkout(a, 0);
    await checkout(a, 1);
  });

  it('(b) shows no orders to someone who only scanned the QR code', async () => {
    const first = guest();
    await first.order(a);
    const scanner = guest();
    const bill = await scanner.bill(a);
    expect(bill.status).toBe(200);
    expect(await bill.json()).toMatchObject(EMPTY);
    const page = await scanner.send(`/m/${a.slug}?t=${a.tables[0].token}`);
    expect(page.status).toBe(200);
    // They cannot follow the first party's order, nor ask for their bill.
    const track = await scanner.send(`/m/${a.slug}/orders/${(await first.order(a)).track}`);
    expect(track.status).toBe(404);
    const ask = await scanner.send(`/m/${a.slug}/tables/bill-request`, {
      table: a.tables[0].token,
      ...HERE,
      accuracy: 10,
    });
    expect(ask.status).toBe(409);
    await checkout(a);
  });

  it('(c) lets two guests at one table share one bill after both order', async () => {
    const one = guest();
    const two = guest();
    await one.order(a);
    await two.order(a);
    expect(
      await prisma.tableSession.count({ where: { tableId: a.tables[0].id, status: 'OPEN' } }),
    ).toBe(1);
    const seenByOne = await (await one.bill(a)).json();
    const seenByTwo = await (await two.bill(a)).json();
    expect(seenByOne.orders).toHaveLength(2);
    expect(seenByTwo).toEqual(seenByOne);
    expect(seenByOne.total).toBe('10.00');
    await checkout(a);
  });

  it('(a) keeps the next party bill from a guest holding an old cookie', async () => {
    const old = guest();
    const oldOrder = await old.order(a);
    expect((await (await old.bill(a)).json()).orders).toHaveLength(1);

    expect(await checkout(a)).toBe(200);
    const closed = await prisma.tableSession.findMany({ where: { tableId: a.tables[0].id } });
    expect(closed.every((s) => s.status === 'CLOSED' && s.closedAt)).toBe(true);

    // Stops working at once, and says nothing that hints at what was there.
    expect(await (await old.bill(a)).json()).toMatchObject(EMPTY);
    expect((await old.send(`/m/${a.slug}/orders/${oldOrder.track}`)).status).toBe(404);
    expect(await ticketFor(a, old)).toBeNull();

    const next = guest();
    await next.order(a);
    const seen = await (await old.bill(a)).json();
    expect(seen).toMatchObject(EMPTY);
    expect((await (await next.bill(a)).json()).orders).toHaveLength(1);
    const ask = await old.send(`/m/${a.slug}/tables/bill-request`, {
      table: a.tables[0].token,
      ...HERE,
      accuracy: 10,
    });
    expect(ask.status).toBe(409);
    await checkout(a);
  });

  it('(d) refuses a cookie from another table or another restaurant', async () => {
    const mine = guest();
    await mine.order(a, 0);
    const theirs = guest();
    await theirs.order(b, 0);
    const otherTable = guest();
    await otherTable.order(a, 1);

    // Table 1's cookie on table 2 of the same restaurant.
    expect(await (await mine.bill(a, 1)).json()).toMatchObject(EMPTY);
    // Restaurant A's cookie sent to restaurant B, even if the browser were to send it.
    expect(await (await mine.bill(b, 0, mine.sessionCookie)).json()).toMatchObject(EMPTY);
    expect(await ticketFor(b, mine, mine.sessionCookie)).toBeNull();
    // And the reverse.
    expect(await (await theirs.bill(a, 0, theirs.sessionCookie)).json()).toMatchObject(EMPTY);
    // A cookie that was edited is worthless.
    const forged = `${SESSION_COOKIE}=${mine.sessionCookie.split('=')[1]}x`;
    expect(await (await mine.bill(a, 0, forged)).json()).toMatchObject(EMPTY);
    // Calling the waiter from another table does not tie the call to the session.
    const call = await otherTable.send(`/m/${a.slug}/waiter-calls`, {
      table: a.tables[1].token,
      ...HERE,
      accuracy: 10,
    });
    expect(call.status).toBe(201);
    const stored = await prisma.waiterCall.findFirstOrThrow({
      where: { tableId: a.tables[1].id },
    });
    expect(stored.sessionId).not.toBeNull();
    for (const [p, i] of [
      [a, 0],
      [a, 1],
      [b, 0],
    ] as const)
      await checkout(p, i);
  });

  it('ties a waiter call and a bill request to the party session', async () => {
    const g = guest();
    await g.order(a);
    const session = await prisma.tableSession.findFirstOrThrow({
      where: { tableId: a.tables[0].id, status: 'OPEN' },
    });
    await limits.reset(`call-table:${a.tables[0].id}`);
    const bill = await g.send(`/m/${a.slug}/tables/bill-request`, {
      table: a.tables[0].token,
      ...HERE,
      accuracy: 10,
    });
    expect(bill.status).toBe(200);
    const stranger = guest();
    await limits.reset(`call-table:${a.tables[0].id}`);
    await stranger.send(`/m/${a.slug}/waiter-calls`, {
      table: a.tables[0].token,
      ...HERE,
      accuracy: 10,
    });
    const calls = await prisma.waiterCall.findMany({ where: { tableId: a.tables[0].id } });
    expect(calls.find((c) => c.kind === 'BILL')!.sessionId).toBe(session.id);
    await checkout(a);
  });

  describe('(e) the live tracking channel', () => {
    it('gives a scanner an empty view and no events', async () => {
      const first = guest();
      await first.order(a);
      const socket = watchTable(a.tables[0].token, null);
      expect(await once(socket, 'table')).toEqual({ occupied: false, billRequested: false });
      const track = watchOrder((await first.order(a)).track, null);
      await once(track, 'unknown_order');
      await checkout(a);
    });

    it('lets a member follow the table and their order, and cuts them off on checkout', async () => {
      const g = guest();
      const placed = await g.order(a);
      const table = watchTable(a.tables[0].token, await ticketFor(a, g));
      expect(await once(table, 'table')).toMatchObject({ occupied: true });
      const order = watchOrder(placed.track, await ticketFor(a, g));
      expect(await once(order, 'status')).toEqual({ status: 'NEW' });

      const emptied = once(table, 'table');
      const ended = once(order, 'unknown_order');
      expect(await checkout(a)).toBe(200);
      expect(await emptied).toEqual({ occupied: false, billRequested: false });
      await ended;
    });

    it('refuses tickets from a closed session, another table, another restaurant, or a forgery', async () => {
      const g = guest();
      const placed = await g.order(a, 0);
      const ticket = await ticketFor(a, g);
      const other = guest();
      await other.order(b, 0);

      // Same ticket, someone else table key.
      const wrongTable = watchTable(a.tables[1].token, ticket);
      expect(await once(wrongTable, 'table')).toEqual({ occupied: false, billRequested: false });
      const wrongPlace = watchTable(b.tables[0].token, ticket);
      expect(await once(wrongPlace, 'table')).toEqual({ occupied: false, billRequested: false });
      const otherOrder = watchOrder(placed.track, await ticketFor(b, other));
      await once(otherOrder, 'unknown_order');
      const forged = watchTable(a.tables[0].token, `${ticket}x`);
      expect(await once(forged, 'table')).toEqual({ occupied: false, billRequested: false });

      await checkout(a, 0);
      const closed = watchOrder(placed.track, ticket);
      await once(closed, 'unknown_order');
      await checkout(b, 0);
    });
  });

  describe('(f) idle expiry', () => {
    it('treats a lapsed session as closed on read and invalidates its cookie', async () => {
      const g = guest();
      await g.order(a);
      await prisma.tableSession.updateMany({
        where: { tableId: a.tables[0].id, status: 'OPEN' },
        data: { lastActivityAt: new Date(Date.now() - 7 * 3_600_000) },
      });
      // Nobody has scanned the table either, so the sweep may free it.
      await prisma.restaurantTable.update({
        where: { id: a.tables[0].id },
        data: { lastSeenAt: new Date(Date.now() - 7 * 3_600_000) },
      });
      // Still marked OPEN in the database, yet already useless to the holder.
      expect(await (await g.bill(a)).json()).toMatchObject(EMPTY);
      expect(await ticketFor(a, g)).toBeNull();

      const closedNow = await sessions.closeIdle();
      expect(closedNow).toBeGreaterThanOrEqual(1);
      const row = await prisma.tableSession.findFirstOrThrow({
        where: { tableId: a.tables[0].id },
        orderBy: { openedAt: 'desc' },
      });
      expect(row.status).toBe('CLOSED');
      expect(row.closedAt).not.toBeNull();
      const table = await prisma.restaurantTable.findUniqueOrThrow({
        where: { id: a.tables[0].id },
      });
      expect(table.occupiedAt).toBeNull();
      expect(await sessions.closeIdle()).toBe(0);

      // The next order starts a new session and the old cookie still shows nothing.
      const next = guest();
      await next.order(a);
      expect(await (await g.bill(a)).json()).toMatchObject(EMPTY);
      expect((await (await next.bill(a)).json()).orders).toHaveLength(1);
      await checkout(a);
    });

    it('opens a new session when an order finds the old one idle and never joins it', async () => {
      const g = guest();
      await g.order(a);
      const before = await prisma.tableSession.findFirstOrThrow({
        where: { tableId: a.tables[0].id, status: 'OPEN' },
      });
      await prisma.tableSession.update({
        where: { id: before.id },
        data: { lastActivityAt: new Date(Date.now() - 7 * 3_600_000) },
      });
      const next = guest();
      await next.order(a);
      const after = await prisma.tableSession.findFirstOrThrow({
        where: { tableId: a.tables[0].id, status: 'OPEN' },
      });
      expect(after.id).not.toBe(before.id);
      expect(
        (await prisma.tableSession.findUniqueOrThrow({ where: { id: before.id } })).status,
      ).toBe('CLOSED');
      expect((await (await g.bill(a)).json()).orders).toHaveLength(0);
      await checkout(a);
    });
  });
});
