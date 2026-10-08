import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_PAIRINGS } from './dto/pairings.dto';

/** What the owner chose to suggest next to a dish. Every query is scoped to the restaurant. */
@Injectable()
export class PairingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async dish(restaurantId: string, itemId: string) {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, restaurantId },
      select: { id: true, nameAr: true, nameEn: true },
    });
    if (!item) throw new NotFoundException('Dish not found');
    return item;
  }

  /** Every other dish of the restaurant in menu order, with the ones already chosen marked. */
  async choices(restaurantId: string, itemId: string) {
    const item = await this.dish(restaurantId, itemId);
    const [others, chosen] = await Promise.all([
      this.prisma.item.findMany({
        where: { restaurantId, id: { not: itemId } },
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          category: { select: { nameAr: true, nameEn: true, sortOrder: true } },
          sortOrder: true,
        },
      }),
      this.prisma.itemPairing.findMany({
        where: { restaurantId, itemId },
        orderBy: { sortOrder: 'asc' },
        select: { pairedItemId: true },
      }),
    ]);
    others.sort(
      (a, b) =>
        a.category.sortOrder - b.category.sortOrder ||
        a.category.nameEn.localeCompare(b.category.nameEn) ||
        a.sortOrder - b.sortOrder,
    );
    return { item, others, selected: chosen.map((c) => c.pairedItemId), max: MAX_PAIRINGS };
  }

  /**
   * Replaces the choice. Anything that is not another dish of this restaurant
   * (itself, a stranger's dish, a repeat) is dropped, never trusted.
   */
  async save(restaurantId: string, itemId: string, requested: string[]): Promise<void> {
    await this.dish(restaurantId, itemId);
    const unique = [...new Set(requested)].filter((id) => id !== itemId).slice(0, MAX_PAIRINGS);
    const own = unique.length
      ? await this.prisma.item.findMany({
          where: { restaurantId, id: { in: unique } },
          select: { id: true },
        })
      : [];
    const ownIds = new Set(own.map((item) => item.id));
    const kept = unique.filter((id) => ownIds.has(id));
    await this.prisma.$transaction([
      this.prisma.itemPairing.deleteMany({ where: { restaurantId, itemId } }),
      this.prisma.itemPairing.createMany({
        data: kept.map((pairedItemId, sortOrder) => ({
          restaurantId,
          itemId,
          pairedItemId,
          sortOrder,
        })),
      }),
    ]);
  }
}
