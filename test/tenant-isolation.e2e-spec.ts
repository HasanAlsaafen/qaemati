import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

/**
 * Tenant A's signed in admin attacks tenant B's records through every route
 * that takes an id. Nothing of B may change and nothing of B may be shown.
 * Tenant B's names carry a marker so a leak into a response is detectable.
 */
describe('Tenant isolation (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let aId: string;
  let bId: string;
  let agentA: ReturnType<typeof request.agent>;
  const B = {
    menuId: '',
    categoryId: '',
    itemId: '',
    tableId: '',
  };
  const SECRET = 'TENANT-B-SECRET-DISH';

  async function csrf(): Promise<string> {
    const res = await agentA.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  type Verb = 'post' | 'patch' | 'delete';
  async function attack(verb: Verb, path: string, body: Record<string, string> = {}) {
    const token = await csrf();
    return agentA[verb](path)
      .set('X-CSRF-Token', token)
      .set('HX-Request', 'true')
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send(body);
  }

  async function snapshotB() {
    return JSON.stringify({
      menu: await prisma.menu.findUnique({ where: { id: B.menuId } }),
      category: await prisma.category.findUnique({ where: { id: B.categoryId } }),
      item: await prisma.item.findUnique({ where: { id: B.itemId } }),
      table: await prisma.restaurantTable.findUnique({ where: { id: B.tableId } }),
      counts: {
        items: await prisma.item.count({ where: { restaurantId: bId } }),
        categories: await prisma.category.count({ where: { restaurantId: bId } }),
        menus: await prisma.menu.count({ where: { restaurantId: bId } }),
        tables: await prisma.restaurantTable.count({ where: { restaurantId: bId } }),
      },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const a = await createTestRestaurant(prisma, 'iso-a');
    const b = await createTestRestaurant(prisma, 'iso-b');
    aId = a.restaurant.id;
    bId = b.restaurant.id;
    B.menuId = (
      await prisma.menu.create({ data: { restaurantId: bId, nameAr: 'ب', nameEn: 'B menu' } })
    ).id;
    B.categoryId = (
      await prisma.category.create({
        data: { restaurantId: bId, menuId: B.menuId, nameAr: 'ب', nameEn: 'B category' },
      })
    ).id;
    B.itemId = (
      await prisma.item.create({
        data: {
          restaurantId: bId,
          categoryId: B.categoryId,
          nameAr: SECRET,
          nameEn: SECRET,
          price: 7,
          currency: 'ILS',
        },
      })
    ).id;
    B.tableId = (
      await prisma.restaurantTable.create({ data: { restaurantId: bId, label: 'B-table' } })
    ).id;
    await prisma.menu.create({ data: { restaurantId: aId, nameAr: 'أ', nameEn: 'A menu' } });
    agentA = await loginAsAdmin(app, a.admin.email);
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, aId);
    await deleteTestRestaurant(prisma, bId);
    await app.close();
  });

  const cases: Array<[string, Verb, () => string, Record<string, string>]> = [
    [
      'rename a category',
      'patch',
      () => `/admin/categories/${B.categoryId}`,
      { nameAr: 'x', nameEn: 'hacked' },
    ],
    ['delete a category', 'delete', () => `/admin/categories/${B.categoryId}`, {}],
    [
      'move a category',
      'post',
      () => `/admin/categories/${B.categoryId}/move`,
      { direction: 'up' },
    ],
    ['upload a category image', 'post', () => `/admin/categories/${B.categoryId}/image`, {}],
    ['remove a category image', 'delete', () => `/admin/categories/${B.categoryId}/image`, {}],
    [
      'add a dish to a category',
      'post',
      () => `/admin/categories/${B.categoryId}/items`,
      { nameAr: 'x', nameEn: 'injected', price: '1', currency: 'ILS' },
    ],
    [
      'reorder dishes of a category',
      'post',
      () => `/admin/categories/${B.categoryId}/items/reorder`,
      { ids: B.itemId },
    ],
    [
      'edit a dish',
      'patch',
      () => `/admin/items/${B.itemId}`,
      { nameAr: 'x', nameEn: 'hacked', price: '1', currency: 'ILS' },
    ],
    ['toggle a dish', 'patch', () => `/admin/items/${B.itemId}/availability`, {}],
    ['move a dish', 'post', () => `/admin/items/${B.itemId}/move`, { direction: 'up' }],
    ['delete a dish', 'delete', () => `/admin/items/${B.itemId}`, {}],
    ['edit a menu', 'patch', () => `/admin/menus/${B.menuId}`, { nameAr: 'x', nameEn: 'hacked' }],
    ['delete a menu', 'delete', () => `/admin/menus/${B.menuId}`, {}],
    ['move a menu', 'post', () => `/admin/menus/${B.menuId}/move`, { direction: 'up' }],
    ['edit a table', 'patch', () => `/admin/qr/tables/${B.tableId}`, { label: 'hacked' }],
    ['delete a table', 'delete', () => `/admin/qr/tables/${B.tableId}`, {}],
    ['move a table', 'post', () => `/admin/qr/tables/${B.tableId}/move`, { direction: 'up' }],
    ['duplicate a dish', 'post', () => `/admin/bulk/items/${B.itemId}/duplicate`, {}],
  ];

  it.each(cases)('cannot %s of another restaurant', async (_name, verb, path, body) => {
    const before = await snapshotB();
    const res = await attack(verb, path(), body);
    expect(res.text).not.toContain(SECRET);
    expect(await snapshotB()).toBe(before);
    // A foreign id must be refused outright, never answered as success.
    expect([400, 403, 404]).toContain(res.status);
  });

  it("cannot reorder another restaurant's categories or dishes by id list", async () => {
    const before = await snapshotB();
    const res = await attack('post', '/admin/categories/reorder', { ids: B.categoryId });
    expect(res.text).not.toContain(SECRET);
    expect(await snapshotB()).toBe(before);
  });

  it("cannot move its own category into the other restaurant's menu", async () => {
    const own = await prisma.category.create({
      data: { restaurantId: aId, nameAr: 'أ', nameEn: 'A own' },
    });
    const res = await attack('patch', `/admin/categories/${own.id}`, {
      nameAr: 'أ',
      nameEn: 'A own',
      menuId: B.menuId,
    });
    expect(res.status).toBe(403);
    expect((await prisma.category.findUnique({ where: { id: own.id } }))?.menuId).not.toBe(
      B.menuId,
    );
  });

  it('does not show the other restaurant in its own bulk list, analytics or CSV export', async () => {
    for (const path of ['/admin/bulk', '/admin/analytics', '/admin', '/admin/qr']) {
      const res = await agentA.get(path).set('Cookie', 'qaemati_locale=en');
      expect(res.text).not.toContain(SECRET);
    }
    const csv = await agentA.get('/admin/bulk/export.csv');
    expect(csv.text).not.toContain(SECRET);
  });

  it("cannot import a CSV row that overwrites the other restaurant's dish by id", async () => {
    const before = await snapshotB();
    const token = await csrf();
    const csv = `id,category,nameAr,nameEn,price,currency,available\n${B.itemId},A category,x,hacked,1,ILS,true\n`;
    await agentA
      .post('/admin/bulk/import')
      .set('X-CSRF-Token', token)
      .set('HX-Request', 'true')
      .attach('file', Buffer.from(csv), { filename: 'x.csv', contentType: 'text/csv' });
    expect(await snapshotB()).toBe(before);
  });

  it("cannot see the other restaurant's preview overrides on the public page", async () => {
    const res = await request(app.getHttpServer()).get(
      `/m/test-restaurant-iso-b?lang=en&previewName=Defaced`,
    );
    expect(res.text).not.toContain('Defaced');
  });

  it("keeps the other restaurant's dishes out of its own public menu", async () => {
    const res = await request(app.getHttpServer()).get(`/m/test-restaurant-iso-a?lang=en`);
    expect(res.text).not.toContain(SECRET);
  });
});
