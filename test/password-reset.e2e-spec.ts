import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { LoginRateLimiter } from '../src/auth/login-rate-limiter';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
  TEST_ADMIN_PASSWORD,
} from './utils/test-app';

const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';
const NEW_PASSWORD = 'Brand-New-Pass-42';

describe('Password reset and invitation email (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: MailService;
  let limiter: LoginRateLimiter;
  let restaurantId: string;
  let email: string;
  let adminId: string;
  const extraRestaurants: string[] = [];

  const lastLink = (to: string) => {
    const message = [...mail.outbox].reverse().find((m) => m.to === to);
    return /https?:\/\/[^\s"<]+\/admin\/reset\/([a-f0-9]{64})/.exec(message?.text ?? '')?.[1];
  };

  async function forgot(address: string) {
    const client = request.agent(app.getHttpServer());
    const page = await client.get('/admin/forgot').set('Cookie', 'qaemati_locale=en');
    return client
      .post('/admin/forgot')
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), email: address });
  }

  async function submitReset(token: string, fields: Record<string, string>) {
    const client = request.agent(app.getHttpServer());
    const page = await client.get('/admin/forgot').set('Cookie', 'qaemati_locale=en');
    return client
      .post(`/admin/reset/${token}`)
      .set('Cookie', 'qaemati_locale=en')
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), ...fields });
  }

  async function canSignIn(address: string, password: string) {
    const client = request.agent(app.getHttpServer());
    const page = await client.get('/admin/login');
    const res = await client
      .post('/admin/login')
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), email: address, password, redirect: '/admin' });
    return res.status === 302;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    limiter = app.get(LoginRateLimiter);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'pwreset');
    restaurantId = restaurant.id;
    email = admin.email;
    adminId = admin.id;
  });

  afterAll(async () => {
    for (const id of [restaurantId, ...extraRestaurants]) await deleteTestRestaurant(prisma, id);
    await app.close();
  });

  beforeEach(async () => {
    mail.outbox.length = 0;
    await limiter.reset(`forgot-email:${email}`);
    for (const ip of ['::ffff:127.0.0.1', '127.0.0.1', '::1']) await limiter.reset(`forgot:${ip}`);
  });

  it('links to the forgot page from the sign in page', async () => {
    const res = await request(app.getHttpServer()).get('/admin/login?lang=en');
    expect(res.text).toContain('href="/admin/forgot"');
  });

  it('answers the same for an unknown address and a known one, and mails only the known one', async () => {
    const known = await forgot(email);
    const unknown = await forgot('nobody-here@test.example.com');
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    const strip = (html: string, address: string) =>
      html.replace(csrfFrom(html), '').replaceAll(address, '').replace(/\s+/g, ' ');
    expect(strip(known.text, email)).toBe(strip(unknown.text, 'nobody-here@test.example.com'));
    expect(mail.outbox).toHaveLength(1);
    expect(mail.outbox[0].to).toBe(email);
  });

  it('keeps only a hash of the link in the database', async () => {
    await forgot(email);
    const token = lastLink(email)!;
    expect(token).toBeDefined();
    const rows = await prisma.passwordResetToken.findMany({ where: { adminUserId: adminId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toContain(token);
  });

  it('lets the owner choose a new password once, then the old one and the link stop working', async () => {
    await forgot(email);
    const token = lastLink(email)!;
    const done = await submitReset(token, { password: NEW_PASSWORD, confirm: NEW_PASSWORD });
    expect(done.status).toBe(303);
    expect(done.headers.location).toBe('/admin/login?reset=1');
    expect(await canSignIn(email, NEW_PASSWORD)).toBe(true);
    expect(await canSignIn(email, TEST_ADMIN_PASSWORD)).toBe(false);
    expect((await request(app.getHttpServer()).get(`/admin/reset/${token}`)).status).toBe(410);
    expect(await prisma.passwordResetToken.count({ where: { adminUserId: adminId } })).toBe(0);
    const login = await request(app.getHttpServer()).get('/admin/login?reset=1&lang=en');
    expect(login.text).toContain('Your password was changed');
  });

  it('signs the account out of sessions that were open before the change', async () => {
    const open = await loginAsAdmin(app, email, NEW_PASSWORD);
    expect((await open.get('/admin')).status).toBe(200);
    await forgot(email);
    await submitReset(lastLink(email)!, {
      password: TEST_ADMIN_PASSWORD,
      confirm: TEST_ADMIN_PASSWORD,
    });
    const after = await open.get('/admin');
    expect(after.status).toBe(302);
    expect(after.headers.location).toContain('/admin/login');
  });

  it.each([
    ['too short', { password: 'short', confirm: 'short' }, 'at least 10'],
    [
      'not matching',
      { password: 'a-long-enough-one', confirm: 'a-different-one-x' },
      'do not match',
    ],
  ])('refuses a password that is %s and leaves the account alone', async (_label, fields, text) => {
    await forgot(email);
    const token = lastLink(email)!;
    const res = await submitReset(token, fields);
    expect(res.status).toBe(422);
    expect(res.text).toContain(text);
    expect(await canSignIn(email, TEST_ADMIN_PASSWORD)).toBe(true);
    expect((await request(app.getHttpServer()).get(`/admin/reset/${token}`)).status).toBe(200);
  });

  it('rejects an unknown, malformed or expired link', async () => {
    expect((await request(app.getHttpServer()).get(`/admin/reset/${'a'.repeat(64)}`)).status).toBe(
      410,
    );
    expect((await request(app.getHttpServer()).get('/admin/reset/nope')).status).toBe(410);
    await forgot(email);
    const token = lastLink(email)!;
    await prisma.passwordResetToken.updateMany({
      where: { adminUserId: adminId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await request(app.getHttpServer()).get(`/admin/reset/${token}`)).status).toBe(410);
    const res = await submitReset(token, { password: NEW_PASSWORD, confirm: NEW_PASSWORD });
    expect(res.status).toBe(410);
    expect(await canSignIn(email, NEW_PASSWORD)).toBe(false);
  });

  it('cancels an older link when a newer one is requested', async () => {
    await forgot(email);
    const first = lastLink(email)!;
    await forgot(email);
    const second = lastLink(email)!;
    expect(second).not.toBe(first);
    expect((await request(app.getHttpServer()).get(`/admin/reset/${first}`)).status).toBe(410);
    expect((await request(app.getHttpServer()).get(`/admin/reset/${second}`)).status).toBe(200);
  });

  it('stops mailing one address after repeated requests', async () => {
    mail.outbox.length = 0;
    for (let i = 0; i < 8; i++) await forgot(email);
    expect(mail.outbox.length).toBeLessThanOrEqual(5);
  });

  it("writes the mail in the owner's language and never puts the password in it", async () => {
    const client = request.agent(app.getHttpServer());
    const page = await client.get('/admin/forgot').set('Cookie', 'qaemati_locale=ar');
    mail.outbox.length = 0;
    await client
      .post('/admin/forgot')
      .set('Cookie', 'qaemati_locale=ar')
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), email: `  ${email.toUpperCase()}  ` });
    expect(mail.outbox).toHaveLength(1);
    expect(mail.outbox[0].subject).toBe('إعادة تعيين كلمة المرور');
    expect(mail.outbox[0].html).toContain('dir="rtl"');
    expect(mail.outbox[0].text).not.toContain(TEST_ADMIN_PASSWORD);
  });

  describe('invitations from the platform area', () => {
    let superId: string;
    let planId: string;
    let agent: ReturnType<typeof request.agent>;
    const superEmail = `super-mail-${Date.now().toString(36)}@test.example.com`;

    beforeAll(async () => {
      superId = (
        await prisma.superAdmin.create({
          data: {
            email: superEmail,
            name: 'Mail Operator',
            passwordHash: await bcrypt.hash('Super@Password123', 10),
          },
        })
      ).id;
      planId = (
        await prisma.plan.create({
          data: { nameAr: 'م', nameEn: 'Mail plan', priceAmount: 1, currency: 'ILS', features: [] },
        })
      ).id;
      agent = request.agent(app.getHttpServer());
      const page = await agent.get('/super/login');
      await agent
        .post('/super/login')
        .type('form')
        .send({
          csrf_token: csrfFrom(page.text),
          email: superEmail,
          password: 'Super@Password123',
        });
    });

    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { actorId: superId } });
      await prisma.plan.delete({ where: { id: planId } });
      await prisma.superAdmin.delete({ where: { id: superId } });
    });

    async function superPost(page: string, path: string, body: Record<string, string>) {
      const form = await agent.get(page).set('Cookie', 'qaemati_locale=en');
      return agent
        .post(path)
        .set('Cookie', 'qaemati_locale=en')
        .type('form')
        .send({ csrf_token: csrfFrom(form.text), ...body });
    }

    it('emails a new owner a link to choose a password, and the link works', async () => {
      const owner = `invited-${Date.now().toString(36)}@test.example.com`;
      const slug = `mail-inv-${Date.now().toString(36)}`;
      const res = await superPost('/super/restaurants/new', '/super/restaurants', {
        nameAr: 'م',
        nameEn: 'Invited Cafe',
        slug,
        planId,
        startMode: 'TRIAL',
        adminName: 'Invitee',
        adminEmail: owner,
      });
      expect(res.status).toBe(303);
      const created = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });
      extraRestaurants.push(created.id);
      const message = mail.outbox.find((m) => m.to === owner)!;
      expect(message.subject).toContain('Invited Cafe');
      const token = lastLink(owner)!;
      expect(token).toBeDefined();
      const page = await agent.get(res.headers.location).set('Cookie', 'qaemati_locale=en');
      expect(page.text).toContain(`A sign in link was also emailed to ${owner}`);
      const done = await submitReset(token, { password: NEW_PASSWORD, confirm: NEW_PASSWORD });
      expect(done.status).toBe(303);
      expect(await canSignIn(owner, NEW_PASSWORD)).toBe(true);
    });

    it('emails a reset link when the operator resets an owner password', async () => {
      const res = await superPost(
        `/super/restaurants/${restaurantId}`,
        `/super/restaurants/${restaurantId}/admins/${adminId}/reset-password`,
        {},
      );
      expect(res.status).toBe(303);
      expect(mail.outbox.some((m) => m.to === email)).toBe(true);
      expect(lastLink(email)).toBeDefined();
    });
  });
});
