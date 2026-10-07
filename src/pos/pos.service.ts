import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, WaiterCallStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PosEventBus } from './pos-event-bus';

/** The only ways an order moves. A finished or canceled order stays that way. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['PREPARING', 'CANCELED'],
  PREPARING: ['READY', 'CANCELED'],
  READY: ['SERVED', 'CANCELED'],
  SERVED: [],
  CANCELED: [],
};

export const CALL_TRANSITIONS: Record<WaiterCallStatus, WaiterCallStatus[]> = {
  OPEN: ['ACKNOWLEDGED', 'RESOLVED'],
  ACKNOWLEDGED: ['RESOLVED'],
  RESOLVED: [],
};

const RECENT_MS = 3 * 60 * 60 * 1000;

export interface LocationSettings {
  latitude: number | null;
  longitude: number | null;
  orderRadiusMeters: number;
  requireLocationCheck: boolean;
}

/** What the cashier and kitchen see and do. Every query is scoped to one restaurant. */
@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: PosEventBus,
  ) {}

  async board(restaurantId: string) {
    const since = new Date(Date.now() - RECENT_MS);
    const [orders, calls] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          restaurantId,
          OR: [
            { status: { in: ['NEW', 'PREPARING', 'READY'] } },
            { statusChangedAt: { gte: since } },
          ],
        },
        include: { items: { orderBy: { id: 'asc' } } },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
      this.prisma.waiterCall.findMany({
        where: {
          restaurantId,
          OR: [{ status: { not: 'RESOLVED' } }, { resolvedAt: { gte: since } }],
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    ]);
    return {
      orders,
      calls,
      counts: {
        newOrders: orders.filter((o) => o.status === 'NEW').length,
        openCalls: calls.filter((c) => c.status === 'OPEN').length,
      },
    };
  }

  async setOrderStatus(restaurantId: string, orderId: string, to: OrderStatus, adminId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, restaurantId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!ORDER_TRANSITIONS[order.status].includes(to)) {
      throw new ConflictException(`An order that is ${order.status} cannot become ${to}`);
    }
    // Only if it is still in the state the screen showed: two people tapping at
    // once cannot both win, and a late tap cannot undo the other's.
    const moved = await this.prisma.order.updateMany({
      where: { id: orderId, restaurantId, status: order.status },
      data: { status: to, statusChangedAt: new Date(), statusChangedById: adminId },
    });
    if (moved.count !== 1) throw new ConflictException('The order was changed by someone else');
    await this.bus.publish({ type: 'order.updated', restaurantId, id: orderId });
  }

  async setCallStatus(restaurantId: string, callId: string, to: WaiterCallStatus, adminId: string) {
    const call = await this.prisma.waiterCall.findFirst({ where: { id: callId, restaurantId } });
    if (!call) throw new NotFoundException('Call not found');
    if (!CALL_TRANSITIONS[call.status].includes(to)) {
      throw new ConflictException(`A call that is ${call.status} cannot become ${to}`);
    }
    const now = new Date();
    const moved = await this.prisma.waiterCall.updateMany({
      where: { id: callId, restaurantId, status: call.status },
      data: {
        status: to,
        handledById: adminId,
        ...(to === 'ACKNOWLEDGED' ? { acknowledgedAt: now } : { resolvedAt: now }),
      },
    });
    if (moved.count !== 1) throw new ConflictException('The call was changed by someone else');
    await this.bus.publish({ type: 'call.updated', restaurantId, id: callId });
  }

  async locationSettings(restaurantId: string): Promise<LocationSettings> {
    const r = await this.prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
      select: {
        latitude: true,
        longitude: true,
        orderRadiusMeters: true,
        requireLocationCheck: true,
      },
    });
    return {
      latitude: r.latitude === null ? null : Number(r.latitude),
      longitude: r.longitude === null ? null : Number(r.longitude),
      orderRadiusMeters: r.orderRadiusMeters,
      requireLocationCheck: r.requireLocationCheck,
    };
  }

  saveLocationSettings(restaurantId: string, settings: LocationSettings) {
    return this.prisma.restaurant.update({ where: { id: restaurantId }, data: settings });
  }
}
