import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isCategoryAvailableNow, nowInHebronMinutes } from '../common/open-status';
import { RATE_LIMIT_STORE, RateLimitStore } from '../common/rate-limit/rate-limit-store';
import { parseLineKey } from '../pos/order-lines';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { isServable } from '../tenancy/tenant-access';
import { Candidate, MAX_SUGGESTIONS, suggest, Suggestion } from './suggest';

const DAY_MS = 24 * 60 * 60 * 1000;
const REASONS = new Set(['pairing', 'together', 'popular']);
const MAX_SELECTED = 20;

/** Loads what the ranking needs for one restaurant. Every query is scoped to it. */
@Injectable()
export class SuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    @Inject(RATE_LIMIT_STORE) private readonly limits: RateLimitStore,
  ) {}

  private async restaurant(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) return null;
    const context = await this.tenancy.getContext(restaurant.id);
    return isServable(context.access) ? restaurant : null;
  }

  private async withinLimit(key: string, windowMs: number, max: number): Promise<boolean> {
    try {
      return (await this.limits.hit(key, windowMs)) <= max;
    } catch {
      return true;
    }
  }

  /**
   * The selection arrives as the keys the menu page keeps (a dish, a size,
   * extras). Only the dish matters here. Anything that is not a dish of this
   * restaurant is ignored, so the answer cannot be steered by another one.
   */
  async forSelection(slug: string, keys: string[], ip: string): Promise<Suggestion[]> {
    if (!(await this.withinLimit(`suggest-ip:${ip}`, 60_000, 120))) return [];
    const restaurant = await this.restaurant(slug);
    if (!restaurant) return [];

    const requested = [
      ...new Set(
        keys
          .slice(0, MAX_SELECTED)
          .map((key) => parseLineKey(key)?.itemId)
          .filter((id): id is string => !!id),
      ),
    ];
    const own = requested.length
      ? await this.prisma.item.findMany({
          where: { id: { in: requested }, restaurantId: restaurant.id },
          select: { id: true },
        })
      : [];
    const ownIds = new Set(own.map((item) => item.id));
    const selected = requested.filter((id) => ownIds.has(id));

    const nowMinutes = nowInHebronMinutes();
    const [items, pairings, together, sold] = await Promise.all([
      this.prisma.item.findMany({
        where: { restaurantId: restaurant.id, available: true },
        select: {
          id: true,
          categoryId: true,
          tags: true,
          sortOrder: true,
          category: { select: { availableFrom: true, availableTo: true } },
        },
      }),
      this.prisma.itemPairing.findMany({
        where: { restaurantId: restaurant.id, itemId: { in: selected } },
        orderBy: { sortOrder: 'asc' },
        select: { itemId: true, pairedItemId: true },
      }),
      this.togetherWith(restaurant.id, selected),
      this.soldRecently(restaurant.id),
    ]);

    const candidates: Candidate[] = items
      .filter((item) =>
        isCategoryAvailableNow(item.category.availableFrom, item.category.availableTo, nowMinutes),
      )
      .map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        tagged: item.tags.includes('POPULAR'),
        sold: sold.get(item.id) ?? 0,
        sortOrder: item.sortOrder,
      }));
    const pairingMap = new Map<string, string[]>();
    for (const pairing of pairings) {
      pairingMap.set(pairing.itemId, [
        ...(pairingMap.get(pairing.itemId) ?? []),
        pairing.pairedItemId,
      ]);
    }
    return suggest({
      selected,
      candidates,
      pairings: pairingMap,
      together,
      limit: MAX_SUGGESTIONS,
    });
  }

  /** Other dishes in recent orders that also had one of the selected dishes. */
  private async togetherWith(
    restaurantId: string,
    selected: string[],
  ): Promise<Map<string, number>> {
    if (selected.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<{ id: string; n: number }[]>(Prisma.sql`
      SELECT other."itemId" AS "id", COUNT(DISTINCT other."orderId")::int AS "n"
      FROM "OrderItem" mine
      JOIN "Order" o ON o."id" = mine."orderId"
      JOIN "OrderItem" other ON other."orderId" = mine."orderId" AND other."itemId" <> mine."itemId"
      WHERE o."restaurantId" = ${restaurantId}
        AND o."status" <> 'CANCELED'
        AND o."createdAt" > ${new Date(Date.now() - 90 * DAY_MS)}
        AND mine."itemId" IN (${Prisma.join(selected)})
        AND other."itemId" IS NOT NULL
        AND other."itemId" NOT IN (${Prisma.join(selected)})
      GROUP BY other."itemId"
    `);
    return new Map(rows.map((row) => [row.id, Number(row.n)]));
  }

  private async soldRecently(restaurantId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ id: string; n: number }[]>(Prisma.sql`
      SELECT oi."itemId" AS "id", SUM(oi."quantity")::int AS "n"
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."restaurantId" = ${restaurantId} AND o."status" <> 'CANCELED'
        AND o."createdAt" > ${new Date(Date.now() - 30 * DAY_MS)} AND oi."itemId" IS NOT NULL
      GROUP BY oi."itemId"
    `);
    return new Map(rows.map((row) => [row.id, Number(row.n)]));
  }

  /** A guest added a suggested dish. Counted, with nothing about who. */
  async recordAdd(slug: string, itemId: string, reason: string, ip: string): Promise<void> {
    if (!REASONS.has(reason) || !(await this.withinLimit(`suggest-add-ip:${ip}`, 3_600_000, 200)))
      return;
    const restaurant = await this.restaurant(slug);
    if (!restaurant) return;
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, restaurantId: restaurant.id },
      select: { id: true },
    });
    if (!item) return;
    await this.prisma.suggestionAdd.create({
      data: { restaurantId: restaurant.id, itemId: item.id, reason },
    });
  }
}
