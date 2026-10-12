import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { fromCents, toCents } from './order-lines';
import { PosEventBus } from './pos-event-bus';
import { tableState, TableState } from './table-state';

const BILLABLE: { not: OrderStatus } = { not: 'CANCELED' };

export interface TableCard {
  id: string;
  label: string;
  state: TableState;
  occupiedAt: Date | null;
  orders: number;
  total: string;
  currency: string;
}

/**
 * Which tables are taken. A visit starts when a guest inside the allowed area
 * opens the table's QR code, orders, or calls, and ends when staff check the
 * table out. The bill is whatever was ordered (and not canceled) since the
 * visit began.
 */
@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: PosEventBus,
  ) {}

  /** Marks the table taken (starting a visit if it was free) and keeps it from lapsing. */
  async touch(restaurantId: string, tableId: string): Promise<void> {
    const now = new Date();
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
      select: { occupiedAt: true, lastSeenAt: true, billRequestedAt: true },
    });
    if (!table) return;
    const active = await this.countBillable(tableId, table.occupiedAt);
    if (tableState(table, active, now) === 'FREE') {
      await this.prisma.restaurantTable.update({
        where: { id: tableId },
        data: { occupiedAt: now, lastSeenAt: now, billRequestedAt: null },
      });
      await this.bus.publish({ type: 'table.updated', restaurantId, id: tableId });
    } else {
      await this.prisma.restaurantTable.update({
        where: { id: tableId },
        data: { lastSeenAt: now },
      });
    }
  }

  /** Every table with its state, for the staff board. */
  async board(restaurantId: string): Promise<TableCard[]> {
    const now = new Date();
    const tables = await this.prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    const taken = tables.filter((t) => t.occupiedAt);
    const orders = taken.length
      ? await this.prisma.order.findMany({
          where: { restaurantId, tableId: { in: taken.map((t) => t.id) }, status: BILLABLE },
          select: { tableId: true, createdAt: true, total: true, currency: true },
        })
      : [];
    return tables.map((table) => {
      const mine = orders.filter(
        (o) => o.tableId === table.id && table.occupiedAt && o.createdAt >= table.occupiedAt,
      );
      const state = tableState(table, mine.length, now);
      const cents = mine.reduce((sum, o) => sum + toCents(o.total), 0);
      return {
        id: table.id,
        label: table.label,
        state,
        occupiedAt: state === 'FREE' ? null : table.occupiedAt,
        orders: state === 'FREE' ? 0 : mine.length,
        total: fromCents(state === 'FREE' ? 0 : cents),
        currency: mine[0]?.currency ?? '',
      };
    });
  }

  /** The guest's bill for the visit in progress, by the table's QR token. */
  async bill(restaurantId: string, tableId: string) {
    const table = await this.prisma.restaurantTable.findFirstOrThrow({
      where: { id: tableId, restaurantId },
    });
    const orders = table.occupiedAt
      ? await this.prisma.order.findMany({
          where: { tableId, restaurantId, status: BILLABLE, createdAt: { gte: table.occupiedAt } },
          include: { items: { orderBy: { id: 'asc' } } },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const state = tableState(table, orders.length, new Date());
    if (state === 'FREE')
      return { occupied: false, billRequested: false, orders: [], total: '0.00', currency: '' };
    const cents = orders.reduce((sum, o) => sum + toCents(o.total), 0);
    return {
      occupied: true,
      billRequested: state === 'BILL',
      orders: orders.map((o) => ({
        number: o.number,
        status: o.status,
        total: o.total.toString(),
        items: o.items.map((i) => ({
          nameAr: i.nameAr,
          nameEn: i.nameEn,
          quantity: i.quantity,
          lineTotal: i.lineTotal.toString(),
        })),
      })),
      total: fromCents(cents),
      currency: orders[0]?.currency ?? '',
    };
  }

  /** Staff are done with the table: it is free again and any open call for it is closed. */
  async checkout(restaurantId: string, tableId: string, adminId: string): Promise<void> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
      select: { id: true },
    });
    if (!table) throw new NotFoundException('Table not found');
    const open = await this.prisma.waiterCall.findMany({
      where: { restaurantId, tableId, status: { not: 'RESOLVED' } },
      select: { id: true },
    });
    await this.prisma.$transaction([
      this.prisma.restaurantTable.update({
        where: { id: tableId },
        data: { occupiedAt: null, lastSeenAt: null, billRequestedAt: null },
      }),
      this.prisma.waiterCall.updateMany({
        where: { restaurantId, tableId, status: { not: 'RESOLVED' } },
        data: { status: 'RESOLVED', resolvedAt: new Date(), handledById: adminId },
      }),
    ]);
    for (const call of open) {
      await this.bus.publish({ type: 'call.updated', restaurantId, id: call.id });
    }
    await this.bus.publish({ type: 'table.updated', restaurantId, id: tableId });
  }

  private countBillable(tableId: string, since: Date | null): Promise<number> {
    if (!since) return Promise.resolve(0);
    return this.prisma.order.count({
      where: { tableId, status: BILLABLE, createdAt: { gte: since } },
    });
  }
}
