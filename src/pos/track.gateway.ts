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
import { TableSessionService } from './table-session.service';

export const trackRoom = (token: string): string => `order:${token}`;
export const sessionRoom = (sessionId: string): string => `session:${sessionId}`;

/** What a socket remembers about the table session it proved at the handshake. */
interface SocketSession {
  sessionId: string;
  tableId: string;
  restaurantId: string;
  /** Set on sockets that follow one order, which end when the session does. */
  followsOrder: boolean;
}

/**
 * Lets a guest follow their order and their table. There is no login: the
 * guest proves membership of the table's open session with a short lived ticket
 * (the session cookie cannot reach this path), and joins only that session's
 * room. Following one order also needs its random token, and the order must
 * belong to the session. Anyone else is told the same as for something that
 * does not exist, and nothing is sent to a socket whose session has closed.
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
    private readonly sessions: TableSessionService,
  ) {}

  afterInit(): void {
    this.unsubscribe = this.bus.subscribe((event: PosEvent) => {
      if (event.type === 'table.updated') void this.pushTable(event.restaurantId, event.id);
      if (event.type === 'order.updated') void this.push(event.id);
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const auth = socket.handshake.auth as
      { token?: unknown; table?: unknown; ticket?: unknown } | undefined;
    const session = await this.sessions.resolveTicket(auth?.ticket);

    if (typeof auth?.table === 'string') {
      await this.joinTable(socket, auth.table, session);
      return;
    }
    await this.joinOrder(socket, auth?.token, session);
  }

  /** A guest's phone follows its own table: taken, bill asked for, or checked out. */
  private async joinTable(
    socket: Socket,
    tableKey: string,
    session: Awaited<ReturnType<TableSessionService['resolveTicket']>>,
  ): Promise<void> {
    const table =
      session && /^[0-9a-f-]{36}$/.test(tableKey)
        ? await this.prisma.restaurantTable.findFirst({
            where: { token: tableKey, id: session.tableId, restaurantId: session.restaurantId },
            select: { id: true },
          })
        : null;
    if (!session || !table) {
      // Not in a session at this table (yet): an empty view, and no room to hear anything from.
      socket.emit('table', { occupied: false, billRequested: false });
      return;
    }
    socket.data.session = { ...session, sessionId: session.id, followsOrder: false };
    await socket.join(sessionRoom(session.id));
    socket.emit('table', await this.tableView(session.restaurantId, session.tableId, session.id));
  }

  private async joinOrder(
    socket: Socket,
    token: unknown,
    session: Awaited<ReturnType<TableSessionService['resolveTicket']>>,
  ): Promise<void> {
    const order =
      session && typeof token === 'string' && /^[0-9a-f-]{36}$/.test(token)
        ? await this.prisma.order.findFirst({
            where: {
              publicToken: token,
              sessionId: session.id,
              restaurantId: session.restaurantId,
            },
            select: { status: true },
          })
        : null;
    if (!session || !order || typeof token !== 'string') {
      socket.emit('unknown_order');
      socket.disconnect(true);
      return;
    }
    socket.data.session = { ...session, sessionId: session.id, followsOrder: true };
    await socket.join(trackRoom(token));
    socket.emit('status', { status: order.status });
  }

  private async tableView(restaurantId: string, tableId: string, sessionId: string) {
    const bill = await this.tables.bill(restaurantId, tableId, sessionId);
    return { occupied: bill.occupied, billRequested: bill.billRequested };
  }

  /**
   * Something changed at a table. Each connected guest of that table is told
   * about their own session: still open, or closed. A socket whose session has
   * closed is cut off, so a closed visit never hears about the next party.
   */
  private async pushTable(restaurantId: string, tableId: string): Promise<void> {
    try {
      const mine = [...this.server.sockets.values()].filter((socket) => {
        const held = socket.data.session as SocketSession | undefined;
        return held && held.tableId === tableId && held.restaurantId === restaurantId;
      });
      const live = new Map<string, boolean>();
      for (const socket of mine) {
        const held = socket.data.session as SocketSession;
        if (!live.has(held.sessionId)) {
          live.set(held.sessionId, await this.sessions.isLive(held.sessionId));
        }
        if (live.get(held.sessionId)) {
          if (!held.followsOrder) {
            socket.emit('table', await this.tableView(restaurantId, tableId, held.sessionId));
          }
        } else if (held.followsOrder) {
          socket.emit('unknown_order');
          socket.disconnect(true);
        } else {
          socket.emit('table', { occupied: false, billRequested: false });
          socket.disconnect(true);
        }
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
