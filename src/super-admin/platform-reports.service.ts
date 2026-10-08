import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPlatformReport, lastMonths, PlatformReport } from './platform-report';

export const REPORT_MONTHS = [6, 12, 24] as const;

/** The number of months asked for, or 12 when the query is anything else. */
export function parseMonths(value: unknown): number {
  const n = Number(value);
  return (REPORT_MONTHS as readonly number[]).includes(n) ? n : 12;
}

const startOfWindow = (now: Date, months: number): Date => {
  const first = lastMonths(now, months)[0];
  return new Date(`${first}-01T00:00:00Z`);
};

/** Loads the facts the platform report is computed from. Platform wide, for operators only. */
@Injectable()
export class PlatformReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(months: number, now: Date = new Date()): Promise<PlatformReport> {
    const since = startOfWindow(now, months);
    const [payments, tenants, subscriptions] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: since } },
        select: { amount: true, currency: true, paidAt: true },
      }),
      this.prisma.restaurant.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true,
          createdAt: true,
          payments: { where: { status: 'PAID' }, select: { id: true }, take: 1 },
        },
      }),
      this.prisma.subscription.findMany({
        include: {
          plan: true,
          restaurant: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
        },
      }),
    ]);
    return buildPlatformReport({
      now,
      months,
      payments: payments.map((p) => ({
        amount: Number(p.amount),
        currency: p.currency,
        paidAt: p.paidAt,
      })),
      tenants: tenants.map((t) => ({
        id: t.id,
        createdAt: t.createdAt,
        converted: t.payments.length > 0,
      })),
      subscriptions: subscriptions.map((s) => ({
        status: s.status,
        trialEndsAt: s.trialEndsAt,
        currentPeriodEnd: s.currentPeriodEnd,
        graceDays: s.graceDays,
        canceledAt: s.canceledAt,
        restaurant: s.restaurant,
        plan: {
          id: s.plan.id,
          nameAr: s.plan.nameAr,
          nameEn: s.plan.nameEn,
          currency: s.plan.currency,
          priceAmount: Number(s.plan.priceAmount),
          interval: s.plan.interval,
        },
      })),
    });
  }

  /** Every payment in the window, voided ones included and marked, for the books. */
  paymentsForExport(months: number, now: Date = new Date()) {
    return this.prisma.payment.findMany({
      where: { paidAt: { gte: startOfWindow(now, months) } },
      orderBy: [{ paidAt: 'asc' }, { receiptNo: 'asc' }],
      take: 50_000,
      include: { restaurant: { select: { slug: true, nameAr: true, nameEn: true } } },
    });
  }
}
