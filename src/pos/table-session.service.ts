import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PosEventBus } from './pos-event-bus';
import {
  isSessionIdle,
  readSessionCookie,
  readSocketTicket,
  sessionIdleMs,
} from './table-session-token';

/** The session a guest has proven membership of. */
export interface ResolvedSession {
  id: string;
  restaurantId: string;
  tableId: string;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Table sessions: one party's visit to one table. Holding a valid session is
 * the only way to read a bill or follow an order, so a saved link or a photo
 * of the QR code shows nothing once the party has left.
 *
 * Guests who each place an order at the same table join the same OPEN session
 * and share one bill. Scanning the QR code alone joins nothing.
 */
@Injectable()
export class TableSessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TableSessionService.name);
  private first: NodeJS.Timeout | null = null;
  private every: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: PosEventBus,
  ) {}

  /** Off in tests and with REMINDERS_ENABLED=false, like the billing reminders. */
  static schedulerEnabled(): boolean {
    if (process.env.REMINDERS_ENABLED === 'false') return false;
    return process.env.NODE_ENV !== 'test' || process.env.REMINDERS_ENABLED === 'true';
  }

  /**
   * Closes forgotten sessions an hour after start and then every hour. Running
   * on every server is fine: each session is claimed by an atomic update.
   */
  onModuleInit(): void {
    if (!TableSessionService.schedulerEnabled()) return;
    const run = () =>
      this.closeIdle().catch((error) => this.logger.error(`Idle session sweep failed: ${error}`));
    this.first = setTimeout(run, 60_000);
    this.every = setInterval(run, HOUR_MS);
    this.first.unref();
    this.every.unref();
  }

  onModuleDestroy(): void {
    if (this.first) clearTimeout(this.first);
    if (this.every) clearInterval(this.every);
  }

  /**
   * The session this table's party is in, started if there is none. An open
   * session that has gone idle is closed first, so a forgotten checkout never
   * hands the old bill to the next party.
   */
  async openOrJoin(restaurantId: string, tableId: string, now = new Date()) {
    const open = await this.prisma.tableSession.findFirst({
      where: { restaurantId, tableId, status: 'OPEN' },
    });
    if (open && !isSessionIdle(open.lastActivityAt, now)) {
      return this.prisma.tableSession.update({
        where: { id: open.id },
        data: { lastActivityAt: now },
      });
    }
    if (open) await this.closeAndFree(open, now, null);
    try {
      return await this.prisma.tableSession.create({
        data: { restaurantId, tableId, openedAt: now, lastActivityAt: now },
      });
    } catch (error) {
      // Two first orders at once: the database allowed only one OPEN session. Join the winner.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const winner = await this.prisma.tableSession.findFirst({
        where: { restaurantId, tableId, status: 'OPEN' },
      });
      if (!winner) throw error;
      return winner;
    }
  }

  /** The session a cookie value proves, for this restaurant, or null. */
  resolveCookie(slug: string, cookie: unknown, now = new Date()) {
    return this.resolve({ slug }, readSessionCookie(cookie), now);
  }

  /** Same, for a socket ticket. */
  resolveTicket(ticket: unknown, now = new Date()) {
    return this.resolve({}, readSocketTicket(ticket, now.getTime()), now);
  }

  /** Whether a known session id is still open and not idle. */
  isLive(sessionId: string, now = new Date()): Promise<boolean> {
    return this.resolve({}, sessionId, now).then(Boolean);
  }

  private async resolve(
    scope: { slug?: string },
    sessionId: string | null,
    now: Date,
  ): Promise<ResolvedSession | null> {
    if (!sessionId) return null;
    const session = await this.prisma.tableSession.findFirst({
      where: {
        id: sessionId,
        status: 'OPEN',
        ...(scope.slug ? { restaurant: { slug: scope.slug } } : {}),
      },
      select: { id: true, restaurantId: true, tableId: true, lastActivityAt: true },
    });
    if (!session || isSessionIdle(session.lastActivityAt, now)) return null;
    return { id: session.id, restaurantId: session.restaurantId, tableId: session.tableId };
  }

  /** A call or bill request is activity: keeps the party's session from lapsing. */
  async touch(sessionId: string, now = new Date()): Promise<void> {
    await this.prisma.tableSession.updateMany({
      where: { id: sessionId, status: 'OPEN' },
      data: { lastActivityAt: now },
    });
  }

  /**
   * Closes a session and frees its table in one transaction. With an idle
   * cutoff (the sweep) it only matches a session still idle at that moment, and
   * leaves a table alone that a scan touched since. Without one (a new order
   * found the old session idle) the table is freed regardless. True only for
   * the caller that closed it.
   */
  private async closeAndFree(
    session: { id: string; restaurantId: string; tableId: string },
    now: Date,
    cutoff: Date | null,
  ): Promise<boolean> {
    const claimed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.tableSession.updateMany({
        where: {
          id: session.id,
          status: 'OPEN',
          ...(cutoff ? { lastActivityAt: { lte: cutoff } } : {}),
        },
        data: { status: 'CLOSED', closedAt: now },
      });
      if (result.count !== 1) return false;
      await tx.restaurantTable.updateMany({
        where: {
          id: session.tableId,
          restaurantId: session.restaurantId,
          ...(cutoff ? { OR: [{ lastSeenAt: null }, { lastSeenAt: { lte: cutoff } }] } : {}),
        },
        data: { occupiedAt: null, lastSeenAt: null, billRequestedAt: null },
      });
      return true;
    });
    if (claimed) {
      await this.bus.publish({
        type: 'table.updated',
        restaurantId: session.restaurantId,
        id: session.tableId,
      });
    }
    return claimed;
  }

  /**
   * Closes every session with no activity for the idle period and frees its
   * table. Safe to run on several servers at once: the update that closes a
   * session only matches while it is still open and still idle, so exactly one
   * caller claims it and frees the table. Returns how many it closed.
   */
  async closeIdle(now = new Date(), idleMs = sessionIdleMs()): Promise<number> {
    const cutoff = new Date(now.getTime() - idleMs);
    const stale = await this.prisma.tableSession.findMany({
      where: { status: 'OPEN', lastActivityAt: { lte: cutoff } },
      select: { id: true, restaurantId: true, tableId: true },
    });
    let closed = 0;
    for (const session of stale) {
      if (await this.closeAndFree(session, now, cutoff)) closed += 1;
    }
    return closed;
  }
}
