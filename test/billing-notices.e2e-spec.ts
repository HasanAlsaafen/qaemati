import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { BillingNotifier } from '../src/billing-notices/billing-notifier.service';
import { BillingScheduler } from '../src/billing-notices/billing-scheduler';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestRestaurant, deleteTestRestaurant } from './utils/test-app';

const DAY = 24 * 60 * 60 * 1000;
const csrfFrom = (html: string) => /name="csrf_token" value="([^"]*)"/.exec(html)?.[1] ?? '';

describe('Renewal reminders and receipt emails (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: MailService;
  let notifier: BillingNotifier;
  let planId: string;
  const ids: string[] = [];
  const now = new Date('2026-11-10T09:00:00Z');
  const at = (days: number) => new Date(now.getTime() + days * DAY);
  let seq = 0;

  /** A restaurant with one owner, a cashier, and a subscription in the given state. */
  async function tenant(
    subscription: {
      status?: 'TRIALING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELED' | 'PAST_DUE';
      trialEndsAt?: Date;
      currentPeriodEnd?: Date;
      graceDays?: number;
    } | null,
    owners = 1,
  ) {
    const fixture = await createTestRestaurant(
      prisma,
      `notices-${++seq}-${Date.now().toString(36)}`,
    );
    const id = fixture.restaurant.id;
    ids.push(id);
    const ownerEmails = [fixture.admin.email];
    for (let i = 1; i < owners; i++) {
      const email = `owner${i}-${seq}-${Date.now().toString(36)}@notices.example.com`;
      await prisma.adminUser.create({
        data: {
          restaurantId: id,
          email,
          name: 'Co owner',
          passwordHash: await bcrypt.hash('x', 4),
          role: 'OWNER',
        },
      });
      ownerEmails.push(email);
    }
    const cashierEmail = `cashier-${seq}-${Date.now().toString(36)}@notices.example.com`;
    await prisma.adminUser.create({
      data: {
        restaurantId: id,
        email: cashierEmail,
        name: 'Cashier',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'CASHIER',
      },
    });
    if (subscription) {
      await prisma.subscription.create({
        data: { restaurantId: id, planId, status: 'ACTIVE', graceDays: 7, ...subscription },
      });
    }
    return { id, ownerEmails, cashierEmail };
  }

  const mailedTo = (email: string) => mail.outbox.filter((m) => m.to === email);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    notifier = app.get(BillingNotifier);
    planId = (
      await prisma.plan.create({
        data: {
          nameAr: 'باقة الاختبار',
          nameEn: `Reminder plan ${Date.now()}`,
          priceAmount: 40,
          currency: 'ILS',
          features: [],
        },
      })
    ).id;
  });

  beforeEach(() => {
    mail.outbox.length = 0;
  });

  afterAll(async () => {
    for (const id of ids) await deleteTestRestaurant(prisma, id);
    await prisma.plan.delete({ where: { id: planId } });
    await app.close();
  });

  it('is not started in tests, and can be switched off in production', () => {
    expect(BillingScheduler.enabled()).toBe(false);
    const saved = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.REMINDERS_ENABLED = 'false';
    expect(BillingScheduler.enabled()).toBe(false);
    delete process.env.REMINDERS_ENABLED;
    expect(BillingScheduler.enabled()).toBe(true);
    process.env = saved;
  });

  it('sends a reminder 7 days ahead, in both languages, to the owner only', async () => {
    const t = await tenant({ currentPeriodEnd: at(6) });
    const summary = await notifier.runReminders(now);
    expect(summary.sent).toBeGreaterThanOrEqual(1);
    const [message] = mailedTo(t.ownerEmails[0]);
    expect(message.subject).toContain('تنتهي باقة');
    expect(message.subject).toContain('plan ends on');
    expect(message.text).toContain('باقة الاختبار');
    expect(message.text).toContain('---');
    expect(message.html).toContain('dir="rtl"');
    expect(message.html).toContain('dir="ltr"');
    expect(mailedTo(t.cashierEmail)).toHaveLength(0);
  });

  it('sends to every owner of the restaurant and to nobody else', async () => {
    const t = await tenant({ currentPeriodEnd: at(3) }, 2);
    await notifier.runReminders(now);
    for (const email of t.ownerEmails) expect(mailedTo(email)).toHaveLength(1);
    const log = await prisma.notificationLog.findFirstOrThrow({ where: { restaurantId: t.id } });
    expect(log.recipients).toBe(2);
  });

  it('sends each reminder once, however many times it runs', async () => {
    const t = await tenant({ currentPeriodEnd: at(5) });
    await notifier.runReminders(now);
    await notifier.runReminders(at(0.1));
    await notifier.runReminders(at(0.2));
    expect(mailedTo(t.ownerEmails[0])).toHaveLength(1);
    expect(await prisma.notificationLog.count({ where: { restaurantId: t.id } })).toBe(1);
  });

  it('does not double send when two runs happen at the same moment', async () => {
    const t = await tenant({ currentPeriodEnd: at(4) });
    await Promise.all([
      notifier.runReminders(now),
      notifier.runReminders(now),
      notifier.runReminders(now),
    ]);
    expect(mailedTo(t.ownerEmails[0])).toHaveLength(1);
  });

  it('walks a plan through its reminders as time passes, one email per stage', async () => {
    const t = await tenant({ currentPeriodEnd: at(6) });
    await notifier.runReminders(now);
    await notifier.runReminders(at(5.5));
    await notifier.runReminders(at(7.5));
    await notifier.runReminders(at(15));
    const kinds = (
      await prisma.notificationLog.findMany({
        where: { restaurantId: t.id },
        orderBy: { sentAt: 'asc' },
      })
    ).map((n) => n.kind);
    expect(kinds).toEqual(['expiring_7d', 'expiring_1d', 'grace_started', 'menu_offline']);
    expect(mailedTo(t.ownerEmails[0])).toHaveLength(4);
  });

  it('reminds a trial in its last days', async () => {
    const t = await tenant({ status: 'TRIALING', trialEndsAt: at(2) });
    await notifier.runReminders(now);
    expect(mailedTo(t.ownerEmails[0])[0].subject).toContain('free trial ends');
  });

  it('says nothing while there is time, to suspended or canceled restaurants, or to ones with no end', async () => {
    const far = await tenant({ currentPeriodEnd: at(30) });
    const suspended = await tenant({ status: 'SUSPENDED', currentPeriodEnd: at(-30) });
    const canceled = await tenant({ status: 'CANCELED', currentPeriodEnd: at(2) });
    const forever = await tenant({ currentPeriodEnd: undefined });
    const none = await tenant(null);
    await notifier.runReminders(now);
    for (const t of [far, suspended, canceled, forever, none])
      expect(mailedTo(t.ownerEmails[0])).toHaveLength(0);
  });

  it('starts fresh reminders after a renewal', async () => {
    const t = await tenant({ currentPeriodEnd: at(5) });
    await notifier.runReminders(now);
    await prisma.subscription.update({
      where: { restaurantId: t.id },
      data: { currentPeriodEnd: at(35) },
    });
    await notifier.runReminders(at(1));
    expect(mailedTo(t.ownerEmails[0])).toHaveLength(1);
    await notifier.runReminders(at(32));
    expect(mailedTo(t.ownerEmails[0])).toHaveLength(2);
  });

  it('tries again later when nobody could be reached, instead of giving up', async () => {
    const t = await tenant({ currentPeriodEnd: at(2) });
    const spy = jest.spyOn(mail, 'send').mockResolvedValue(false);
    try {
      const failed = await notifier.runReminders(now);
      expect(failed.failed).toBeGreaterThanOrEqual(1);
      expect(await prisma.notificationLog.count({ where: { restaurantId: t.id } })).toBe(0);
    } finally {
      spy.mockRestore();
    }
    await notifier.runReminders(now);
    expect(mailedTo(t.ownerEmails[0])).toHaveLength(1);
  });

  it('puts the billing page link and the contact in the email when they are configured', async () => {
    const saved = { ...process.env };
    process.env.PUBLIC_BASE_URL = 'https://menu.example.org/';
    process.env.LANDING_CONTACT_WHATSAPP = '+970 599 111222';
    try {
      const t = await tenant({ currentPeriodEnd: at(2) });
      await notifier.runReminders(now);
      const [message] = mailedTo(t.ownerEmails[0]);
      expect(message.text).toContain('https://menu.example.org/admin/billing');
      expect(message.text).toContain('https://wa.me/970599111222');
    } finally {
      process.env = saved;
    }
  });

  it('shows the owners emails on the restaurant page of the platform area', async () => {
    const t = await tenant({ currentPeriodEnd: at(3) });
    await notifier.runReminders(now);
    const op = await prisma.superAdmin.create({
      data: {
        email: `op-notices-${Date.now().toString(36)}@x.example.com`,
        name: 'Op',
        passwordHash: await bcrypt.hash('Super@Password123', 4),
      },
    });
    try {
      const agent = request.agent(app.getHttpServer());
      const page = await agent.get('/super/login');
      await agent
        .post('/super/login')
        .type('form')
        .send({ csrf_token: csrfFrom(page.text), email: op.email, password: 'Super@Password123' });
      const detail = await agent
        .get(`/super/restaurants/${t.id}`)
        .set('Cookie', 'qaemati_locale=en');
      expect(detail.text).toContain('Emails sent to the owners');
      expect(detail.text).toContain('Plan ends within 7 days');
    } finally {
      await prisma.superAdmin.delete({ where: { id: op.id } });
    }
  });

  describe('the receipt for a recorded payment', () => {
    it('is emailed to the owners when the operator records it, and says what it covers', async () => {
      const t = await tenant({ status: 'TRIALING', trialEndsAt: at(5) });
      const op = await prisma.superAdmin.create({
        data: {
          email: `op-receipt-${Date.now().toString(36)}@x.example.com`,
          name: 'Op',
          passwordHash: await bcrypt.hash('Super@Password123', 4),
        },
      });
      try {
        const agent = request.agent(app.getHttpServer());
        const login = await agent.get('/super/login');
        await agent
          .post('/super/login')
          .type('form')
          .send({
            csrf_token: csrfFrom(login.text),
            email: op.email,
            password: 'Super@Password123',
          });
        const form = await agent.get(`/super/payments/new?restaurantId=${t.id}`);
        mail.outbox.length = 0;
        const res = await agent
          .post('/super/payments')
          .type('form')
          .send({
            csrf_token: csrfFrom(form.text),
            restaurantId: t.id,
            amount: '40.00',
            method: 'CASH',
            paidAt: '2026-11-10',
            periods: '1',
          });
        expect(res.status).toBe(303);
        const [receipt] = mailedTo(t.ownerEmails[0]);
        expect(receipt.subject).toMatch(/إيصال R-\d{6} \| Receipt R-\d{6}/);
        expect(receipt.text).toContain('40.00');
        expect(receipt.text).toContain('2026-11-10');
        expect(receipt.text).toContain('2026-12-10');
        expect(mailedTo(t.cashierEmail)).toHaveLength(0);
      } finally {
        await prisma.superAdmin.delete({ where: { id: op.id } });
      }
    });

    it('never undoes a payment when the email fails', async () => {
      const t = await tenant({ currentPeriodEnd: at(30) });
      const payment = await prisma.payment.create({
        data: {
          restaurantId: t.id,
          subscriptionId: (
            await prisma.subscription.findUniqueOrThrow({ where: { restaurantId: t.id } })
          ).id,
          amount: 40,
          currency: 'ILS',
          method: 'CASH',
          paidAt: now,
          periodStart: now,
          periodEnd: at(30),
          periods: 1,
        },
      });
      const spy = jest.spyOn(mail, 'send').mockRejectedValue(new Error('smtp down'));
      try {
        await expect(notifier.sendReceipt(payment.id)).resolves.toBe(0);
      } finally {
        spy.mockRestore();
      }
      expect(await prisma.payment.count({ where: { id: payment.id } })).toBe(1);
    });

    it('does nothing for a payment that does not exist', async () => {
      await expect(notifier.sendReceipt('nope')).resolves.toBe(0);
    });
  });
});
