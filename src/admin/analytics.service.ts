import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TopItemStat {
  itemId: string;
  nameAr: string;
  nameEn: string;
  viewCount: number;
}

export interface AnalyticsStats {
  menuViews7d: number;
  menuViews30d: number;
  topItems7d: TopItemStat[];
  topItems30d: TopItemStat[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * B2: a MenuView row with a null itemId is a whole-menu page load; a set
 * itemId is an item detail sheet open. Both are recorded here and never
 * for the restaurant's own admin viewing/previewing their own menu (see
 * MenuController/MenuService's isPreviewOwner check) -- an owner
 * checking their own page shouldn't inflate their own analytics.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  recordMenuView(restaurantId: string): Promise<unknown> {
    return this.prisma.menuView.create({ data: { restaurantId } });
  }

  /** Silently no-ops for an itemId that doesn't belong to this
   *  restaurant (or doesn't exist) -- the recording endpoint is public
   *  and unauthenticated (a page-view beacon, not a form submission), so
   *  this is the validation boundary rather than trusting the request. */
  async recordItemView(restaurantId: string, itemId: string): Promise<void> {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      select: { restaurantId: true },
    });
    if (!item || item.restaurantId !== restaurantId) return;
    await this.prisma.menuView.create({ data: { restaurantId, itemId } });
  }

  async getStats(restaurantId: string): Promise<AnalyticsStats> {
    const now = Date.now();
    const since7d = new Date(now - 7 * DAY_MS);
    const since30d = new Date(now - 30 * DAY_MS);

    const [menuViews7d, menuViews30d, topItems7d, topItems30d] = await Promise.all([
      this.prisma.menuView.count({
        where: { restaurantId, itemId: null, createdAt: { gte: since7d } },
      }),
      this.prisma.menuView.count({
        where: { restaurantId, itemId: null, createdAt: { gte: since30d } },
      }),
      this.topItems(restaurantId, since7d),
      this.topItems(restaurantId, since30d),
    ]);

    return { menuViews7d, menuViews30d, topItems7d, topItems30d };
  }

  private async topItems(restaurantId: string, since: Date, limit = 5): Promise<TopItemStat[]> {
    const grouped = await this.prisma.menuView.groupBy({
      by: ['itemId'],
      where: { restaurantId, itemId: { not: null }, createdAt: { gte: since } },
      _count: { itemId: true },
      orderBy: { _count: { itemId: 'desc' } },
      take: limit,
    });
    if (grouped.length === 0) return [];

    const items = await this.prisma.item.findMany({
      where: { id: { in: grouped.map((g) => g.itemId as string) } },
      select: { id: true, nameAr: true, nameEn: true },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));

    return grouped
      .map((g): TopItemStat | null => {
        const item = itemById.get(g.itemId as string);
        if (!item) return null;
        return {
          itemId: item.id,
          nameAr: item.nameAr,
          nameEn: item.nameEn,
          viewCount: g._count.itemId,
        };
      })
      .filter((stat): stat is TopItemStat => stat !== null);
  }
}
