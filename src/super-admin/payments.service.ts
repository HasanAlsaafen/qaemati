import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nextPeriod } from '../tenancy/billing-dates';
import { Actor, AuditService } from './audit.service';
import { RecordPaymentDto, VoidPaymentDto } from './dto/super.dto';
import { FieldError } from './field-error';

export interface PaymentFilter {
  restaurantId?: string;
  method?: string;
  status?: string;
  from?: string;
  to?: string;
}

/** A calendar date picked in a form means midday UTC, so it never slips a day. */
function atNoon(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(filter: PaymentFilter = {}) {
    const where: Prisma.PaymentWhereInput = {};
    if (filter.restaurantId) where.restaurantId = filter.restaurantId;
    if (filter.method && ['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'].includes(filter.method)) {
      where.method = filter.method as 'CASH';
    }
    if (filter.status === 'PAID' || filter.status === 'VOID') where.status = filter.status;
    if (filter.from || filter.to) {
      where.paidAt = {
        ...(filter.from ? { gte: atNoon(filter.from) } : {}),
        ...(filter.to ? { lte: atNoon(filter.to) } : {}),
      };
    }
    return this.prisma.payment.findMany({
      where,
      include: { restaurant: { select: { id: true, slug: true, nameAr: true, nameEn: true } } },
      orderBy: [{ paidAt: 'desc' }, { receiptNo: 'desc' }],
      take: 200,
    });
  }

  async get(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { restaurant: true, subscription: { include: { plan: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  /**
   * Records money received and extends the subscription by what it paid for.
   * The period starts where the paid up time ends (or at the payment date when
   * it had lapsed) so paying early wastes nothing and paying late gives
   * nothing free. A trial or overdue subscription becomes active. A suspended
   * or canceled one keeps that status, reactivating is a separate decision.
   */
  async record(actor: Actor, dto: RecordPaymentDto) {
    const amount = Number(dto.amount);
    if (!(amount > 0)) throw new FieldError('amount', 'amountZero');
    const subscription = await this.prisma.subscription.findUnique({
      where: { restaurantId: dto.restaurantId },
      include: { plan: true },
    });
    if (!subscription) throw new FieldError('restaurantId', 'noSubscription');

    const paidAt = atNoon(dto.paidAt);
    const periods = Math.max(1, Number(dto.periods));
    const period = nextPeriod(
      subscription.currentPeriodEnd,
      paidAt,
      subscription.plan.interval,
      periods,
    );

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          restaurantId: dto.restaurantId,
          subscriptionId: subscription.id,
          amount: dto.amount,
          currency: subscription.plan.currency,
          method: dto.method,
          reference: dto.reference?.trim() || null,
          paidAt,
          periodStart: period.start,
          periodEnd: period.end,
          periods,
          note: dto.note?.trim() || null,
          recordedById: actor.id,
        },
      });
      const keepsStatus = subscription.status === 'SUSPENDED' || subscription.status === 'CANCELED';
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodStart:
            subscription.currentPeriodEnd && subscription.currentPeriodEnd > paidAt
              ? subscription.currentPeriodStart
              : period.start,
          currentPeriodEnd: period.end,
          ...(keepsStatus ? {} : { status: 'ACTIVE' as const }),
        },
      });
      return created;
    });
    await this.audit.log(actor, 'payment.recorded', dto.restaurantId, {
      receiptNo: payment.receiptNo,
      amount: dto.amount,
      currency: subscription.plan.currency,
      method: dto.method,
      periodEnd: period.end.toISOString(),
    });
    return payment;
  }

  /** Marks a payment as void. The subscription period is left alone on purpose,
   *  if it should shrink the operator changes the dates themselves. */
  async void(actor: Actor, id: string, dto: VoidPaymentDto) {
    const payment = await this.get(id);
    if (payment.status === 'VOID') return payment;
    const voided = await this.prisma.payment.update({
      where: { id },
      data: { status: 'VOID', voidedAt: new Date(), voidReason: dto.reason.trim() },
    });
    await this.audit.log(actor, 'payment.voided', payment.restaurantId, {
      receiptNo: payment.receiptNo,
      reason: dto.reason.trim(),
    });
    return voided;
  }
}
