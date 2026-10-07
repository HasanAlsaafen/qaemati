import { NestExpressApplication } from '@nestjs/platform-express';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { RATE_LIMIT_STORE, RateLimitStore } from '../src/common/rate-limit/rate-limit-store';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  TEST_ADMIN_PASSWORD,
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
} from './utils/test-app';

const HERE = { lat: 31.7767, lng: 35.2345 };

interface Restaurant {
  id: string;
  slug: string;
  email: string;
  tableToken: string;
  itemId: string;
}

describe('Staff screen websocket (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let base: string;
  let a: Restaurant;
  let b: Restaurant;
  const sockets: Socket[] = [];

  async function fixture(suffix: string): Promise<Restaurant> {
    const { restaurant, admin } = await createTestRestaurant(prisma, suffix);
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { latitude: HERE.lat, longitude: HERE.lng },
    });
    const table = await prisma.restaurantTable.create({
      data: { restaurantId: restaurant.id, label: '1' },
    });
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
      tableToken: table.token,
      itemId: item.id,
    };
  }

  const cookiesOf = (res: Response): string[] =>
    res.headers.getSetCookie().map((c) => c.split(';')[0]);

  /** The newest value of each cookie, as one Cookie header. */
  const mergeCookies = (...lists: string[][]): string => {
    const merged = new Map<string, string>();
    for (const list of lists) for (const c of list) merged.set(c.split('=')[0], c);
    return [...merged.values()].join('; ');
  };

  /** Signs in over real HTTP and returns the cookie header a browser would send. */
  async function signIn(email: string): Promise<string> {
    const page = await fetch(`${base}/admin/login`);
    const csrf = /name="csrf_token" value="([^"]*)"/.exec(await page.text())![1];
    const jar = cookiesOf(page);
    const res = await fetch(`${base}/admin/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.join('; ') },
      body: new URLSearchParams({
        csrf_token: csrf,
        email,
        password: TEST_ADMIN_PASSWORD,
        redirect: '/admin',
      }),
    });
    expect(res.status).toBe(302);
    return mergeCookies(jar, cookiesOf(res));
  }

  function connect(cookie?: string, headers: Record<string, string> = {}): Socket {
    const socket = io(`${base}/pos`, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { ...(cookie ? { Cookie: cookie } : {}), ...headers },
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

  const silent = async (socket: Socket, event: string, ms = 600): Promise<boolean> => {
    let heard = false;
    socket.once(event, () => (heard = true));
    await new Promise((r) => setTimeout(r, ms));
    return heard;
  };

  const connected = (socket: Socket) =>
    new Promise<void>((resolve, reject) => {
      if (socket.connected) return resolve();
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });

  /** A guest sends an order, with its own session and CSRF token, over real HTTP. */
  async function guestOrders(r: Restaurant): Promise<{ id: string }> {
    const page = await fetch(`${base}/admin/login`);
    const csrf = /name="csrf_token" value="([^"]*)"/.exec(await page.text())![1];
    const res = await fetch(`${base}/m/${r.slug}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        Cookie: cookiesOf(page).join('; '),
      },
      body: JSON.stringify({
        table: r.tableToken,
        lines: [{ key: r.itemId, qty: 1 }],
        ...HERE,
        accuracy: 10,
      }),
    });
    expect(res.status).toBe(201);
    return res.json();
  }

  async function guestCalls(r: Restaurant): Promise<{ id: string }> {
    const page = await fetch(`${base}/admin/login`);
    const csrf = /name="csrf_token" value="([^"]*)"/.exec(await page.text())![1];
    const res = await fetch(`${base}/m/${r.slug}/waiter-calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        Cookie: cookiesOf(page).join('; '),
      },
      body: JSON.stringify({ table: r.tableToken, ...HERE, accuracy: 10 }),
    });
    expect(res.status).toBe(201);
    return res.json();
  }

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    a = await fixture('rt-a');
    b = await fixture('rt-b');
    // The suite sends several orders from one address.
    const limits = app.get<RateLimitStore>(RATE_LIMIT_STORE);
    await Promise.all(
      ['127.0.0.1', '::ffff:127.0.0.1'].map((ip) => limits.reset(`order-ip:${ip}`)),
    );
  });

  afterEach(() => {
    while (sockets.length) sockets.pop()!.disconnect();
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, a.id);
    await deleteTestRestaurant(prisma, b.id);
    await app.close();
  });

  it('tells signed in staff about a new order the moment it is sent', async () => {
    const staff = connect(await signIn(a.email));
    await connected(staff);
    const heard = once<{ id: string }>(staff, 'order.new');
    const placed = await guestOrders(a);
    expect(await heard).toEqual({ id: placed.id });
  });

  it('sends only an id, never what was ordered', async () => {
    const staff = connect(await signIn(a.email));
    await connected(staff);
    const heard = once<Record<string, unknown>>(staff, 'order.new');
    await guestOrders(a);
    expect(Object.keys(await heard)).toEqual(['id']);
  });

  it('tells staff about a waiter call, and about status changes', async () => {
    const staff = connect(await signIn(a.email));
    await connected(staff);
    const call = once<{ id: string }>(staff, 'call.new');
    const placed = await guestCalls(a);
    expect((await call).id).toBe(placed.id);

    const updated = once<{ id: string }>(staff, 'call.updated');
    const cookie = await signIn(a.email);
    const page = await fetch(`${base}/admin`, { headers: { Cookie: cookie } });
    const csrf = /name="csrf_token" value="([^"]*)"/.exec(await page.text())?.[1] ?? '';
    const ack = await fetch(`${base}/admin/pos/calls/${placed.id}/acknowledge`, {
      method: 'POST',
      headers: { Cookie: mergeCookies(cookie.split('; '), cookiesOf(page)), 'X-CSRF-Token': csrf },
    });
    expect(ack.status).toBe(200);
    expect((await updated).id).toBe(placed.id);
  });

  it("never lets one restaurant's staff hear another's orders", async () => {
    const staffA = connect(await signIn(a.email));
    const staffB = connect(await signIn(b.email));
    await Promise.all([connected(staffA), connected(staffB)]);
    const heardByB = silent(staffB, 'order.new');
    const heardByA = once(staffA, 'order.new');
    await guestOrders(a);
    await heardByA;
    expect(await heardByB).toBe(false);
  });

  it('turns away a connection with no session', async () => {
    const socket = connect();
    const reason = await Promise.race([
      once(socket, 'unauthorized').then(() => 'unauthorized'),
      once(socket, 'disconnect').then(() => 'disconnect'),
    ]);
    expect(['unauthorized', 'disconnect']).toContain(reason);
    await new Promise((r) => setTimeout(r, 200));
    expect(socket.connected).toBe(false);
  });

  it('turns away a page on another site that borrows the visitor cookie', async () => {
    const cookie = await signIn(a.email);
    const socket = connect(cookie, { Origin: 'https://evil.example' });
    await expect(connected(socket)).rejects.toBeDefined();
    expect(socket.connected).toBe(false);
  });

  it('accepts the restaurant own page as the origin', async () => {
    const cookie = await signIn(a.email);
    const socket = connect(cookie, { Origin: base });
    await connected(socket);
    expect(socket.connected).toBe(true);
  });

  it('turns away a session that has signed out', async () => {
    const cookie = await signIn(a.email);
    const page = await fetch(`${base}/admin`, { headers: { Cookie: cookie } });
    const csrf = /name="csrf_token" value="([^"]*)"/.exec(await page.text())?.[1] ?? '';
    const jar = mergeCookies(cookie.split('; '), cookiesOf(page));
    const out = await fetch(`${base}/admin/logout`, {
      method: 'POST',
      redirect: 'manual',
      headers: { Cookie: jar, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrf_token: csrf }),
    });
    expect([302, 303]).toContain(out.status);
    const socket = connect(cookie);
    const verdict = await Promise.race([
      once(socket, 'unauthorized').then(() => 'unauthorized'),
      once(socket, 'disconnect').then(() => 'disconnect'),
    ]);
    expect(['unauthorized', 'disconnect']).toContain(verdict);
  });

  it('cannot be made to join another restaurant room by asking', async () => {
    const staffA = connect(await signIn(a.email));
    await connected(staffA);
    staffA.emit('join', { room: `restaurant:${b.id}` });
    staffA.emit('subscribe', b.id);
    const heard = silent(staffA, 'order.new');
    await guestOrders(b);
    expect(await heard).toBe(false);
  });
});
