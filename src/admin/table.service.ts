import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TableService {
  constructor(private readonly prisma: PrismaService) {}

  listForRestaurant(restaurantId: string) {
    return this.prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(restaurantId: string, label: string) {
    const last = await this.prisma.restaurantTable.findFirst({
      where: { restaurantId },
      orderBy: { sortOrder: 'desc' },
    });
    return this.prisma.restaurantTable.create({
      data: { restaurantId, label, sortOrder: last ? last.sortOrder + 1 : 0 },
    });
  }

  async update(restaurantId: string, tableId: string, label: string) {
    await this.assertOwnership(restaurantId, tableId);
    return this.prisma.restaurantTable.update({ where: { id: tableId }, data: { label } });
  }

  async remove(restaurantId: string, tableId: string): Promise<void> {
    await this.assertOwnership(restaurantId, tableId);
    await this.prisma.restaurantTable.delete({ where: { id: tableId } });
  }

  async move(restaurantId: string, tableId: string, direction: 'up' | 'down'): Promise<void> {
    const table = await this.assertOwnership(restaurantId, tableId);
    const neighbor = await this.prisma.restaurantTable.findFirst({
      where: {
        restaurantId,
        sortOrder: direction === 'up' ? { lt: table.sortOrder } : { gt: table.sortOrder },
      },
      orderBy: { sortOrder: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbor) return;

    await this.prisma.$transaction([
      this.prisma.restaurantTable.update({
        where: { id: table.id },
        data: { sortOrder: neighbor.sortOrder },
      }),
      this.prisma.restaurantTable.update({
        where: { id: neighbor.id },
        data: { sortOrder: table.sortOrder },
      }),
    ]);
  }

  /** Throws if the table doesn't exist or belongs to a different restaurant. */
  private async assertOwnership(restaurantId: string, tableId: string) {
    const table = await this.prisma.restaurantTable.findUnique({ where: { id: tableId } });
    if (!table) throw new NotFoundException('Table not found');
    if (table.restaurantId !== restaurantId) {
      throw new ForbiddenException('Table does not belong to this restaurant');
    }
    return table;
  }
}
