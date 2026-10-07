import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

describe('The menu opened from a table (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let slug: string;
  let adminEmail: string;
  let table: { token: string; label: string };
  let foreignToken: string;
  const cleanup: string[] = [];

  const page = (query: string, lang = 'en') =>
    request(app.getHttpServer()).get(`/m/${slug}?${query}`).set('Cookie', `qaemati_locale=${lang}`);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const fixture = await createTestRestaurant(prisma, 'tablemenu');
    restaurantId = fixture.restaurant.id;
    slug = fixture.restaurant.slug;
    adminEmail = fixture.admin.email;
    cleanup.push(restaurantId);
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { latitude: 31.5, longitude: 35.1, whatsapp: '+970599000000' },
    });
    table = await prisma.restaurantTable.create({ data: { restaurantId, label: '12' } });
    const category = await prisma.category.create({
      data: { restaurantId, nameAr: 'ق', nameEn: 'Cat' },
    });
    await prisma.item.create({
      data: {
        restaurantId,
        categoryId: category.id,
        nameAr: 'ص',
        nameEn: 'Dish',
        price: 5,
        currency: 'ILS',
      },
    });
    const other = await createTestRestaurant(prisma, 'tablemenu-other');
    cleanup.push(other.restaurant.id);
    foreignToken = (
      await prisma.restaurantTable.create({
        data: { restaurantId: other.restaurant.id, label: 'Z' },
      })
    ).token;
  });

  afterAll(async () => {
    for (const id of cleanup) await deleteTestRestaurant(prisma, id);
    await app.close();
  });

  it('sends the selection to the kitchen, not to WhatsApp, and offers to call the waiter', async () => {
    const res = await page(`t=${table.token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('tableOrderState(');
    expect(res.text).toContain('/js/table-order.js');
    expect(res.text).toContain('name="csrf-token"');
    expect(res.text).toContain('Send order to the kitchen');
    expect(res.text).toContain('Call waiter');
    expect(res.text).not.toContain('whatsappHref');
    expect(res.text).not.toContain('x-text="labels.sendButton"');
    expect(res.text).toContain('Table 12');
  });

  it('can follow the order live, and says so in Arabic too', async () => {
    const en = await page(`t=${table.token}`);
    expect(en.text).toContain('/js/vendor/socket.io.min.js');
    expect(en.text).toContain('&quot;track&quot;:true');
    expect(en.text).toContain('Being prepared');
    expect(en.text).toContain('data-order-status');
    const ar = await page(`t=${table.token}`, 'ar');
    expect(ar.text).toContain('قيد التحضير');
    expect((await page('')).text).not.toContain('socket.io.min.js');
  });

  it('carries the table token and the slug to the script, and tells it whether to ask for a location', async () => {
    const on = await page(`t=${table.token}`);
    expect(on.text).toContain(`&quot;token&quot;:&quot;${table.token}&quot;`);
    expect(on.text).toContain(`&quot;slug&quot;:&quot;${slug}&quot;`);
    expect(on.text).toContain('&quot;locationCheck&quot;:true');
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { requireLocationCheck: false },
    });
    try {
      expect((await page(`t=${table.token}`)).text).toContain('&quot;locationCheck&quot;:false');
    } finally {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { requireLocationCheck: true },
      });
    }
  });

  it('speaks Arabic in the table flow when the visitor reads Arabic', async () => {
    const res = await page(`t=${table.token}`, 'ar');
    expect(res.text).toContain('أرسل الطلب إلى المطبخ');
    expect(res.text).toContain('نداء النادل');
    expect(res.text).toContain('طاولة 12');
  });

  it('lets guests add dishes even when the restaurant has no WhatsApp number', async () => {
    await prisma.restaurant.update({ where: { id: restaurantId }, data: { whatsapp: null } });
    try {
      const res = await page(`t=${table.token}`);
      expect(res.text).toContain('$store.selection.add(');
      expect(res.text).toContain('/js/selection.js');
    } finally {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { whatsapp: '+970599000000' },
      });
    }
  });

  it('keeps the plain menu on WhatsApp, with no table service at all', async () => {
    const res = await page('');
    expect(res.text).not.toContain('tableOrderState(');
    expect(res.text).not.toContain('/js/table-order.js');
    expect(res.text).not.toContain('Call waiter');
    expect(res.text).toContain('whatsappHref');
  });

  it('shows a table name typed into the address, but never orders for it', async () => {
    const res = await page('table=5');
    expect(res.text).toContain('Table 5');
    expect(res.text).not.toContain('tableOrderState(');
    expect(res.text).not.toContain('Call waiter');
    expect(res.text).toContain('whatsappHref');
  });

  it('ignores a token that is wrong or belongs to another restaurant', async () => {
    for (const token of ['nonsense', foreignToken]) {
      const res = await page(`t=${token}`);
      expect(res.text).not.toContain('tableOrderState(');
      expect(res.text).not.toContain('Table Z');
    }
  });

  it('falls back to WhatsApp, with the table named, when the plan has no table ordering', async () => {
    const plan = await prisma.plan.create({
      data: {
        nameAr: 'خ',
        nameEn: `Wa ${Date.now()}`,
        priceAmount: 1,
        currency: 'ILS',
        features: ['whatsappOrdering'],
      },
    });
    await prisma.subscription.create({ data: { restaurantId, planId: plan.id, status: 'ACTIVE' } });
    try {
      const res = await page(`t=${table.token}`);
      expect(res.text).not.toContain('tableOrderState(');
      expect(res.text).not.toContain('Call waiter');
      expect(res.text).toContain('whatsappHref');
      expect(res.text).toContain('Table 12');
    } finally {
      await prisma.subscription.delete({ where: { restaurantId } });
      await prisma.plan.delete({ where: { id: plan.id } });
    }
  });

  describe('the table QR codes', () => {
    it('carry the table token and not its name, on the QR page and the print sheet', async () => {
      const staff = await loginAsAdmin(app, adminEmail);
      const qr = await staff.get('/admin/qr');
      expect(qr.status).toBe(200);
      expect(qr.text).toContain(`?t=${table.token}`);
      expect(qr.text).not.toContain('?table=');
      // The print sheet shows only the code itself, drawn from the same address.
      const print = await staff.get('/admin/qr/print');
      expect(print.status).toBe(200);
      expect(print.text).not.toContain('?table=');
    });

    it('tell the owner to reprint them once table ordering is on', async () => {
      const staff = await loginAsAdmin(app, adminEmail);
      expect((await staff.get('/admin/qr').set('Cookie', 'qaemati_locale=en')).text).toContain(
        'Reprint the table codes',
      );
    });
  });
});
