import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { stepFor, totpAt } from '../src/super-admin/totp';
import {
  createTestApp,
  createTestRestaurant,
  deleteTestRestaurant,
  loginAsAdmin,
} from './utils/test-app';

const PASSWORD = 'Operator@Password123';
const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';
const EN = { Cookie: 'qaemati_locale=en' };

describe('Platform operator security (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: MailService;
  const created: string[] = [];
  let restaurantId: string | undefined;
  let adminEmail: string;
  let seq = 0;

  async function newOperator() {
    const email = `op-${++seq}-${Date.now().toString(36)}@sec-test.example.com`;
    const admin = await prisma.superAdmin.create({
      data: { email, name: `Operator ${seq}`, passwordHash: await bcrypt.hash(PASSWORD, 10) },
    });
    created.push(admin.id);
    return admin;
  }

  const agentOf = () => request.agent(app.getHttpServer());

  async function post(
    client: ReturnType<typeof agentOf>,
    page: string,
    path: string,
    body: Record<string, string> = {},
  ) {
    const form = await client.get(page).set(EN);
    return client
      .post(path)
      .set(EN)
      .type('form')
      .send({ csrf_token: csrfFrom(form.text), ...body });
  }

  /** Password step only. Returns the agent and the response. */
  async function passwordStep(email: string, password = PASSWORD) {
    const client = agentOf();
    const res = await post(client, '/super/login', '/super/login', { email, password });
    return { client, res };
  }

  /** The 6 digit code for the current step, after forgetting the last used one. */
  async function currentCode(adminId: string, secret: string) {
    await prisma.superAdmin.update({ where: { id: adminId }, data: { totpLastStep: null } });
    return totpAt(secret, stepFor(Date.now()));
  }

  async function signedIn(email: string) {
    const { client } = await passwordStep(email);
    return client;
  }

  /** Walks through the real set up pages and returns the secret and recovery codes. */
  async function enableTwoFactor(client: ReturnType<typeof agentOf>, adminId: string) {
    const page = await client.get('/super/security/setup').set(EN);
    const secret = /data-secret[^>]*>([^<]+)</.exec(page.text)![1].replace(/\s+/g, '');
    const res = await post(client, '/super/security', '/super/security/enable', {
      code: totpAt(secret, stepFor(Date.now())),
    });
    expect(res.status).toBe(200);
    const codes = [...res.text.matchAll(/<li>([a-z0-9]{5}-[a-z0-9]{5})<\/li>/g)].map((m) => m[1]);
    expect(codes).toHaveLength(10);
    await prisma.superAdmin.findUniqueOrThrow({ where: { id: adminId } });
    return { secret, codes };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    const { restaurant, admin } = await createTestRestaurant(prisma, 'supersec');
    restaurantId = restaurant.id;
    adminEmail = admin.email;
  });

  afterEach(() => {
    delete process.env.SUPER_REQUIRE_2FA;
    delete process.env.SUPER_ALLOWED_IPS;
  });

  afterAll(async () => {
    if (restaurantId) await deleteTestRestaurant(prisma, restaurantId);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: created } } });
    await prisma.superAdmin.deleteMany({ where: { id: { in: created } } });
    await app.close();
  });

  describe('setting up an authenticator', () => {
    it('shows a QR code and a key, refuses a wrong first code, and enables on the right one', async () => {
      const op = await newOperator();
      const client = await signedIn(op.email);
      const page = await client.get('/super/security/setup').set(EN);
      expect(page.status).toBe(200);
      expect(page.text).toContain('data:image/png;base64');
      const secret = /data-secret[^>]*>([^<]+)</.exec(page.text)![1].replace(/\s+/g, '');
      expect(secret).toMatch(/^[A-Z2-7]{32}$/);

      const wrong = await post(client, '/super/security', '/super/security/enable', {
        code: '000000',
      });
      expect(wrong.status).toBe(422);
      expect(
        (await prisma.superAdmin.findUniqueOrThrow({ where: { id: op.id } })).totpEnabledAt,
      ).toBeNull();

      const ok = await post(client, '/super/security', '/super/security/enable', {
        code: totpAt(secret, stepFor(Date.now())),
      });
      expect(ok.status).toBe(200);
      expect(ok.text).toContain('Recovery codes');
      const stored = await prisma.superAdmin.findUniqueOrThrow({ where: { id: op.id } });
      expect(stored.totpEnabledAt).not.toBeNull();
      expect(stored.totpSecretEnc).not.toContain(secret);
      expect(stored.recoveryCodes).toHaveLength(10);
      const entry = await prisma.auditLog.findFirst({
        where: { actorId: op.id, action: 'super.2fa_enabled' },
      });
      expect(entry).not.toBeNull();
    });

    it('stores only hashes of the recovery codes', async () => {
      const op = await newOperator();
      const { codes } = await enableTwoFactor(await signedIn(op.email), op.id);
      const stored = await prisma.superAdmin.findUniqueOrThrow({ where: { id: op.id } });
      for (const code of codes)
        expect(stored.recoveryCodes.join()).not.toContain(code.replace('-', ''));
    });
  });

  describe('signing in with an authenticator', () => {
    let op: { id: string; email: string };
    let secret: string;
    let codes: string[];

    beforeAll(async () => {
      op = await newOperator();
      ({ secret, codes } = await enableTwoFactor(await signedIn(op.email), op.id));
    });

    it('stops after the password and asks for a code', async () => {
      const { client, res } = await passwordStep(op.email);
      expect(res.headers.location).toBe('/super/login/verify');
      const dash = await client.get('/super');
      expect(dash.status).toBe(302);
      expect(dash.headers.location).toBe('/super/login');
      expect((await client.get('/super/login/verify').set(EN)).text).toContain(
        'Two step verification',
      );
    });

    it('does not ask for a code at all when the password is wrong', async () => {
      const { res } = await passwordStep(op.email, 'wrong-password');
      expect(res.status).toBe(200);
      expect(res.headers.location).toBeUndefined();
    });

    it('lets the right code in and refuses a wrong one', async () => {
      const { client } = await passwordStep(op.email);
      const bad = await post(client, '/super/login/verify', '/super/login/verify', {
        code: '123456',
      });
      expect(bad.status).toBe(200);
      expect(bad.text).toContain('That code is not right');
      expect((await client.get('/super')).status).toBe(302);
      const good = await post(client, '/super/login/verify', '/super/login/verify', {
        code: await currentCode(op.id, secret),
      });
      expect(good.status).toBe(302);
      expect(good.headers.location).toBe('/super');
      expect((await client.get('/super')).status).toBe(200);
    });

    it('does not accept the same code twice', async () => {
      const code = await currentCode(op.id, secret);
      const first = await passwordStep(op.email);
      expect(
        (await post(first.client, '/super/login/verify', '/super/login/verify', { code })).status,
      ).toBe(302);
      const second = await passwordStep(op.email);
      const replay = await post(second.client, '/super/login/verify', '/super/login/verify', {
        code,
      });
      expect(replay.status).toBe(200);
      expect((await second.client.get('/super')).status).toBe(302);
    });

    it('takes a recovery code once, and only once', async () => {
      const first = await passwordStep(op.email);
      const used = await post(first.client, '/super/login/verify', '/super/login/verify', {
        code: codes[0],
      });
      expect(used.status).toBe(302);
      expect(
        (await prisma.superAdmin.findUniqueOrThrow({ where: { id: op.id } })).recoveryCodes,
      ).toHaveLength(9);
      const again = await passwordStep(op.email);
      const refused = await post(again.client, '/super/login/verify', '/super/login/verify', {
        code: codes[0],
      });
      expect(refused.status).toBe(200);
      expect((await again.client.get('/super')).status).toBe(302);
      const other = await passwordStep(op.email);
      const ok = await post(other.client, '/super/login/verify', '/super/login/verify', {
        code: codes[1].toUpperCase().replace('-', ' '),
      });
      expect(ok.status).toBe(302);
    });

    it('locks the code step after repeated wrong codes, even for the right code afterwards', async () => {
      const victim = await newOperator();
      const { secret: victimSecret } = await enableTwoFactor(
        await signedIn(victim.email),
        victim.id,
      );
      const { client } = await passwordStep(victim.email);
      for (let i = 0; i < 5; i++) {
        await post(client, '/super/login/verify', '/super/login/verify', { code: '111111' });
      }
      const late = await post(client, '/super/login/verify', '/super/login/verify', {
        code: await currentCode(victim.id, victimSecret),
      });
      expect(late.status).toBe(200);
      expect(late.text).toContain('Too many attempts');
      expect((await client.get('/super')).status).toBe(302);
    });

    it('sends someone with no pending sign in away from the code page', async () => {
      const client = agentOf();
      const res = await client.get('/super/login/verify');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/super/login');
      const post2 = await post(client, '/super/login', '/super/login/verify', { code: '123456' });
      expect(post2.status).toBe(302);
    });
  });

  describe('requiring it', () => {
    it('keeps an operator without an authenticator on the security page until they set one up', async () => {
      process.env.SUPER_REQUIRE_2FA = 'true';
      const op = await newOperator();
      const client = await signedIn(op.email);
      for (const path of ['/super', '/super/restaurants', '/super/payments']) {
        const res = await client.get(path);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/super/security');
      }
      const page = await client.get('/super/security').set(EN);
      expect(page.status).toBe(200);
      expect(page.text).toContain('Two step verification is required');
      await enableTwoFactor(client, op.id);
      expect((await client.get('/super')).status).toBe(200);
    });

    it('still lets them sign out', async () => {
      process.env.SUPER_REQUIRE_2FA = 'true';
      const op = await newOperator();
      const client = await signedIn(op.email);
      const out = await post(client, '/super/security', '/super/logout');
      expect(out.status).toBe(302);
      expect(out.headers.location).toBe('/super/login');
    });

    it('does not let them turn it off', async () => {
      const op = await newOperator();
      const client = await signedIn(op.email);
      const { secret } = await enableTwoFactor(client, op.id);
      process.env.SUPER_REQUIRE_2FA = 'true';
      await post(client, '/super/security', '/super/security/disable', {
        password: PASSWORD,
        code: await currentCode(op.id, secret),
      });
      expect(
        (await prisma.superAdmin.findUniqueOrThrow({ where: { id: op.id } })).totpEnabledAt,
      ).not.toBeNull();
    });

    it('is optional outside production by default', async () => {
      const op = await newOperator();
      const client = await signedIn(op.email);
      expect((await client.get('/super')).status).toBe(200);
    });
  });

  describe('managing it', () => {
    it('turns off with the password and a code, and refuses a wrong password', async () => {
      const op = await newOperator();
      const client = await signedIn(op.email);
      const { secret } = await enableTwoFactor(client, op.id);
      await post(client, '/super/security', '/super/security/disable', {
        password: 'wrong',
        code: await currentCode(op.id, secret),
      });
      expect(
        (await prisma.superAdmin.findUniqueOrThrow({ where: { id: op.id } })).totpEnabledAt,
      ).not.toBeNull();
      await post(client, '/super/security', '/super/security/disable', {
        password: PASSWORD,
        code: await currentCode(op.id, secret),
      });
      const after = await prisma.superAdmin.findUniqueOrThrow({ where: { id: op.id } });
      expect(after.totpEnabledAt).toBeNull();
      expect(after.totpSecretEnc).toBeNull();
      expect(after.recoveryCodes).toHaveLength(0);
      const { res } = await passwordStep(op.email);
      expect(res.headers.location).toBe('/super');
    });

    it('replaces recovery codes only when given a current code', async () => {
      const op = await newOperator();
      const client = await signedIn(op.email);
      const { secret, codes } = await enableTwoFactor(client, op.id);
      await post(client, '/super/security', '/super/security/recovery', { code: '000000' });
      expect(
        (await prisma.superAdmin.findUniqueOrThrow({ where: { id: op.id } })).recoveryCodes,
      ).toHaveLength(10);
      const fresh = await post(client, '/super/security', '/super/security/recovery', {
        code: await currentCode(op.id, secret),
      });
      const newCodes = [...fresh.text.matchAll(/<li>([a-z0-9]{5}-[a-z0-9]{5})<\/li>/g)].map(
        (m) => m[1],
      );
      expect(newCodes).toHaveLength(10);
      const { client: login } = await passwordStep(op.email);
      const oldTry = await post(login, '/super/login/verify', '/super/login/verify', {
        code: codes[2],
      });
      expect(oldTry.status).toBe(200);
    });
  });

  describe('changing the password', () => {
    it('checks the current password and the new one, then ends every session', async () => {
      const op = await newOperator();
      const client = await signedIn(op.email);
      const other = await signedIn(op.email);
      const hashBefore = (await prisma.superAdmin.findUniqueOrThrow({ where: { id: op.id } }))
        .passwordHash;
      const attempt = (fields: Record<string, string>) =>
        post(client, '/super/security', '/super/security/password', fields);
      await attempt({
        current: 'wrong',
        password: 'A-brand-new-pass-1',
        confirm: 'A-brand-new-pass-1',
      });
      await attempt({ current: PASSWORD, password: 'short', confirm: 'short' });
      await attempt({
        current: PASSWORD,
        password: 'A-brand-new-pass-1',
        confirm: 'something-else-entirely',
      });
      expect(
        (await prisma.superAdmin.findUniqueOrThrow({ where: { id: op.id } })).passwordHash,
      ).toBe(hashBefore);

      const done = await attempt({
        current: PASSWORD,
        password: 'A-brand-new-pass-1',
        confirm: 'A-brand-new-pass-1',
      });
      expect(done.status).toBe(303);
      expect(done.headers.location).toBe('/super/login?reset=1');
      expect((await other.get('/super')).status).toBe(302);
      expect((await client.get('/super')).status).toBe(302);
      expect((await passwordStep(op.email)).res.status).toBe(200);
      expect((await passwordStep(op.email, 'A-brand-new-pass-1')).res.status).toBe(302);
    });
  });

  describe('forgotten passwords', () => {
    beforeEach(() => {
      mail.outbox.length = 0;
    });

    const linkFor = (to: string, area: string) =>
      new RegExp(`/${area}/reset/([a-f0-9]{64})`).exec(
        [...mail.outbox].reverse().find((m) => m.to === to)?.text ?? '',
      )?.[1];

    it('mails an operator a link that works only on the platform side', async () => {
      const op = await newOperator();
      const client = agentOf();
      const res = await post(client, '/super/forgot', '/super/forgot', { email: op.email });
      expect(res.status).toBe(200);
      const token = linkFor(op.email, 'super')!;
      expect(token).toBeDefined();
      expect((await request(app.getHttpServer()).get(`/admin/reset/${token}`)).status).toBe(410);
      expect((await request(app.getHttpServer()).get(`/super/reset/${token}`)).status).toBe(200);
    });

    it('answers the same for an address that is not an operator, and does not mail owners', async () => {
      const client = agentOf();
      await post(client, '/super/forgot', '/super/forgot', { email: adminEmail });
      await post(client, '/super/forgot', '/super/forgot', {
        email: 'nobody@sec-test.example.com',
      });
      expect(mail.outbox).toHaveLength(0);
    });

    it('does not accept an owner link on the platform side', async () => {
      const client = agentOf();
      const page = await client.get('/admin/forgot');
      await client
        .post('/admin/forgot')
        .type('form')
        .send({ csrf_token: csrfFrom(page.text), email: adminEmail });
      const token = linkFor(adminEmail, 'admin')!;
      expect((await request(app.getHttpServer()).get(`/super/reset/${token}`)).status).toBe(410);
    });

    it('sets a new password of at least 12 characters, and leaves the authenticator in force', async () => {
      const op = await newOperator();
      const { secret } = await enableTwoFactor(await signedIn(op.email), op.id);
      const client = agentOf();
      await post(client, '/super/forgot', '/super/forgot', { email: op.email });
      const token = linkFor(op.email, 'super')!;
      const short = await post(client, '/super/forgot', `/super/reset/${token}`, {
        password: 'only-11-ch',
        confirm: 'only-11-ch',
      });
      expect(short.status).toBe(422);
      const done = await post(client, '/super/forgot', `/super/reset/${token}`, {
        password: 'A-new-operator-pass-9',
        confirm: 'A-new-operator-pass-9',
      });
      expect(done.headers.location).toBe('/super/login?reset=1');
      expect((await request(app.getHttpServer()).get(`/super/reset/${token}`)).status).toBe(410);

      const { client: signIn, res } = await passwordStep(op.email, 'A-new-operator-pass-9');
      expect(res.headers.location).toBe('/super/login/verify');
      expect((await signIn.get('/super')).status).toBe(302);
      const ok = await post(signIn, '/super/login/verify', '/super/login/verify', {
        code: await currentCode(op.id, secret),
      });
      expect(ok.headers.location).toBe('/super');
    });
  });

  describe('limiting where it can be reached from', () => {
    it('answers 404 to every other address, and normally to a listed one', async () => {
      process.env.SUPER_ALLOWED_IPS = '203.0.113.9';
      for (const path of ['/super/login', '/super', '/super/forgot']) {
        expect((await request(app.getHttpServer()).get(path)).status).toBe(404);
      }
      process.env.SUPER_ALLOWED_IPS = '127.0.0.1, ::1';
      expect((await request(app.getHttpServer()).get('/super/login')).status).toBe(200);
    });

    it('never affects a restaurant owner or the public menu', async () => {
      process.env.SUPER_ALLOWED_IPS = '203.0.113.9';
      const owner = await loginAsAdmin(app, adminEmail);
      expect((await owner.get('/admin')).status).toBe(200);
      expect((await request(app.getHttpServer()).get('/')).status).toBe(200);
    });
  });
});
