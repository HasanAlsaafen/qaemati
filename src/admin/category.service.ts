import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CategoryInput {
  nameAr: string;
  nameEn: string;
  /** A3: optional daily availability window, "HH:MM" 24h. Both null or
   *  both set; one-sided input is normalized to "both null" by the
   *  controller before reaching here (see CategoriesController.update). */
  availableFrom?: string | null;
  availableTo?: string | null;
  /** Set to move the category to another menu of the same restaurant. */
  menuId?: string | null;
}

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  listForRestaurant(restaurantId: string) {
    return this.prisma.category.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            variants: { orderBy: { sortOrder: 'asc' } },
            addons: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  listForMenu(restaurantId: string, menuId: string) {
    return this.prisma.category.findMany({
      where: { restaurantId, menuId },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            variants: { orderBy: { sortOrder: 'asc' } },
            addons: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  findOneWithItems(categoryId: string) {
    return this.prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            variants: { orderBy: { sortOrder: 'asc' } },
            addons: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  async create(restaurantId: string, input: CategoryInput) {
    const last = await this.prisma.category.findFirst({
      where: { restaurantId },
      orderBy: { sortOrder: 'desc' },
    });
    return this.prisma.category.create({
      data: {
        restaurantId,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        sortOrder: last ? last.sortOrder + 1 : 0,
        menuId: input.menuId ?? null,
      },
    });
  }

  async update(restaurantId: string, categoryId: string, input: CategoryInput) {
    await this.assertOwnership(restaurantId, categoryId);
    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        availableFrom: input.availableFrom ?? null,
        availableTo: input.availableTo ?? null,
        ...(input.menuId ? { menuId: input.menuId } : {}),
      },
    });
  }

  async remove(restaurantId: string, categoryId: string): Promise<void> {
    await this.assertOwnership(restaurantId, categoryId);
    await this.prisma.category.delete({ where: { id: categoryId } });
  }

  async move(restaurantId: string, categoryId: string, direction: 'up' | 'down'): Promise<void> {
    const category = await this.assertOwnership(restaurantId, categoryId);
    const neighbor = await this.prisma.category.findFirst({
      where: {
        restaurantId,
        menuId: category.menuId,
        sortOrder: direction === 'up' ? { lt: category.sortOrder } : { gt: category.sortOrder },
      },
      orderBy: { sortOrder: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbor) return;

    await this.prisma.$transaction([
      this.prisma.category.update({
        where: { id: category.id },
        data: { sortOrder: neighbor.sortOrder },
      }),
      this.prisma.category.update({
        where: { id: neighbor.id },
        data: { sortOrder: category.sortOrder },
      }),
    ]);
  }

  /** Drag-and-drop reorder: sets sortOrder = index for each id, in the
   *  order given. Ids that don't belong to this restaurant are dropped
   *  rather than rejected outright -- the dragged list came from a
   *  render of this restaurant's own categories, so a mismatch only
   *  happens via a stale client or a tampered request, neither worth a
   *  hard error over (same tolerance as move()'s "no neighbor, no-op"). */
  async reorder(restaurantId: string, orderedIds: string[]): Promise<void> {
    const owned = await this.prisma.category.findMany({
      where: { restaurantId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((category) => category.id));
    const ids = orderedIds.filter((id) => ownedIds.has(id));
    if (!ids.length) return;

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.category.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
  }

  /** Throws if the category doesn't exist or belongs to a different restaurant. */
  private async assertOwnership(restaurantId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    if (category.restaurantId !== restaurantId) {
      throw new ForbiddenException('Category does not belong to this restaurant');
    }
    return category;
  }
}
