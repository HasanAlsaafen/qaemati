import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addDays } from '../tenancy/billing-dates';
import { computeAccess } from '../tenancy/tenant-access';

export interface MoneyByCurrency {
  currency: string;
  amount: number;
}

function addTo(map: Map<string, number>, currency: string, amount: number): void {
  map.set(currency, (map.get(currency) ?? 0) + amount);
}

function toList(map: Map<string, number>): MoneyByCurrency[] {
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(now = new Date()) {
    const [subscriptions, payments, recentPayments, newTenants] = await Promise.all([
      this.prisma.subscription.findMany({
        include: {
          plan: true,
          restaurant: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: { status: 'PAID' },
        select: { amount: true, currency: true, paidAt: true },
      }),
      this.prisma.payment.findMany({
        orderBy: [{ paidAt: 'desc' }, { receiptNo: 'desc' }],
        take: 8,
        include: { restaurant: { select: { id: true, slug: true, nameAr: true, nameEn: true } } },
      }),
      this.prisma.restaurant.count({ where: { createdAt: { gte: addDays(now, -30) } } }),
    ]);

    const states = { ok: 0, trial: 0, grace: 0, blocked: 0 };
    const mrr = new Map<string, number>();
    const expiring: Array<{
      restaurant: (typeof subscriptions)[number]['restaurant'];
      endsAt: Date;
      daysLeft: number;
    }> = [];

    for (const sub of subscriptions) {
      const access = computeAccess(sub, now);
      states[access.state]++;
      // Monthly recurring revenue counts what is actually running and paid.
      if (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE') {
        const price = Number(sub.plan.priceAmount);
        if (price > 0 && access.state !== 'blocked') {
          addTo(mrr, sub.plan.currency, sub.plan.interval === 'YEARLY' ? price / 12 : price);
        }
      }
      if (
        access.endsAt &&
        access.state !== 'blocked' &&
        access.daysLeft !== null &&
        access.daysLeft <= 7
      ) {
        expiring.push({
          restaurant: sub.restaurant,
          endsAt: access.endsAt,
          daysLeft: access.daysLeft,
        });
      }
    }
    expiring.sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());

    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const thisMonth = new Map<string, number>();
    const lastMonth = new Map<string, number>();
    for (const payment of payments) {
      if (payment.paidAt >= monthStart) addTo(thisMonth, payment.currency, Number(payment.amount));
      else if (payment.paidAt >= lastMonthStart)
        addTo(lastMonth, payment.currency, Number(payment.amount));
    }

    return {
      tenants: subscriptions.length,
      newTenants,
      states,
      mrr: toList(mrr),
      revenueThisMonth: toList(thisMonth),
      revenueLastMonth: toList(lastMonth),
      expiring,
      recentPayments,
    };
  }
}
