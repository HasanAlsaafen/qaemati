import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';

export type PosEventType = 'order.new' | 'order.updated' | 'call.new' | 'call.updated';

/** Only ids travel, never order contents: a screen asks the server for the details. */
export interface PosEvent {
  type: PosEventType;
  restaurantId: string;
  id: string;
}

const CHANNEL = 'pos_events';

/**
 * Carries events between server instances through Postgres LISTEN / NOTIFY,
 * so a guest's order reaches the staff screen even when the guest and the
 * cashier are connected to different instances, with no extra service to run.
 * If the listening connection is down, an event is delivered to this
 * instance's own screens directly instead of being lost.
 */
@Injectable()
export class PosEventBus implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PosEventBus.name);
  private readonly handlers = new Set<(event: PosEvent) => void>();
  private client: Client | null = null;
  private listening = false;
  private closed = false;
  private retry: NodeJS.Timeout | null = null;
  private attempts = 0;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    void this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    const client = this.client;
    this.client = null;
    this.listening = false;
    await client?.end().catch(() => undefined);
  }

  subscribe(handler: (event: PosEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async publish(event: PosEvent): Promise<void> {
    if (this.listening) {
      try {
        await this.prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(event)})`;
        return;
      } catch (error) {
        this.logger.warn(`Notify failed, delivering locally: ${error}`);
      }
    }
    this.dispatch(event);
  }

  private dispatch(event: PosEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error(`A listener failed: ${error}`);
      }
    }
  }

  private async connect(): Promise<void> {
    if (this.closed) return;
    const url = new URL(process.env.DATABASE_URL ?? '');
    url.search = '';
    const client = new Client({ connectionString: url.toString() });
    client.on('notification', (message) => {
      if (message.channel !== CHANNEL || !message.payload) return;
      try {
        this.dispatch(JSON.parse(message.payload) as PosEvent);
      } catch {
        this.logger.warn('Ignored a malformed event');
      }
    });
    const lost = () => {
      if (this.client !== client) return;
      this.listening = false;
      this.client = null;
      void client.end().catch(() => undefined);
      this.scheduleReconnect();
    };
    client.on('error', lost);
    client.on('end', lost);
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      if (this.closed) {
        await client.end();
        return;
      }
      this.client = client;
      this.listening = true;
      this.attempts = 0;
    } catch (error) {
      this.logger.warn(`Could not listen for POS events: ${error}`);
      await client.end().catch(() => undefined);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.retry) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.attempts++);
    this.retry = setTimeout(() => {
      this.retry = null;
      void this.connect();
    }, delay);
    this.retry.unref();
  }
}
