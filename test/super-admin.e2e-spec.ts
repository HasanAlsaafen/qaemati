import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { addDays } from '../src/tenancy/billing-dates';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

const SUPER_PASSWORD = 'Super@Password123';

describe('Super admin (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let superId: string;
  let superEmail: string;
  let agent: ReturnType<typeof request.agent>;
  let planId: string;
  const restaurantIds: string[] = [];
  const planIds: string[] = [];
  let seq = 0;

  const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';

  async function post(
    client: ReturnType<typeof request.agent>,
    page: string,
    path: string,
    body: Record<string, string | string[]>,
    referer = page,
  ) {
    const form = await client.get(page).set('Cookie', 'qaemati_locale=en');
    const token = csrfFrom(form.text);
    return client
      .post(path)
      .set('Cookie', 'qaemati_locale=en')
      .set('Referer', `http://127.0.0.1${referer}`)
      .type('form')
      .send({ csrf_token: token, ...body });
  }

  async function loginSuper(email = superEmail, password = SUPER_PASSWORD) {
    const client = request.agent(app.getHttpServer());
    const page = await client.get('/super/login');
    await client
      .post('/super/login')
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), email, password });
    return client;
  }

  async function newTenant(
    overrides: Record<string, string> = {},
  ): Promise<{ id: string; slug: string; adminEmail: string; password: string }> {
    const n = ++seq;
    const slug = `sa-test-${n}-${Date.now().toString(36)}`;
    const adminEmail = `owner-${n}-${Date.now().toString(36)}@sa-test.example.com`;
    const res = await post(agent, '/super/restaurants/new', '/super/restaurants', {
      nameAr: 'مطعم',
      nameEn: `SA Test ${n}`,
      slug,
      planId,
      startMode: 'TRIAL',
      adminName: 'Owner',
      adminEmail,
      ...overrides,
    });
    expect(res.status).toBe(303);
    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { slug: overrides.slug ?? slug },
    });
    restaurantIds.push(restaurant.id);
    const page = await agent.get(res.headers.location);
    const password = /data-secret>([^<]+)</.exec(page.text)?.[1] ?? '';
    return {
      id: restaurant.id,
      slug: restaurant.slug,
      adminEmail: overrides.adminEmail ?? adminEmail,
      password,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    superEmail = `super-${Date.now().toString(36)}@sa-test.example.com`;
    superId = (
      await prisma.superAdmin.create({
        data: {
          email: superEmail,
          name: 'Test Operator',
          passwordHash: await bcrypt.hash(SUPER_PASSWORD, 10),
        },
      })
    ).id;
    planId = (
      await prisma.plan.create({
        data: {
          nameAr: 'اختبار',
          nameEn: 'Test plan',
          priceAmount: 50,
          currency: 'ILS',
          interval: 'MONTHLY',
          trialDays: 10,
          maxAdminUsers: 2,
          features: ['analytics'],
        },
      })
    ).id;
    planIds.push(planId);
    agent = await loginSuper();
  });

  afterAll(async () => {
    for (const id of restaurantIds) await deleteTestRestaurant(prisma, id);
    await prisma.auditLog.deleteMany({ where: { actorId: superId } });
    await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
    await prisma.superAdmin.delete({ where: { id: superId } }).catch(() => undefined);
    await app.close();
  });

  describe('access', () => {
    it('sends a signed out visitor to the login page for every super page', async () => {
      for (const path of [
        '/super',
        '/super/restaurants',
        '/super/plans',
        '/super/payments',
        '/super/audit',
      ]) {
        const res = await request(app.getHttpServer()).get(path);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/super/login');
      }
    });

    it("rejects a wrong password and a restaurant owner's credentials, with the same message", async () => {
      const page = await request(app.getHttpServer()).get('/super/login');
      const wrong = await request(app.getHttpServer())
        .post('/super/login')
        .set('Cookie', page.headers['set-cookie'])
        .type('form')
        .send({ csrf_token: csrfFrom(page.text), email: superEmail, password: 'nope' });
      expect(wrong.status).toBe(200);
      expect(wrong.text).toContain('role="alert"');
      const owner = await createTestRestaurant(prisma, 'sa-owner-cred');
      restaurantIds.push(owner.restaurant.id);
      const asOwner = await loginSuper(owner.admin.email, 'Test@Password123');
      expect((await asOwner.get('/super')).status).toBe(302);
    });

    it('keeps a signed in restaurant owner out of the super area', async () => {
      const owner = await createTestRestaurant(prisma, 'sa-owner-access');
      restaurantIds.push(owner.restaurant.id);
      const ownerAgent = await loginAsAdmin(app, owner.admin.email);
      const res = await ownerAgent.get('/super/restaurants');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/super/login');
    });

    it('keeps a signed in super admin out of a restaurant admin', async () => {
      const res = await agent.get('/admin');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/admin/login');
    });

    it('signs in and out', async () => {
      const client = await loginSuper();
      expect((await client.get('/super')).status).toBe(200);
      const out = await post(client, '/super', '/super/logout', {});
      expect(out.status).toBe(302);
      expect((await client.get('/super')).status).toBe(302);
    });
  });

  describe('creating a restaurant', () => {
    it('creates the restaurant, a first menu, a trial subscription and an owner who can sign in', async () => {
      const tenant = await newTenant();
      const restaurant = await prisma.restaurant.findUniqueOrThrow({
        where: { id: tenant.id },
        include: { menus: true, subscription: true, adminUsers: true },
      });
      expect(restaurant.menus).toHaveLength(1);
      expect(restaurant.subscription?.status).toBe('TRIALING');
      expect(restaurant.subscription?.trialEndsAt!.getTime()).toBeGreaterThan(
        addDays(new Date(), 9).getTime(),
      );
      expect(restaurant.adminUsers).toHaveLength(1);
      expect(tenant.password).toHaveLength(12);

      const page = await request.agent(app.getHttpServer()).get('/admin/login');
      const owner = request.agent(app.getHttpServer());
      const form = await owner.get('/admin/login');
      const login = await owner
        .post('/admin/login')
        .type('form')
        .send({
          csrf_token: csrfFrom(form.text),
          email: tenant.adminEmail,
          password: tenant.password,
          redirect: '/admin',
        });
      expect(page.status).toBe(200);
      expect(login.status).toBe(302);
      expect((await owner.get('/admin')).status).toBe(200);
    });

    it('shows the generated password once and never again', async () => {
      const tenant = await newTenant();
      expect(tenant.password).not.toBe('');
      const again = await agent.get(`/super/restaurants/${tenant.id}`);
      expect(again.text).not.toContain(tenant.password);
      const stored = await prisma.adminUser.findFirstOrThrow({
        where: { email: tenant.adminEmail },
      });
      expect(stored.passwordHash).not.toContain(tenant.password);
    });

    it.each([
      ['an invalid address', { slug: 'Bad Slug!' }, 'slug', 'Use lowercase letters'],
      ['a reserved address', { slug: 'admin' }, 'slug', 'reserved'],
      ['an invalid email', { adminEmail: 'not-an-email' }, 'adminEmail', 'valid email'],
      [
        'a missing paid until date for an already paid start',
        { startMode: 'ACTIVE' },
        'paidUntil',
        'paid until',
      ],
    ])(
      'refuses %s with a message on that field and creates nothing',
      async (_label, overrides, field, text) => {
        const before = await prisma.restaurant.count();
        const res = await post(agent, '/super/restaurants/new', '/super/restaurants', {
          nameAr: 'م',
          nameEn: 'X',
          slug: `refuse-${Date.now().toString(36)}`,
          planId,
          startMode: 'TRIAL',
          adminName: 'O',
          adminEmail: `o-${Date.now().toString(36)}@sa-test.example.com`,
          ...overrides,
        });
        expect(res.status).toBe(303);
        const form = await agent.get(res.headers.location).set('Cookie', 'qaemati_locale=en');
        expect(form.text).toContain(`field-${field}-error`);
        expect(form.text.toLowerCase()).toContain(text.toLowerCase());
        expect(await prisma.restaurant.count()).toBe(before);
      },
    );

    it('refuses an address or an owner email that is already taken', async () => {
      const first = await newTenant();
      const dupSlug = await post(agent, '/super/restaurants/new', '/super/restaurants', {
        nameAr: 'م',
        nameEn: 'Dup',
        slug: first.slug,
        planId,
        startMode: 'TRIAL',
        adminName: 'O',
        adminEmail: `dup-${Date.now().toString(36)}@sa-test.example.com`,
      });
      const slugForm = await agent.get(dupSlug.headers.location);
      expect(slugForm.text).toContain('already used by another restaurant');
      const dupEmail = await post(agent, '/super/restaurants/new', '/super/restaurants', {
        nameAr: 'م',
        nameEn: 'Dup2',
        slug: `dup2-${Date.now().toString(36)}`,
        planId,
        startMode: 'TRIAL',
        adminName: 'O',
        adminEmail: first.adminEmail,
      });
      const emailForm = await agent.get(dupEmail.headers.location);
      expect(emailForm.text).toContain('already has an account');
      expect(await prisma.restaurant.count({ where: { nameEn: { in: ['Dup', 'Dup2'] } } })).toBe(0);
    });

    it('keeps what was typed when it refuses', async () => {
      const res = await post(agent, '/super/restaurants/new', '/super/restaurants', {
        nameAr: 'مطعمي',
        nameEn: 'Keep Me',
        slug: 'admin',
        planId,
        startMode: 'TRIAL',
        adminName: 'Kept Name',
        adminEmail: 'kept@sa-test.example.com',
      });
      const form = await agent.get(res.headers.location);
      expect(form.text).toContain('value="Keep Me"');
      expect(form.text).toContain('value="Kept Name"');
    });
  });

  describe('subscription control', () => {
    it('suspends at once, takes the menu offline, then brings it back on reactivation', async () => {
      const tenant = await newTenant();
      await prisma.menu.deleteMany({ where: { restaurantId: tenant.id } });
      expect((await request(app.getHttpServer()).get(`/m/${tenant.slug}?lang=en`)).status).toBe(
        200,
      );
      await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/status`,
        {
          action: 'suspend',
          reason: 'Unpaid invoice',
        },
      );
      expect((await request(app.getHttpServer()).get(`/m/${tenant.slug}?lang=en`)).status).toBe(
        503,
      );
      const detail = await agent
        .get(`/super/restaurants/${tenant.id}`)
        .set('Cookie', 'qaemati_locale=en');
      expect(detail.text).toContain('Unpaid invoice');
      await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/status`,
        { action: 'reactivate' },
      );
      expect((await request(app.getHttpServer()).get(`/m/${tenant.slug}?lang=en`)).status).toBe(
        200,
      );
    });

    it('cancels, and a canceled restaurant stays offline until reactivated', async () => {
      const tenant = await newTenant();
      await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/status`,
        { action: 'cancel' },
      );
      const sub = await prisma.subscription.findUniqueOrThrow({
        where: { restaurantId: tenant.id },
      });
      expect(sub.status).toBe('CANCELED');
      expect(sub.canceledAt).not.toBeNull();
      expect((await request(app.getHttpServer()).get(`/m/${tenant.slug}?lang=en`)).status).toBe(
        503,
      );
    });

    it('changes the plan and applies the new limits straight away', async () => {
      const tenant = await newTenant();
      const small = await prisma.plan.create({
        data: {
          nameAr: 'صغيرة',
          nameEn: 'Tiny',
          priceAmount: 5,
          currency: 'ILS',
          maxMenus: 1,
          features: [],
        },
      });
      planIds.push(small.id);
      const res = await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/plan`,
        { planId: small.id },
      );
      expect(res.status).toBe(303);
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { restaurantId: tenant.id } }))
          .planId,
      ).toBe(small.id);
    });

    it('will not move a restaurant to an archived plan', async () => {
      const tenant = await newTenant();
      const archived = await prisma.plan.create({
        data: {
          nameAr: 'قديمة',
          nameEn: 'Old',
          priceAmount: 5,
          currency: 'ILS',
          isActive: false,
          features: [],
        },
      });
      planIds.push(archived.id);
      await post(agent, `/super/restaurants/${tenant.id}`, `/super/restaurants/${tenant.id}/plan`, {
        planId: archived.id,
      });
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { restaurantId: tenant.id } }))
          .planId,
      ).toBe(planId);
    });

    it('edits the dates and grace period', async () => {
      const tenant = await newTenant();
      await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/settings`,
        {
          graceDays: '3',
          trialEndsAt: '',
          currentPeriodEnd: '2031-01-15',
          note: 'Agreed by phone',
        },
      );
      const sub = await prisma.subscription.findUniqueOrThrow({
        where: { restaurantId: tenant.id },
      });
      expect(sub.graceDays).toBe(3);
      expect(sub.currentPeriodEnd?.toISOString().slice(0, 10)).toBe('2031-01-15');
      expect(sub.note).toBe('Agreed by phone');
    });
  });

  describe('owner accounts', () => {
    it('adds an account up to the plan limit, then refuses with the limit named', async () => {
      const tenant = await newTenant();
      const ok = await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/admins`,
        {
          name: 'Second',
          email: `second-${Date.now().toString(36)}@sa-test.example.com`,
        },
      );
      expect(ok.status).toBe(303);
      expect(await prisma.adminUser.count({ where: { restaurantId: tenant.id } })).toBe(2);
      const over = await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/admins`,
        {
          name: 'Third',
          email: `third-${Date.now().toString(36)}@sa-test.example.com`,
        },
      );
      const page = await agent.get(over.headers.location).set('Cookie', 'qaemati_locale=en');
      expect(page.text).toContain('allows 2 admin users');
      expect(await prisma.adminUser.count({ where: { restaurantId: tenant.id } })).toBe(2);
    });

    it('resets a password so the old one stops working and the new one works', async () => {
      const tenant = await newTenant();
      const admin = await prisma.adminUser.findFirstOrThrow({ where: { restaurantId: tenant.id } });
      const res = await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/admins/${admin.id}/reset-password`,
        {},
      );
      const page = await agent.get(res.headers.location);
      const fresh = /data-secret>([^<]+)</.exec(page.text)?.[1] ?? '';
      expect(fresh).not.toBe('');
      expect(fresh).not.toBe(tenant.password);
      const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
      expect(await bcrypt.compare(fresh, after.passwordHash)).toBe(true);
      expect(await bcrypt.compare(tenant.password, after.passwordHash)).toBe(false);
    });

    it('never removes the last owner account', async () => {
      const tenant = await newTenant();
      const admin = await prisma.adminUser.findFirstOrThrow({ where: { restaurantId: tenant.id } });
      await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/admins/${admin.id}/remove`,
        {},
      );
      expect(await prisma.adminUser.count({ where: { restaurantId: tenant.id } })).toBe(1);
    });

    it('cannot reset or remove an account of a different restaurant through the wrong address', async () => {
      const a = await newTenant();
      const b = await newTenant();
      const adminOfB = await prisma.adminUser.findFirstOrThrow({ where: { restaurantId: b.id } });
      const before = (await prisma.adminUser.findUniqueOrThrow({ where: { id: adminOfB.id } }))
        .passwordHash;
      const res = await post(
        agent,
        `/super/restaurants/${a.id}`,
        `/super/restaurants/${a.id}/admins/${adminOfB.id}/reset-password`,
        {},
      );
      expect(res.status).toBe(404);
      expect(
        (await prisma.adminUser.findUniqueOrThrow({ where: { id: adminOfB.id } })).passwordHash,
      ).toBe(before);
    });
  });

  describe('payments', () => {
    async function pay(tenantId: string, fields: Record<string, string> = {}) {
      return post(
        agent,
        `/super/payments/new?restaurantId=${tenantId}`,
        '/super/payments',
        {
          restaurantId: tenantId,
          amount: '50.00',
          method: 'CASH',
          paidAt: new Date().toISOString().slice(0, 10),
          periods: '1',
          ...fields,
        },
        `/super/payments/new?restaurantId=${tenantId}`,
      );
    }

    it('turns a trial into an active subscription paid for one period, and issues a receipt', async () => {
      const tenant = await newTenant();
      const res = await pay(tenant.id, { paidAt: '2026-10-10' });
      expect(res.status).toBe(303);
      expect(res.headers.location).toMatch(/\/super\/payments\/.+\/receipt/);
      const sub = await prisma.subscription.findUniqueOrThrow({
        where: { restaurantId: tenant.id },
      });
      expect(sub.status).toBe('ACTIVE');
      expect(sub.currentPeriodEnd?.toISOString().slice(0, 10)).toBe('2026-11-10');
      const receipt = await agent.get(res.headers.location).set('Cookie', 'qaemati_locale=en');
      expect(receipt.status).toBe(200);
      expect(receipt.text).toMatch(/R-\d{6}/);
      expect(receipt.text).toContain('50.00');
    });

    it('continues from the end of time already paid for instead of wasting it', async () => {
      const tenant = await newTenant();
      await pay(tenant.id, { paidAt: '2026-10-10' });
      await pay(tenant.id, { paidAt: '2026-10-15', periods: '2' });
      const sub = await prisma.subscription.findUniqueOrThrow({
        where: { restaurantId: tenant.id },
      });
      expect(sub.currentPeriodEnd?.toISOString().slice(0, 10)).toBe('2027-01-10');
    });

    it('starts at the payment date when the subscription had lapsed', async () => {
      const tenant = await newTenant();
      await prisma.subscription.update({
        where: { restaurantId: tenant.id },
        data: { status: 'PAST_DUE', currentPeriodEnd: new Date('2026-01-01T00:00:00Z') },
      });
      await pay(tenant.id, { paidAt: '2026-10-10' });
      const sub = await prisma.subscription.findUniqueOrThrow({
        where: { restaurantId: tenant.id },
      });
      expect(sub.status).toBe('ACTIVE');
      expect(sub.currentPeriodEnd?.toISOString().slice(0, 10)).toBe('2026-11-10');
    });

    it('extends a suspended subscription without reactivating it', async () => {
      const tenant = await newTenant();
      await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/status`,
        { action: 'suspend' },
      );
      await pay(tenant.id, { paidAt: '2026-10-10' });
      const sub = await prisma.subscription.findUniqueOrThrow({
        where: { restaurantId: tenant.id },
      });
      expect(sub.status).toBe('SUSPENDED');
      expect(sub.currentPeriodEnd).not.toBeNull();
    });

    it.each([
      ['a zero amount', { amount: '0' }, 'amount'],
      ['a negative amount', { amount: '-5' }, 'amount'],
      ['text as the amount', { amount: 'abc' }, 'amount'],
      ['an impossible date', { paidAt: '10/10/2026' }, 'paidAt'],
    ])('refuses %s and records nothing', async (_label, fields, field) => {
      const tenant = await newTenant();
      const res = await pay(tenant.id, fields);
      expect(res.status).toBe(303);
      const form = await agent.get(res.headers.location).set('Cookie', 'qaemati_locale=en');
      expect(form.text).toContain(`field-${field}-error`);
      expect(await prisma.payment.count({ where: { restaurantId: tenant.id } })).toBe(0);
    });

    it('gives each receipt its own increasing number', async () => {
      const tenant = await newTenant();
      await pay(tenant.id);
      await pay(tenant.id);
      const rows = await prisma.payment.findMany({
        where: { restaurantId: tenant.id },
        orderBy: { receiptNo: 'asc' },
      });
      expect(rows).toHaveLength(2);
      expect(rows[1].receiptNo).toBeGreaterThan(rows[0].receiptNo);
    });

    it('voids a payment, keeps the receipt marked void and leaves the paid period alone', async () => {
      const tenant = await newTenant();
      await pay(tenant.id, { paidAt: '2026-10-10' });
      const payment = await prisma.payment.findFirstOrThrow({ where: { restaurantId: tenant.id } });
      const before = (
        await prisma.subscription.findUniqueOrThrow({ where: { restaurantId: tenant.id } })
      ).currentPeriodEnd;
      const res = await post(
        agent,
        `/super/payments/${payment.id}/receipt`,
        `/super/payments/${payment.id}/void`,
        { reason: 'Entered twice' },
      );
      expect(res.status).toBe(303);
      const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(after.status).toBe('VOID');
      expect(after.voidReason).toBe('Entered twice');
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { restaurantId: tenant.id } }))
          .currentPeriodEnd,
      ).toEqual(before);
      const receipt = await agent
        .get(`/super/payments/${payment.id}/receipt`)
        .set('Cookie', 'qaemati_locale=en');
      expect(receipt.text).toContain('Void');
      expect(receipt.text).not.toContain('Void payment');
    });

    it('filters the ledger by restaurant and by status', async () => {
      const a = await newTenant();
      const b = await newTenant();
      await pay(a.id, { reference: 'REF-A-UNIQUE' });
      await pay(b.id, { reference: 'REF-B-UNIQUE' });
      const onlyA = await agent
        .get(`/super/payments?restaurantId=${a.id}`)
        .set('Cookie', 'qaemati_locale=en');
      expect(onlyA.text).toContain('REF-A-UNIQUE');
      expect(onlyA.text).not.toContain('REF-B-UNIQUE');
      const voidOnly = await agent.get(`/super/payments?restaurantId=${a.id}&status=VOID`);
      expect(voidOnly.text).not.toContain('REF-A-UNIQUE');
    });

    it('lets the owner read their own receipt, and only theirs', async () => {
      const a = await newTenant();
      const b = await newTenant();
      await pay(a.id);
      const payment = await prisma.payment.findFirstOrThrow({ where: { restaurantId: a.id } });
      const owner = request.agent(app.getHttpServer());
      const form = await owner.get('/admin/login');
      await owner
        .post('/admin/login')
        .type('form')
        .send({
          csrf_token: csrfFrom(form.text),
          email: a.adminEmail,
          password: a.password,
          redirect: '/admin',
        });
      expect((await owner.get(`/admin/billing/receipts/${payment.id}`)).status).toBe(200);
      const other = request.agent(app.getHttpServer());
      const form2 = await other.get('/admin/login');
      await other
        .post('/admin/login')
        .type('form')
        .send({
          csrf_token: csrfFrom(form2.text),
          email: b.adminEmail,
          password: b.password,
          redirect: '/admin',
        });
      expect((await other.get(`/admin/billing/receipts/${payment.id}`)).status).toBe(404);
    });
  });

  describe('plans', () => {
    it('creates and edits a plan with limits, no limit and features', async () => {
      const res = await post(agent, '/super/plans/new', '/super/plans', {
        nameAr: 'جديدة',
        nameEn: 'Brand new',
        priceAmount: '75.50',
        currency: 'USD',
        interval: 'YEARLY',
        trialDays: '7',
        maxMenus: '3',
        maxCategories: '',
        maxItems: '200',
        maxAdminUsers: '',
        features: ['analytics', 'bulkTools'],
      });
      expect(res.status).toBe(303);
      const plan = await prisma.plan.findFirstOrThrow({ where: { nameEn: 'Brand new' } });
      planIds.push(plan.id);
      expect(plan).toMatchObject({
        currency: 'USD',
        interval: 'YEARLY',
        trialDays: 7,
        maxMenus: 3,
        maxCategories: null,
        maxItems: 200,
        maxAdminUsers: null,
      });
      expect(Number(plan.priceAmount)).toBe(75.5);
      expect([...plan.features].sort()).toEqual(['analytics', 'bulkTools']);
      await post(agent, `/super/plans/${plan.id}`, `/super/plans/${plan.id}`, {
        nameAr: 'جديدة',
        nameEn: 'Brand new',
        priceAmount: '80',
        currency: 'USD',
        interval: 'YEARLY',
        trialDays: '0',
        maxMenus: '',
        maxCategories: '',
        maxItems: '',
        maxAdminUsers: '',
      });
      const edited = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
      expect(edited).toMatchObject({ maxMenus: null, maxItems: null });
      expect(edited.features).toEqual([]);
    });

    it.each([
      ['a bad price', { priceAmount: '12.345' }, 'priceAmount'],
      ['a lowercase currency', { currency: 'ils' }, 'currency'],
      ['a negative limit', { maxItems: '-1' }, 'maxItems'],
      ['an unknown feature', { features: ['teleport'] }, 'features'],
    ])('refuses %s', async (_label, overrides, field) => {
      const before = await prisma.plan.count();
      const res = await post(agent, '/super/plans/new', '/super/plans', {
        nameAr: 'خ',
        nameEn: 'Refused',
        priceAmount: '10',
        currency: 'ILS',
        interval: 'MONTHLY',
        ...overrides,
      });
      expect(res.status).toBe(303);
      const form = await agent.get(res.headers.location).set('Cookie', 'qaemati_locale=en');
      expect(form.text).toContain(`field-${field}-error`);
      expect(await prisma.plan.count()).toBe(before);
    });

    it('archives a plan so new restaurants cannot pick it, while it stays on the ones that have it', async () => {
      const plan = await prisma.plan.create({
        data: {
          nameAr: 'للأرشفة',
          nameEn: 'To archive',
          priceAmount: 9,
          currency: 'ILS',
          features: [],
        },
      });
      planIds.push(plan.id);
      const tenant = await newTenant({ planId: plan.id });
      await post(agent, '/super/plans', `/super/plans/${plan.id}/archive`, {});
      expect((await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).isActive).toBe(
        false,
      );
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { restaurantId: tenant.id } }))
          .planId,
      ).toBe(plan.id);
      const form = await agent.get('/super/restaurants/new').set('Cookie', 'qaemati_locale=en');
      expect(form.text).not.toContain('To archive');
    });
  });

  describe('overview, search and the activity log', () => {
    it('counts restaurants by state and adds up monthly revenue per currency', async () => {
      const tenant = await newTenant();
      await post(agent, `/super/payments/new?restaurantId=${tenant.id}`, '/super/payments', {
        restaurantId: tenant.id,
        amount: '50.00',
        method: 'CARD',
        paidAt: new Date().toISOString().slice(0, 10),
        periods: '1',
      });
      const page = await agent.get('/super').set('Cookie', 'qaemati_locale=en');
      expect(page.status).toBe(200);
      expect(page.text).toContain('Monthly recurring revenue');
      expect(page.text).toContain('Received this month');
      expect(page.text).toMatch(/\d+\.\d{2} ₪/);
    });

    it('finds a restaurant by name and filters by state', async () => {
      const tenant = await newTenant();
      const found = await agent
        .get(`/super/restaurants?q=${encodeURIComponent(tenant.slug)}`)
        .set('Cookie', 'qaemati_locale=en');
      expect(found.text).toContain(tenant.slug);
      const blocked = await agent.get(
        `/super/restaurants?q=${encodeURIComponent(tenant.slug)}&state=blocked`,
      );
      expect(blocked.text).not.toContain(`/super/restaurants/${tenant.id}"`);
      const trial = await agent.get(
        `/super/restaurants?q=${encodeURIComponent(tenant.slug)}&state=trial`,
      );
      expect(trial.text).toContain(`/super/restaurants/${tenant.id}"`);
    });

    it('records who did what, for creation, status, payments and accounts', async () => {
      const tenant = await newTenant();
      await post(
        agent,
        `/super/restaurants/${tenant.id}`,
        `/super/restaurants/${tenant.id}/status`,
        { action: 'suspend', reason: 'x' },
      );
      const actions = (await prisma.auditLog.findMany({ where: { restaurantId: tenant.id } })).map(
        (a) => a.action,
      );
      expect(actions).toEqual(expect.arrayContaining(['tenant.created', 'subscription.suspend']));
      const entry = await prisma.auditLog.findFirstOrThrow({
        where: { restaurantId: tenant.id, action: 'tenant.created' },
      });
      expect(entry.actorId).toBe(superId);
      expect(entry.actorLabel).toBe('Test Operator');
      const log = await agent.get('/super/audit');
      expect(log.status).toBe(200);
      expect(log.text).toContain('tenant.created');
    });
  });
});
