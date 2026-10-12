import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { IncomingMessage } from 'http';
import { Namespace, Socket } from 'socket.io';
import { PosEvent, PosEventBus } from './pos-event-bus';

export const roomFor = (restaurantId: string): string => `restaurant:${restaurantId}`;
/** Owners and cashiers: the people who answer a guest's call. */
export const floorRoomFor = (restaurantId: string): string => `floor:${restaurantId}`;

interface SessionRequest extends IncomingMessage {
  session?: { adminUserId?: string; restaurantId?: string; adminRole?: string };
}

/**
 * Pushes "something changed" to the staff of one restaurant. The room comes
 * from the signed in session, never from anything the client sends, so a
 * screen can only ever hear its own restaurant. The payload is only an id and
 * a type: the screen asks the server (which checks the session again) for
 * the details.
 */
@WebSocketGateway({ namespace: '/pos' })
export class PosGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  private readonly logger = new Logger(PosGateway.name);
  private unsubscribe: (() => void) | null = null;

  @WebSocketServer() private server!: Namespace;

  constructor(private readonly bus: PosEventBus) {}

  afterInit(): void {
    this.unsubscribe = this.bus.subscribe((event: PosEvent) => {
      // A waiter call or a table change is for the floor. The kitchen hears about orders only.
      const room =
        event.type.startsWith('call.') || event.type === 'table.updated'
          ? floorRoomFor(event.restaurantId)
          : roomFor(event.restaurantId);
      this.server.to(room).emit(event.type, { id: event.id });
    });
  }

  handleConnection(socket: Socket): void {
    const session = (socket.request as SessionRequest).session;
    if (!session?.adminUserId || !session.restaurantId) {
      socket.emit('unauthorized');
      socket.disconnect(true);
      return;
    }
    void socket.join(roomFor(session.restaurantId));
    if (session.adminRole !== 'KITCHEN') void socket.join(floorRoomFor(session.restaurantId));
    this.logger.debug(`Staff screen connected for ${session.restaurantId}`);
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }
}
