import { Prisma } from '@prisma/client';
import { TableSessionService } from './table-session.service';
import { signSessionCookie, signSocketTicket } from './table-session-token';

const now = new Date('2026-10-20T12:00:00Z');
const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
const row = (extra = {}) => ({
  id: 's1',
  restaurantId: 'r1',
  tableId: 't1',
  lastActivityAt: ago(1),
  ...extra,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function build() {
  const prisma: Record<string, any> = {
    tableSession: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(async ({ data }) => ({ id: 'new', ...data })),
      update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    restaurantTable: { updateMany: jest.fn(async () => ({ count: 1 })) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const bus = { publish: jest.fn(async () => undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new TableSessionService(prisma as any, bus as any);
  return { prisma, bus, service };
}

describe('TableSessionService', () => {
  describe('openOrJoin', () => {
    it('starts a session when the table has none', async () => {
      const { prisma, service } = build();
      prisma.tableSession.findFirst.mockResolvedValue(null);
      const session = await service.openOrJoin('r1', 't1', now);
      expect(prisma.tableSession.create).toHaveBeenCalledWith({
        data: { restaurantId: 'r1', tableId: 't1', openedAt: now, lastActivityAt: now },
      });
      expect(session.id).toBe('new');
    });

    it('joins the open session and keeps it alive', async () => {
      const { prisma, service } = build();
      prisma.tableSession.findFirst.mockResolvedValue(row());
      const session = await service.openOrJoin('r1', 't1', now);
      expect(prisma.tableSession.create).not.toHaveBeenCalled();
      expect(prisma.tableSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { lastActivityAt: now },
      });
      expect(session.id).toBe('s1');
    });

    it('closes an idle session and starts a fresh one instead of joining it', async () => {
      const { prisma, service } = build();
      prisma.tableSession.findFirst.mockResolvedValue(row({ lastActivityAt: ago(7) }));
      const session = await service.openOrJoin('r1', 't1', now);
      expect(prisma.tableSession.updateMany).toHaveBeenCalledWith({
        where: { id: 's1', status: 'OPEN' },
        data: { status: 'CLOSED', closedAt: now },
      });
      expect(session.id).toBe('new');
    });

    it('joins the winner when two first orders race', async () => {
      const { prisma, service } = build();
      prisma.tableSession.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(row({ id: 'winner' }));
      prisma.tableSession.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
      );
      expect((await service.openOrJoin('r1', 't1', now)).id).toBe('winner');
    });

    it('does not hide other database errors', async () => {
      const { prisma, service } = build();
      prisma.tableSession.findFirst.mockResolvedValue(null);
      prisma.tableSession.create.mockRejectedValue(new Error('down'));
      await expect(service.openOrJoin('r1', 't1', now)).rejects.toThrow('down');
    });
  });

  describe('resolving a guest', () => {
    it('proves membership of an open session of the right restaurant', async () => {
      const { prisma, service } = build();
      prisma.tableSession.findFirst.mockResolvedValue(row());
      expect(await service.resolveCookie('slug', signSessionCookie('s1'), now)).toEqual({
        id: 's1',
        restaurantId: 'r1',
        tableId: 't1',
      });
      expect(prisma.tableSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1', status: 'OPEN', restaurant: { slug: 'slug' } },
        }),
      );
    });

    it('proves nothing for a missing, forged or closed cookie', async () => {
      const { prisma, service } = build();
      prisma.tableSession.findFirst.mockResolvedValue(null);
      expect(await service.resolveCookie('slug', undefined, now)).toBeNull();
      expect(await service.resolveCookie('slug', 's1.forged', now)).toBeNull();
      expect(prisma.tableSession.findFirst).not.toHaveBeenCalled();
      expect(await service.resolveCookie('slug', signSessionCookie('s1'), now)).toBeNull();
    });

    it('treats a session idle past the limit as closed on read', async () => {
      const { prisma, service } = build();
      prisma.tableSession.findFirst.mockResolvedValue(row({ lastActivityAt: ago(6) }));
      expect(await service.resolveCookie('slug', signSessionCookie('s1'), now)).toBeNull();
      expect(await service.isLive('s1', now)).toBe(false);
    });

    it('accepts a fresh socket ticket and refuses an expired one', async () => {
      const { prisma, service } = build();
      prisma.tableSession.findFirst.mockResolvedValue(row());
      expect(
        await service.resolveTicket(signSocketTicket('s1', now.getTime()), now),
      ).not.toBeNull();
      const stale = signSocketTicket('s1', now.getTime() - 120_000);
      expect(await service.resolveTicket(stale, now)).toBeNull();
    });
  });

  describe('closeIdle', () => {
    it('closes every idle session, frees its table and tells the staff screens', async () => {
      const { prisma, bus, service } = build();
      prisma.tableSession.findMany.mockResolvedValue([row(), row({ id: 's2', tableId: 't2' })]);
      expect(await service.closeIdle(now, 6 * 3_600_000)).toBe(2);
      expect(prisma.tableSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'OPEN', lastActivityAt: { lte: ago(6) } } }),
      );
      expect(prisma.restaurantTable.updateMany).toHaveBeenCalledTimes(2);
      expect(bus.publish).toHaveBeenCalledTimes(2);
    });

    it('leaves a session alone that another server already closed', async () => {
      const { prisma, bus, service } = build();
      prisma.tableSession.findMany.mockResolvedValue([row()]);
      prisma.tableSession.updateMany.mockResolvedValue({ count: 0 });
      expect(await service.closeIdle(now, 6 * 3_600_000)).toBe(0);
      expect(prisma.restaurantTable.updateMany).not.toHaveBeenCalled();
      expect(bus.publish).not.toHaveBeenCalled();
    });
  });

  describe('scheduler', () => {
    const saved = { ...process.env };
    afterEach(() => {
      process.env = { ...saved };
    });

    it('is off in tests and when reminders are switched off', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.REMINDERS_ENABLED;
      expect(TableSessionService.schedulerEnabled()).toBe(false);
      process.env.NODE_ENV = 'production';
      expect(TableSessionService.schedulerEnabled()).toBe(true);
      process.env.REMINDERS_ENABLED = 'false';
      expect(TableSessionService.schedulerEnabled()).toBe(false);
    });
  });
});
