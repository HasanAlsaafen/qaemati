import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { RATE_LIMIT_STORE, RateLimitStore } from '../src/common/rate-limit/rate-limit-store';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestRestaurant, deleteTestRestaurant } from './utils/test-app';

const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';
const ENV_KEYS = ['SIGNUP_ENABLED', 'NODE_ENV', 'SIGNUP_MIN_FILL_MS'];

describe('Self sign up (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: MailService;
  let limits: RateLimitStore;
  let trialPlanId: string;
  let archivedPlanId: string;
  const created: string[] = [];
  const saved: Record<string, string | undefined> = {};
  let seq = 0;
  const tag = Date.now().toString(36);

  const slugFor = () => `signup-${tag}-${++seq}`;
  const emailFor = () =>
    `owner-${tag}-${seq}-${Math.random().toString(36).slice(2, 6)}@signup.example.com`;

  function form(overrides: Record<string, string> = {}) {
    const slug = slugFor();
    return {
      nameAr: 'مطعم الاختبار',
      nameEn: `Signup ${slug}`,
      slug,
      planId: trialPlanId,
      ownerName: 'Test Owner',
      email: emailFor(),
      password: 'A-good-password-1',
      confirm: 'A-good-password-1',
      website: '',
      ...overrides,
    };
  }

  async function submit(body: Record<string, string>, lang = 'en') {
    const agent = request.agent(app.getHttpServer());
    const page = await agent.get('/signup').set('Cookie', `qaemati_locale=${lang}`);
    const res = await agent
      .post('/signup')
      .set('Cookie', `qaemati_locale=${lang}`)
      .type('form')
      .send({ csrf_token: csrfFrom(page.text), ...body });
    return { agent, res, page };
  }

  const linkTo = (email: string): string | undefined =>
    /\/signup\/verify\/([a-f0-9]{64})/.exec(
      [...mail.outbox].reverse().find((m) => m.to === email)?.text ?? '',
    )?.[1];

  async function resetLimits() {
    for (const ip of ['127.0.0.1', '::ffff:127.0.0.1', '::1'])
      await limits.reset(`signup-ip:${ip}`);
  }

  beforeAll(async () => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.SIGNUP_MIN_FILL_MS = '0';
    app = await createTestApp();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    limits = app.get<RateLimitStore>(RATE_LIMIT_STORE);
    trialPlanId = (
      await prisma.plan.create({
        data: {
          nameAr: 'تجربة',
          nameEn: `Signup plan ${tag}`,
          priceAmount: 25,
          currency: 'ILS',
          trialDays: 14,
          features: ['tableOrdering'],
        },
      })
    ).id;
    archivedPlanId = (
      await prisma.plan.create({
        data: {
          nameAr: 'قديمة',
          nameEn: `Signup archived ${tag}`,
          priceAmount: 99,
          currency: 'ILS',
          isActive: false,
          features: [],
        },
      })
    ).id;
  });

  beforeEach(async () => {
    process.env.SIGNUP_MIN_FILL_MS = '0';
    mail.outbox.length = 0;
    await resetLimits();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  afterAll(async () => {
    const restaurants = await prisma.restaurant.findMany({
      where: { slug: { startsWith: `signup-${tag}` } },
      select: { id: true },
    });
    for (const r of restaurants) await deleteTestRestaurant(prisma, r.id);
    for (const id of created) await deleteTestRestaurant(prisma, id);
    await prisma.signupRequest.deleteMany({ where: { slug: { startsWith: `signup-${tag}` } } });
    await prisma.plan.deleteMany({ where: { id: { in: [trialPlanId, archivedPlanId] } } });
    await app.close();
  });

  describe('the form', () => {
    it('lists the plans a restaurant can start on, with the trial, and not archived ones', async () => {
      const res = await request(app.getHttpServer())
        .get('/signup')
        .set('Cookie', 'qaemati_locale=en');
      expect(res.status).toBe(200);
      expect(res.text).toContain(`Signup plan ${tag}`);
      expect(res.text).toContain('14 days free');
      expect(res.text).not.toContain(`Signup archived ${tag}`);
      expect(res.text).toContain('name="website"');
      expect(res.text).toContain('/js/signup.js');
    });

    it('preselects the plan chosen on the landing page', async () => {
      const res = await request(app.getHttpServer()).get(`/signup?plan=${trialPlanId}`);
      expect(res.text).toMatch(new RegExp(`value="${trialPlanId}"[^>]*checked`));
    });

    it('is in Arabic for an Arabic reader', async () => {
      const res = await request(app.getHttpServer())
        .get('/signup')
        .set('Cookie', 'qaemati_locale=ar');
      expect(res.text).toContain('أنشئ مطعمك');
    });

    it('can be closed, and then the landing page stops offering it', async () => {
      process.env.SIGNUP_ENABLED = 'false';
      expect((await request(app.getHttpServer()).get('/signup')).status).toBe(404);
      const home = await request(app.getHttpServer()).get('/').set('Cookie', 'qaemati_locale=en');
      expect(home.text).not.toContain('href="/signup"');
    });

    it('is closed in production until email works, since the confirmation link is the only way in', async () => {
      process.env.NODE_ENV = 'production';
      expect((await request(app.getHttpServer()).get('/signup')).status).toBe(404);
    });

    it('is what the landing page sends visitors to when it is open', async () => {
      const home = await request(app.getHttpServer()).get('/').set('Cookie', 'qaemati_locale=en');
      expect(home.text).toContain('href="/signup"');
      expect(home.text).toContain(`href="/signup?plan=${trialPlanId}"`);
    });

    it('keeps the confirmation links out of search results', async () => {
      expect((await request(app.getHttpServer()).get('/robots.txt')).text).toContain(
        'Disallow: /signup/verify',
      );
    });

    it('needs the CSRF token like every form', async () => {
      const res = await request(app.getHttpServer()).post('/signup').type('form').send(form());
      expect(res.status).toBe(403);
    });
  });

  describe('asking to sign up', () => {
    it('creates nothing yet, only a pending request and an email with a link', async () => {
      const body = form();
      const { res } = await submit(body);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Check your email');
      expect(await prisma.restaurant.count({ where: { slug: body.slug } })).toBe(0);
      expect(await prisma.adminUser.count({ where: { email: body.email } })).toBe(0);
      const pending = await prisma.signupRequest.findFirstOrThrow({ where: { slug: body.slug } });
      expect(pending.email).toBe(body.email);
      expect(pending.passwordHash).not.toContain(body.password);
      expect(await bcrypt.compare(body.password, pending.passwordHash)).toBe(true);
      const token = linkTo(body.email)!;
      expect(token).toBeDefined();
      expect(pending.tokenHash).not.toContain(token);
    });

    it('writes the email in the language of the visitor', async () => {
      const body = form();
      await submit(body, 'ar');
      const message = mail.outbox.find((m) => m.to === body.email)!;
      expect(message.subject).toContain('أكّد');
      expect(message.html).toContain('dir="rtl"');
    });

    it.each([
      ['an invalid address', { slug: 'Bad Slug!' }, 'slug'],
      ['a missing Arabic name', { nameAr: '' }, 'nameAr'],
      ['an invalid email', { email: 'not-an-email' }, 'email'],
      ['a short password', { password: 'short', confirm: 'short' }, 'password'],
      ['passwords that differ', { confirm: 'a-different-one-1' }, 'confirm'],
      ['a plan that does not exist', { planId: 'nope' }, 'planId'],
      ['an archived plan', { planId: '__archived__' }, 'planId'],
    ])(
      'refuses %s with a message on that field and creates nothing',
      async (_label, overrides: Record<string, string>, field) => {
        const body = form({
          ...overrides,
          ...(overrides.planId === '__archived__' ? { planId: archivedPlanId } : {}),
        });
        const { res } = await submit(body);
        expect(res.status).toBe(422);
        expect(res.text).toContain('role="alert"');
        expect(res.text).toMatch(new RegExp(`name="${field}"|name="planId"`));
        expect(await prisma.signupRequest.count({ where: { slug: body.slug } })).toBe(0);
        expect(mail.outbox.filter((m) => m.to === body.email)).toHaveLength(0);
      },
    );

    it('keeps what was typed, except the passwords', async () => {
      const body = form({
        slug: 'Bad Slug!',
        ownerName: 'Kept Owner',
        password: 'secret-password-1',
        confirm: 'secret-password-1',
      });
      const { res } = await submit(body);
      expect(res.text).toContain('value="Kept Owner"');
      expect(res.text).not.toContain('secret-password-1');
    });

    it('refuses an address that is taken, reserved or waiting for another person', async () => {
      const first = form();
      await submit(first);
      const takenByPending = await submit(form({ slug: first.slug }));
      expect(takenByPending.res.status).toBe(422);
      expect(takenByPending.res.text).toContain('already used');

      const { restaurant } = await createTestRestaurant(prisma, `signup-taken-${tag}`);
      created.push(restaurant.id);
      const taken = await submit(form({ slug: restaurant.slug }));
      expect(taken.res.text).toContain('already used');

      const reserved = await submit(form({ slug: 'admin' }));
      expect(reserved.res.text).toContain('reserved');
    });

    it('lets the same person ask again, replacing the earlier request', async () => {
      const body = form();
      await submit(body);
      const firstLink = linkTo(body.email)!;
      mail.outbox.length = 0;
      await submit({ ...body, slug: body.slug });
      expect(await prisma.signupRequest.count({ where: { email: body.email } })).toBe(1);
      const secondLink = linkTo(body.email)!;
      expect(secondLink).not.toBe(firstLink);
      expect((await request(app.getHttpServer()).get(`/signup/verify/${firstLink}`)).status).toBe(
        410,
      );
      expect((await request(app.getHttpServer()).get(`/signup/verify/${secondLink}`)).status).toBe(
        200,
      );
    });
  });

  describe('an email that already has an account', () => {
    it('gets the same answer as anyone else, and is told by email instead', async () => {
      const { restaurant, admin } = await createTestRestaurant(prisma, `signup-known-${tag}`);
      created.push(restaurant.id);
      const freshBody = form();
      const known = await submit(form({ email: admin.email }));
      const fresh = await submit(freshBody);
      expect(known.res.status).toBe(fresh.res.status);
      const normalize = (html: string, email: string) =>
        html.replace(csrfFrom(html), '').split(email).join('EMAIL').replace(/\s+/g, ' ');
      expect(normalize(known.res.text, admin.email)).toBe(
        normalize(fresh.res.text, freshBody.email),
      );
      expect(await prisma.signupRequest.count({ where: { email: admin.email } })).toBe(0);
      const note = mail.outbox.find((m) => m.to === admin.email)!;
      expect(note.subject).toContain('already have an account');
      expect(note.text).not.toContain('/signup/verify/');
    });

    it('also does not let a platform operator email be used', async () => {
      const email = emailFor();
      const op = await prisma.superAdmin.create({
        data: { email, name: 'Op', passwordHash: await bcrypt.hash('x', 4) },
      });
      try {
        await submit(form({ email }));
        expect(await prisma.signupRequest.count({ where: { email } })).toBe(0);
      } finally {
        await prisma.superAdmin.delete({ where: { id: op.id } });
      }
    });
  });

  describe('confirming', () => {
    async function pending() {
      const body = form();
      await submit(body);
      return { body, token: linkTo(body.email)! };
    }

    it('shows what will be created and does not create it just by opening the link', async () => {
      const { body, token } = await pending();
      const res = await request(app.getHttpServer())
        .get(`/signup/verify/${token}`)
        .set('Cookie', 'qaemati_locale=en');
      expect(res.status).toBe(200);
      expect(res.text).toContain(`/m/${body.slug}`);
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(await prisma.restaurant.count({ where: { slug: body.slug } })).toBe(0);
      expect(await prisma.signupRequest.count({ where: { slug: body.slug } })).toBe(1);
    });

    it('creates the restaurant, its menu, a trial and an owner, and signs the owner in', async () => {
      const { body, token } = await pending();
      const agent = request.agent(app.getHttpServer());
      const page = await agent.get(`/signup/verify/${token}`);
      const res = await agent
        .post(`/signup/verify/${token}`)
        .type('form')
        .send({ csrf_token: csrfFrom(page.text) });
      expect(res.status).toBe(303);
      expect(res.headers.location).toBe('/admin');

      const restaurant = await prisma.restaurant.findUniqueOrThrow({
        where: { slug: body.slug },
        include: { menus: true, subscription: true, adminUsers: true },
      });
      expect(restaurant.menus).toHaveLength(1);
      expect(restaurant.subscription).toMatchObject({ status: 'TRIALING', planId: trialPlanId });
      const days = (restaurant.subscription!.trialEndsAt!.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(13);
      expect(days).toBeLessThanOrEqual(14);
      expect(restaurant.adminUsers).toHaveLength(1);
      expect(restaurant.adminUsers[0]).toMatchObject({
        email: body.email,
        role: 'OWNER',
        name: body.ownerName,
      });
      expect(await prisma.signupRequest.count({ where: { slug: body.slug } })).toBe(0);

      expect((await agent.get('/admin')).status).toBe(200);
      expect((await agent.get('/admin/team')).status).toBe(200);
    });

    it('lets the owner sign in later with the password they chose', async () => {
      const { body, token } = await pending();
      const agent = request.agent(app.getHttpServer());
      const page = await agent.get(`/signup/verify/${token}`);
      await agent
        .post(`/signup/verify/${token}`)
        .type('form')
        .send({ csrf_token: csrfFrom(page.text) });
      const again = request.agent(app.getHttpServer());
      const login = await again.get('/admin/login');
      const res = await again
        .post('/admin/login')
        .type('form')
        .send({
          csrf_token: csrfFrom(login.text),
          email: body.email,
          password: body.password,
          redirect: '/admin',
        });
      expect(res.status).toBe(302);
      expect((await again.get('/admin')).status).toBe(200);
    });

    it('works only once, even when opened twice at the same moment', async () => {
      const { body, token } = await pending();
      const a = request.agent(app.getHttpServer());
      const b = request.agent(app.getHttpServer());
      const [pa, pb] = await Promise.all([
        a.get(`/signup/verify/${token}`),
        b.get(`/signup/verify/${token}`),
      ]);
      const results = await Promise.all([
        a
          .post(`/signup/verify/${token}`)
          .type('form')
          .send({ csrf_token: csrfFrom(pa.text) }),
        b
          .post(`/signup/verify/${token}`)
          .type('form')
          .send({ csrf_token: csrfFrom(pb.text) }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([303, 410]);
      expect(await prisma.restaurant.count({ where: { slug: body.slug } })).toBe(1);
    });

    it('refuses an unknown, malformed or expired link', async () => {
      for (const token of ['a'.repeat(64), 'nope', 'not-a-token-at-all']) {
        expect((await request(app.getHttpServer()).get(`/signup/verify/${token}`)).status).toBe(
          410,
        );
      }
      const { body, token } = await pending();
      await prisma.signupRequest.updateMany({
        where: { slug: body.slug },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await request(app.getHttpServer()).get(`/signup/verify/${token}`)).status).toBe(410);
      const agent = request.agent(app.getHttpServer());
      const page = await agent.get('/signup');
      const res = await agent
        .post(`/signup/verify/${token}`)
        .type('form')
        .send({ csrf_token: csrfFrom(page.text) });
      expect(res.status).toBe(410);
      expect(await prisma.restaurant.count({ where: { slug: body.slug } })).toBe(0);
    });

    it('says so when the address was taken while the person was away, and creates nothing twice', async () => {
      const { body, token } = await pending();
      const { restaurant } = await createTestRestaurant(prisma, `x-${body.slug}`);
      await prisma.restaurant.update({ where: { id: restaurant.id }, data: { slug: body.slug } });
      created.push(restaurant.id);
      const agent = request.agent(app.getHttpServer());
      const page = await agent.get(`/signup/verify/${token}`);
      const res = await agent
        .post(`/signup/verify/${token}`)
        .type('form')
        .send({ csrf_token: csrfFrom(page.text) });
      expect(res.status).toBe(409);
      expect(res.text).toMatch(/taken meanwhile|أُخذ هذا العنوان/);
      expect(await prisma.restaurant.count({ where: { slug: body.slug } })).toBe(1);
    });

    it('needs the CSRF token to create', async () => {
      const { token } = await pending();
      const res = await request(app.getHttpServer())
        .post(`/signup/verify/${token}`)
        .type('form')
        .send({});
      expect(res.status).toBe(403);
    });
  });

  describe('scripts', () => {
    it('is told it worked when it fills the hidden field, and nothing happens', async () => {
      const body = form({ website: 'http://spam.example.com' });
      const { res } = await submit(body);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Check your email');
      expect(await prisma.signupRequest.count({ where: { slug: body.slug } })).toBe(0);
      expect(mail.outbox.filter((m) => m.to === body.email)).toHaveLength(0);
    });

    it('is told it worked when it posts faster than a person could, and nothing happens', async () => {
      process.env.SIGNUP_MIN_FILL_MS = '60000';
      const body = form();
      const { res } = await submit(body);
      expect(res.status).toBe(200);
      expect(await prisma.signupRequest.count({ where: { slug: body.slug } })).toBe(0);
      expect(mail.outbox.filter((m) => m.to === body.email)).toHaveLength(0);
    });

    it('is stopped after a handful of requests from one address', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 8; i++) statuses.push((await submit(form())).res.status);
      expect(statuses.slice(0, 6)).toEqual(Array(6).fill(200));
      expect(statuses.slice(6)).toEqual([429, 429]);
    });

    it('cannot fill one inbox with confirmation emails', async () => {
      const target = emailFor();
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) {
        await resetLimits();
        statuses.push((await submit(form({ email: target }))).res.status);
      }
      expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
      expect(statuses.slice(3)).toEqual([429, 429]);
      expect(mail.outbox.filter((m) => m.to === target).length).toBeLessThanOrEqual(3);
    });
  });
});
