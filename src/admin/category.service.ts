import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CategoryInput {
  nameAr: string;
  nameEn: string;
}

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  listForRestaurant(restaurantId: string) {
    return this.prisma.category.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  findOneWithItems(categoryId: string) {
    return this.prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
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
      },
    });
  }

  async update(restaurantId: string, categoryId: string, input: CategoryInput) {
    await this.assertOwnership(restaurantId, categoryId);
    return this.prisma.category.update({
      where: { id: categoryId },
      data: { nameAr: input.nameAr, nameEn: input.nameEn },
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
