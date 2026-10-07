import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { landingContact } from '../home/landing';
import { currencySymbol } from '../common/currency';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { billingNoticeMail, NoticeContext, receiptMail } from './billing-mail';
import { dayOf, NoticeKind, planNotices } from './notice-rules';

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (date: Date): string => date.toISOString().slice(0, 10);

export interface ReminderSummary {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
}

/** Emails owners about their plan, and sends the receipt for a recorded payment. */
@Injectable()
export class BillingNotifier {
  private readonly logger = new Logger(BillingNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private baseUrl(): string {
    return (process.env.PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '');
  }

  private contactLine(): string {
    const contact = landingContact();
    return contact.whatsappUrl ?? (contact.email ? contact.email : '');
  }

  /** Owners only: cashiers and kitchen staff have no say in the plan. */
  private owners(restaurantId: string) {
    return this.prisma.adminUser.findMany({
      where: { restaurantId, role: 'OWNER' },
      select: { email: true },
    });
  }

  /**
   * Sends every reminder that is due and has not gone out. The row that
   * records a notice is created first and is unique per restaurant, kind and
   * day, so if two servers run at once only one gets to send it. If nobody
   * could be reached the row is removed so the next run tries again.
   */
  async runReminders(now: Date = new Date()): Promise<ReminderSummary> {
    const summary: ReminderSummary = { checked: 0, sent: 0, skipped: 0, failed: 0 };
    const horizon = new Date(now.getTime() + 8 * DAY_MS);
    const floor = new Date(now.getTime() - 40 * DAY_MS);
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
        OR: [
          { trialEndsAt: { gte: floor, lte: horizon } },
          { currentPeriodEnd: { gte: floor, lte: horizon } },
        ],
      },
      include: { plan: true, restaurant: { select: { id: true, nameAr: true, nameEn: true } } },
    });

    for (const subscription of subscriptions) {
      summary.checked += 1;
      for (const notice of planNotices(subscription, now)) {
        const claimed = await this.claim(subscription.restaurantId, notice.kind, notice.forDate);
        if (!claimed) {
          summary.skipped += 1;
          continue;
        }
        const owners = await this.owners(subscription.restaurantId);
        const context = this.context(subscription, now);
        let delivered = 0;
        for (const owner of owners) {
          if (await this.mail.send(billingNoticeMail(owner.email, notice.kind, context)))
            delivered += 1;
        }
        if (owners.length > 0 && delivered === 0) {
          // Nobody could be reached. Free the slot so the next run tries again.
          await this.prisma.notificationLog
            .delete({ where: { id: claimed } })
            .catch(() => undefined);
          summary.failed += 1;
        } else {
          await this.prisma.notificationLog.update({
            where: { id: claimed },
            data: { recipients: delivered },
          });
          summary.sent += 1;
        }
      }
    }
    if (summary.sent || summary.failed) this.logger.log(`Reminders: ${JSON.stringify(summary)}`);
    return summary;
  }

  /** The receipt for a payment, to the owners. Never throws: a failed email must not undo a payment. */
  async sendReceipt(paymentId: string): Promise<number> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { restaurant: { select: { id: true, nameAr: true, nameEn: true } } },
      });
      if (!payment) return 0;
      const base = this.baseUrl();
      const owners = await this.owners(payment.restaurantId);
      let delivered = 0;
      for (const owner of owners) {
        const message = receiptMail(owner.email, {
          restaurantAr: payment.restaurant.nameAr,
          restaurantEn: payment.restaurant.nameEn,
          receiptNo: `R-${String(payment.receiptNo).padStart(6, '0')}`,
          amount: Number(payment.amount).toFixed(2),
          symbol: currencySymbol(payment.currency, 'en'),
          method: payment.method,
          paidOn: iso(payment.paidAt),
          periodStart: iso(payment.periodStart),
          periodEnd: iso(payment.periodEnd),
          receiptUrl: base ? `${base}/admin/billing/receipts/${payment.id}` : '',
        });
        if (await this.mail.send(message)) delivered += 1;
      }
      return delivered;
    } catch (error) {
      this.logger.error(`Receipt email failed: ${error instanceof Error ? error.message : error}`);
      return 0;
    }
  }

  private async claim(
    restaurantId: string,
    kind: NoticeKind,
    forDate: Date,
  ): Promise<string | null> {
    try {
      const row = await this.prisma.notificationLog.create({
        data: { restaurantId, kind, forDate: dayOf(forDate) },
      });
      return row.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return null;
      throw error;
    }
  }

  private context(
    subscription: {
      plan: { nameAr: string; nameEn: string };
      restaurant: { nameAr: string; nameEn: string };
      trialEndsAt: Date | null;
      currentPeriodEnd: Date | null;
      status: string;
      graceDays: number;
    },
    now: Date,
  ): NoticeContext {
    const ends =
      (subscription.status === 'TRIALING'
        ? subscription.trialEndsAt
        : subscription.currentPeriodEnd) ?? now;
    const offline = new Date(ends.getTime() + subscription.graceDays * DAY_MS);
    const base = this.baseUrl();
    return {
      restaurantAr: subscription.restaurant.nameAr,
      restaurantEn: subscription.restaurant.nameEn,
      planAr: subscription.plan.nameAr,
      planEn: subscription.plan.nameEn,
      endsOn: iso(ends),
      offlineOn: iso(offline),
      daysLeft: Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / DAY_MS)),
      billingUrl: base ? `${base}/admin/billing` : '',
      contact: this.contactLine(),
    };
  }
}
