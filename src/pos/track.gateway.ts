import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { PosEvent, PosEventBus } from './pos-event-bus';
import { TablesService } from './tables.service';

export const trackRoom = (token: string): string => `order:${token}`;
export const tableRoom = (token: string): string => `table:${token}`;

/**
 * Lets a guest follow one order. There is no login: the guest proves it is
 * their order by holding its random token, and can only ever join the room of
 * that one order. What they hear is its status and nothing else.
 */
@WebSocketGateway({ namespace: '/track' })
export class TrackGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  private readonly logger = new Logger(TrackGateway.name);
  private unsubscribe: (() => void) | null = null;

  @WebSocketServer() private server!: Namespace;

  constructor(
    private readonly bus: PosEventBus,
    private readonly prisma: PrismaService,
    private readonly tables: TablesService,
  ) {}

  afterInit(): void {
    this.unsubscribe = this.bus.subscribe((event: PosEvent) => {
      if (event.type === 'table.updated') void this.pushTable(event.restaurantId, event.id);
      if (event.type === 'order.updated') void this.push(event.id);
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const auth = socket.handshake.auth as { token?: unknown; table?: unknown } | undefined;
    if (typeof auth?.table === 'string') {
      await this.joinTable(socket, auth.table);
      return;
    }
    const token = auth?.token;
    const order =
      typeof token === 'string' && /^[0-9a-f-]{36}$/.test(token)
        ? await this.prisma.order.findUnique({
            where: { publicToken: token },
            select: { status: true },
          })
        : null;
    if (!order || typeof token !== 'string') {
      socket.emit('unknown_order');
      socket.disconnect(true);
      return;
    }
    await socket.join(trackRoom(token));
    socket.emit('status', { status: order.status });
  }

  /** A guest's phone follows its own table: taken, bill asked for, or checked out. */
  private async joinTable(socket: Socket, token: string): Promise<void> {
    const table = /^[0-9a-f-]{36}$/.test(token)
      ? await this.prisma.restaurantTable.findUnique({
          where: { token },
          select: { id: true, restaurantId: true },
        })
      : null;
    if (!table) {
      socket.emit('unknown_table');
      socket.disconnect(true);
      return;
    }
    await socket.join(tableRoom(token));
    socket.emit('table', await this.tableView(table.restaurantId, table.id));
  }

  private async tableView(restaurantId: string, tableId: string) {
    const bill = await this.tables.bill(restaurantId, tableId);
    return { occupied: bill.occupied, billRequested: bill.billRequested };
  }

  private async pushTable(restaurantId: string, tableId: string): Promise<void> {
    try {
      const table = await this.prisma.restaurantTable.findFirst({
        where: { id: tableId, restaurantId },
        select: { token: true },
      });
      if (table) {
        this.server
          .to(tableRoom(table.token))
          .emit('table', await this.tableView(restaurantId, tableId));
      }
    } catch (error) {
      this.logger.warn(`Could not push a table: ${error}`);
    }
  }

  private async push(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { publicToken: true, status: true },
      });
      if (order)
        this.server.to(trackRoom(order.publicToken)).emit('status', { status: order.status });
    } catch (error) {
      this.logger.warn(`Could not push a status: ${error}`);
    }
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }
}
