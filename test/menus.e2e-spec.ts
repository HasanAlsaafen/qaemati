import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { nowInHebronMinutes } from '../src/common/open-status';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

function hhmm(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

describe('Multiple menus (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let restaurantId: string;
  let otherRestaurantId: string;
  let otherMenuId: string;
  let slug: string;
  let agent: ReturnType<typeof request.agent>;

  async function token(): Promise<string> {
    const res = await agent.get('/admin?lang=en').set('Cookie', 'qaemati_locale=en');
    return /name="csrf_token" value="([^"]*)"/.exec(res.text)?.[1] ?? '';
  }

  function htmx(method: 'post' | 'patch' | 'delete', path: string, csrf: string) {
    return agent[method](path)
      .set('X-CSRF-Token', csrf)
      .set('HX-Request', 'true')
      .set('Cookie', 'qaemati_locale=en')
      .type('form');
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'menus');
    restaurantId = restaurant.id;
    slug = restaurant.slug;
    agent = await loginAsAdmin(app, admin.email);

    const other = await createTestRestaurant(prisma, 'menus-other');
    otherRestaurantId = other.restaurant.id;
    otherMenuId = (
      await prisma.menu.create({
        data: { restaurantId: otherRestaurantId, nameAr: 'آخر', nameEn: 'Other' },
      })
    ).id;
  });

  afterAll(async () => {
    await deleteTestRestaurant(prisma, restaurantId);
    await deleteTestRestaurant(prisma, otherRestaurantId);
    await app.close();
  });

  describe('public page', () => {
    let closedMenuId: string;
    let allDayMenuId: string;

    beforeAll(async () => {
      const now = nowInHebronMinutes();
      const closed = await prisma.menu.create({
        data: {
          restaurantId,
          nameAr: 'الفطور',
          nameEn: 'Breakfast',
          availableFrom: hhmm(now + 60),
          availableTo: hhmm(now + 120),
          sortOrder: 0,
        },
      });
      const allDay = await prisma.menu.create({
        data: { restaurantId, nameAr: 'طوال اليوم', nameEn: 'All day', sortOrder: 1 },
      });
      closedMenuId = closed.id;
      allDayMenuId = allDay.id;
      await prisma.category.create({
        data: { restaurantId, menuId: closed.id, nameAr: 'بيض', nameEn: 'Eggs' },
      });
      await prisma.category.create({
        data: { restaurantId, menuId: allDay.id, nameAr: 'مشاوي', nameEn: 'Grills' },
      });
      await prisma.category.create({
        data: { restaurantId, menuId: null, nameAr: 'غير مصنف', nameEn: 'Unassigned' },
      });
    });

    afterAll(async () => {
      await prisma.category.deleteMany({ where: { restaurantId } });
      await prisma.menu.deleteMany({ where: { restaurantId } });
    });

    it('opens the first menu that is being served right now, not just the first one', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      expect(res.text).toContain('Grills');
      expect(res.text).not.toContain('>Eggs<');
      expect(res.text).toMatch(/aria-current="page"[^>]*>All day</);
    });

    it('shows a tab per menu as links with the active one marked', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      expect(res.text).toContain(`href="/m/${slug}?menu=${closedMenuId}"`);
      expect(res.text).toContain(`href="/m/${slug}?menu=${allDayMenuId}"`);
    });

    it('shows the other menu and its hours note, saying it is closed now', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en&menu=${closedMenuId}`);
      expect(res.text).toContain('Eggs');
      expect(res.text).not.toContain('>Grills<');
      expect(res.text).toContain('Breakfast is not available right now. It is served from');
      expect(res.text).toContain('data-menu-closed');
    });

    it('marks the closed menu on its tab and leaves the open one alone', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      expect(res.text).toMatch(/>Breakfast <span[^>]*>· Closed now</);
      expect(res.text).not.toMatch(/All day <span[^>]*>· Closed now/);
      expect(res.text).not.toContain('data-menu-closed');
    });

    it('does not let a guest add a dish from a closed menu', async () => {
      const category = await prisma.category.findFirstOrThrow({ where: { menuId: closedMenuId } });
      const dish = await prisma.item.create({
        data: {
          restaurantId,
          categoryId: category.id,
          nameAr: 'بيضة',
          nameEn: 'Omelette',
          price: 5,
          currency: 'ILS',
        },
      });
      try {
        const closed = await request(app.getHttpServer()).get(
          `/m/${slug}?lang=en&menu=${closedMenuId}`,
        );
        expect(closed.text).toContain('Omelette');
        expect(closed.text).toContain('&quot;available&quot;:false');
        expect(closed.text).not.toContain('aria-label="Add Omelette');
      } finally {
        await prisma.item.delete({ where: { id: dish.id } });
      }
    });

    it('translates the hours note into Arabic', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=ar&menu=${closedMenuId}`);
      expect(res.text).toContain('تُقدَّم من');
      expect(res.text).toContain('غير متاحة الآن');
    });

    it('puts a category with no menu into the first menu', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en&menu=${closedMenuId}`);
      expect(res.text).toContain('Unassigned');
      const other = await request(app.getHttpServer()).get(
        `/m/${slug}?lang=en&menu=${allDayMenuId}`,
      );
      expect(other.text).not.toContain('Unassigned');
    });

    it('ignores a menu id from another restaurant', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en&menu=${otherMenuId}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Grills');
    });

    it('keeps the table label on the tab links', async () => {
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en&table=12`);
      expect(res.text).toContain(`?menu=${closedMenuId}&amp;table=12`.replace('&amp;', '&'));
    });
  });

  describe('single menu', () => {
    it('shows no tabs when there is one menu without hours', async () => {
      await prisma.menu.create({
        data: { restaurantId, nameAr: 'رئيسية', nameEn: 'Main menu' },
      });
      const res = await request(app.getHttpServer()).get(`/m/${slug}?lang=en`);
      expect(res.text).not.toContain('aria-label="Menus"');
      await prisma.menu.deleteMany({ where: { restaurantId } });
    });
  });

  describe('admin', () => {
    afterEach(async () => {
      await prisma.category.deleteMany({ where: { restaurantId } });
      await prisma.menu.deleteMany({ where: { restaurantId } });
    });

    it('creates a Main menu on first visit and assigns existing categories to it', async () => {
      const category = await prisma.category.create({
        data: { restaurantId, nameAr: 'قسم', nameEn: 'Legacy' },
      });
      const res = await agent.get('/admin?lang=en');
      expect(res.text).toContain('Main menu');
      const menus = await prisma.menu.findMany({ where: { restaurantId } });
      expect(menus).toHaveLength(1);
      const after = await prisma.category.findUnique({ where: { id: category.id } });
      expect(after?.menuId).toBe(menus[0].id);
    });

    it('adds a menu with hours and answers with the new tab selected', async () => {
      const csrf = await token();
      const res = await htmx('post', '/admin/menus', csrf).send({
        nameAr: 'الفطور',
        nameEn: 'Breakfast',
        availableFrom: '07:00',
        availableTo: '12:00',
      });
      expect(res.status).toBe(201);
      expect(res.text).toContain('Breakfast');
      expect(res.text).toContain('Served from 07:00 to 12:00');
      const menu = await prisma.menu.findFirst({ where: { restaurantId, nameEn: 'Breakfast' } });
      expect(menu?.availableFrom).toBe('07:00');
    });

    it('treats a one sided time as no hours', async () => {
      const csrf = await token();
      await htmx('post', '/admin/menus', csrf).send({
        nameAr: 'ليلي',
        nameEn: 'Night',
        availableFrom: '22:00',
      });
      const menu = await prisma.menu.findFirst({ where: { restaurantId, nameEn: 'Night' } });
      expect(menu?.availableFrom).toBeNull();
      expect(menu?.availableTo).toBeNull();
    });

    it('rejects a malformed time with a field message and creates nothing', async () => {
      const csrf = await token();
      const res = await htmx('post', '/admin/menus', csrf).send({
        nameAr: 'س',
        nameEn: 'Bad',
        availableFrom: '25:99',
        availableTo: '12:00',
      });
      expect(res.status).toBe(422);
      expect(res.body.errors.availableFrom).toEqual(['Enter a time like 09:30.']);
      expect(await prisma.menu.count({ where: { restaurantId, nameEn: 'Bad' } })).toBe(0);
    });

    it('requires both names', async () => {
      const csrf = await token();
      const res = await htmx('post', '/admin/menus', csrf).send({ nameAr: '', nameEn: '' });
      const { toast } = JSON.parse(res.headers['hx-trigger']);
      expect(toast.variant).toBe('danger');
    });

    it('creates a category inside the chosen menu', async () => {
      await agent.get('/admin?lang=en');
      const csrf = await token();
      const other = await prisma.menu.create({
        data: { restaurantId, nameAr: 'ثانية', nameEn: 'Second', sortOrder: 5 },
      });
      await htmx('post', '/admin/categories', csrf).send({
        nameAr: 'قسم',
        nameEn: 'Starters',
        menuId: other.id,
      });
      const category = await prisma.category.findFirst({
        where: { restaurantId, nameEn: 'Starters' },
      });
      expect(category?.menuId).toBe(other.id);
    });

    it('moves a category to another menu and removes it from the current list', async () => {
      await agent.get('/admin?lang=en');
      const first = (await prisma.menu.findFirst({ where: { restaurantId } }))!;
      const second = await prisma.menu.create({
        data: { restaurantId, nameAr: 'ثانية', nameEn: 'Second', sortOrder: 5 },
      });
      const category = await prisma.category.create({
        data: { restaurantId, menuId: first.id, nameAr: 'قسم', nameEn: 'Mover' },
      });
      const csrf = await token();
      const res = await htmx('patch', `/admin/categories/${category.id}`, csrf).send({
        nameAr: 'قسم',
        nameEn: 'Mover',
        menuId: second.id,
      });
      expect(res.status).toBe(200);
      expect(res.text).toBe('');
      expect((await prisma.category.findUnique({ where: { id: category.id } }))?.menuId).toBe(
        second.id,
      );
    });

    it("refuses to move a category into another restaurant's menu", async () => {
      await agent.get('/admin?lang=en');
      const first = (await prisma.menu.findFirst({ where: { restaurantId } }))!;
      const category = await prisma.category.create({
        data: { restaurantId, menuId: first.id, nameAr: 'قسم', nameEn: 'Stay' },
      });
      const csrf = await token();
      const res = await htmx('patch', `/admin/categories/${category.id}`, csrf).send({
        nameAr: 'قسم',
        nameEn: 'Stay',
        menuId: otherMenuId,
      });
      expect(res.status).toBe(403);
      expect((await prisma.category.findUnique({ where: { id: category.id } }))?.menuId).toBe(
        first.id,
      );
    });

    it('moves categories to another menu when their menu is deleted, and keeps the dishes', async () => {
      await agent.get('/admin?lang=en');
      const first = (await prisma.menu.findFirst({ where: { restaurantId } }))!;
      const second = await prisma.menu.create({
        data: { restaurantId, nameAr: 'ثانية', nameEn: 'Second', sortOrder: 5 },
      });
      const category = await prisma.category.create({
        data: { restaurantId, menuId: second.id, nameAr: 'قسم', nameEn: 'Keep me' },
      });
      await prisma.item.create({
        data: {
          restaurantId,
          categoryId: category.id,
          nameAr: 'صنف',
          nameEn: 'Dish',
          price: 3,
          currency: 'ILS',
        },
      });
      const csrf = await token();
      const res = await htmx('delete', `/admin/menus/${second.id}`, csrf);
      expect(res.status).toBe(200);
      expect(await prisma.menu.count({ where: { id: second.id } })).toBe(0);
      expect((await prisma.category.findUnique({ where: { id: category.id } }))?.menuId).toBe(
        first.id,
      );
      expect(await prisma.item.count({ where: { categoryId: category.id } })).toBe(1);
    });

    it('will not delete the last menu', async () => {
      await agent.get('/admin?lang=en');
      const only = (await prisma.menu.findFirst({ where: { restaurantId } }))!;
      const csrf = await token();
      const res = await htmx('delete', `/admin/menus/${only.id}`, csrf);
      const { toast } = JSON.parse(res.headers['hx-trigger']);
      expect(toast.variant).toBe('danger');
      expect(await prisma.menu.count({ where: { restaurantId } })).toBe(1);
    });

    it('reorders menus', async () => {
      await agent.get('/admin?lang=en');
      const first = (await prisma.menu.findFirst({ where: { restaurantId } }))!;
      const second = await prisma.menu.create({
        data: { restaurantId, nameAr: 'ثانية', nameEn: 'Second', sortOrder: 1 },
      });
      const csrf = await token();
      await htmx('post', `/admin/menus/${second.id}/move`, csrf).send({ direction: 'up' });
      const ordered = await prisma.menu.findMany({
        where: { restaurantId },
        orderBy: { sortOrder: 'asc' },
      });
      expect(ordered.map((m) => m.id)).toEqual([second.id, first.id]);
    });

    it("does not let one restaurant change another one's menu", async () => {
      const csrf = await token();
      const res = await htmx('patch', `/admin/menus/${otherMenuId}`, csrf).send({
        nameAr: 'اختراق',
        nameEn: 'Hijack',
      });
      expect(res.status).toBe(403);
      expect((await prisma.menu.findUnique({ where: { id: otherMenuId } }))?.nameEn).toBe('Other');
    });

    it('moves a category only among its own menu when reordering with the arrows', async () => {
      await agent.get('/admin?lang=en');
      const first = (await prisma.menu.findFirst({ where: { restaurantId } }))!;
      const second = await prisma.menu.create({
        data: { restaurantId, nameAr: 'ثانية', nameEn: 'Second', sortOrder: 5 },
      });
      const a = await prisma.category.create({
        data: { restaurantId, menuId: first.id, nameAr: 'أ', nameEn: 'A', sortOrder: 0 },
      });
      await prisma.category.create({
        data: { restaurantId, menuId: second.id, nameAr: 'ب', nameEn: 'B', sortOrder: 1 },
      });
      const c = await prisma.category.create({
        data: { restaurantId, menuId: first.id, nameAr: 'ج', nameEn: 'C', sortOrder: 2 },
      });
      const csrf = await token();
      await htmx('post', `/admin/categories/${c.id}/move`, csrf).send({ direction: 'up' });
      const after = await prisma.category.findMany({
        where: { menuId: first.id },
        orderBy: { sortOrder: 'asc' },
      });
      expect(after.map((x) => x.id)).toEqual([c.id, a.id]);
    });
  });
});
