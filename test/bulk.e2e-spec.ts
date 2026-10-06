import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

/** B3 (Pack B): duplicate, bulk price change (+undo), and CSV export/
 *  import (+undo), all behind /admin/bulk. */
describe('Bulk tools (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let adminEmail: string;
  let itemId: string;
  let agent: ReturnType<typeof request.agent>;

  async function csrfToken(): Promise<string> {
    const res = await agent.get('/admin/bulk');
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'bulk');
    restaurantId = restaurant.id;
    adminEmail = admin.email;
    agent = await loginAsAdmin(app, adminEmail);

    const category = await prisma.category.create({
      data: { restaurantId, nameAr: 'قسم', nameEn: 'Drinks', sortOrder: 0 },
    });
    const item = await prisma.item.create({
      data: {
        restaurantId,
        categoryId: category.id,
        nameAr: 'شاي',
        nameEn: 'Tea',
        price: 10,
        currency: 'ILS',
        sortOrder: 0,
      },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await app.close();
  });

  it('duplicates an item into the same category', async () => {
    const token = await csrfToken();
    await agent
      .post(`/admin/bulk/items/${itemId}/duplicate`)
      .type('form')
      .send({ csrf_token: token })
      .expect(201);

    const copies = await prisma.item.findMany({ where: { restaurantId, nameEn: 'Tea' } });
    expect(copies).toHaveLength(2);
  });

  it('applies a bulk percent price change and can undo it', async () => {
    const before = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });

    const priceChangeToken = await csrfToken();
    await agent
      .post('/admin/bulk/price-change')
      .type('form')
      .send({ csrf_token: priceChangeToken, itemIds: itemId, percent: '10' })
      .expect(201);

    const changed = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    expect(Number(changed.price)).toBeCloseTo(Number(before.price) * 1.1, 2);

    const log = await prisma.bulkOperationLog.findFirstOrThrow({
      where: { restaurantId, type: 'PRICE_CHANGE', undoneAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const undoToken = await csrfToken();
    await agent
      .post('/admin/bulk/undo')
      .type('form')
      .send({ csrf_token: undoToken, logId: log.id })
      .expect(201);

    const reverted = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    expect(Number(reverted.price)).toBeCloseTo(Number(before.price), 2);
  });

  it('exports items as CSV', async () => {
    const res = await agent.get('/admin/bulk/export.csv').expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Tea');
    expect(res.text).toContain('Drinks');
  });

  it('imports a CSV, creating and updating items, and reports an error row', async () => {
    const csv = [
      'id,category,nameAr,nameEn,price,currency,available',
      `${itemId},Drinks,شاي بالنعناع,Mint Tea,12,ILS,true`,
      ',Drinks,قهوة,Coffee,8,ILS,true',
      ',NoSuchCategory,x,x,5,ILS,true',
    ].join('\n');

    // Multipart requests can't carry the CSRF token as a body field --
    // Express's body parsers never populate req.body for
    // multipart/form-data, so the real form (views/admin/bulk.njk) sends
    // it as a header via htmx's hx-headers instead (see its comment).
    const importToken = await csrfToken();
    const res = await agent
      .post('/admin/bulk/import')
      .set('X-CSRF-Token', importToken)
      .attach('file', Buffer.from(csv, 'utf-8'), 'items.csv')
      .expect(201);

    // Default locale is Arabic -- assert on the row data (names/counts
    // are locale-independent) rather than the translated banner text.
    expect(res.text).toContain('Mint Tea');
    expect(res.text).toContain('Coffee');
    expect(res.text).toContain('NoSuchCategory');

    const updated = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    expect(updated.nameEn).toBe('Mint Tea');
    const created = await prisma.item.findFirst({ where: { restaurantId, nameEn: 'Coffee' } });
    expect(created).not.toBeNull();
  });

  it('undoes the last CSV import, deleting the created item and restoring the updated one', async () => {
    const log = await prisma.bulkOperationLog.findFirstOrThrow({
      where: { restaurantId, type: 'IMPORT', undoneAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const finalUndoToken = await csrfToken();
    await agent
      .post('/admin/bulk/undo')
      .type('form')
      .send({ csrf_token: finalUndoToken, logId: log.id })
      .expect(201);

    const reverted = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    expect(reverted.nameEn).toBe('Tea');
    const coffee = await prisma.item.findFirst({ where: { restaurantId, nameEn: 'Coffee' } });
    expect(coffee).toBeNull();
  });
});
