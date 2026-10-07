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

export const trackRoom = (token: string): string => `order:${token}`;

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
  ) {}

  afterInit(): void {
    this.unsubscribe = this.bus.subscribe((event: PosEvent) => {
      if (event.type !== 'order.updated') return;
      void this.push(event.id);
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
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
