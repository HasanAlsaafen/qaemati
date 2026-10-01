import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ItemTag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ItemInput {
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  price: number;
  currency: string;
  tags: ItemTag[];
}

@Injectable()
export class ItemService {
  constructor(private readonly prisma: PrismaService) {}

  async create(restaurantId: string, categoryId: string, input: ItemInput) {
    await this.assertCategoryOwnership(restaurantId, categoryId);
    const last = await this.prisma.item.findFirst({
      where: { categoryId },
      orderBy: { sortOrder: 'desc' },
    });
    return this.prisma.item.create({
      data: {
        restaurantId,
        categoryId,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descriptionAr: input.descriptionAr,
        descriptionEn: input.descriptionEn,
        price: input.price,
        currency: input.currency,
        tags: input.tags,
        sortOrder: last ? last.sortOrder + 1 : 0,
      },
    });
  }

  async update(restaurantId: string, itemId: string, input: ItemInput) {
    await this.assertOwnership(restaurantId, itemId);
    return this.prisma.item.update({
      where: { id: itemId },
      data: {
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descriptionAr: input.descriptionAr,
        descriptionEn: input.descriptionEn,
        price: input.price,
        currency: input.currency,
        tags: input.tags,
      },
    });
  }

  async toggleAvailability(restaurantId: string, itemId: string) {
    const item = await this.assertOwnership(restaurantId, itemId);
    return this.prisma.item.update({
      where: { id: itemId },
      data: { available: !item.available },
    });
  }

  async setImage(restaurantId: string, itemId: string, imagePath: string) {
    await this.assertOwnership(restaurantId, itemId);
    return this.prisma.item.update({ where: { id: itemId }, data: { imagePath } });
  }

  async remove(restaurantId: string, itemId: string): Promise<void> {
    await this.assertOwnership(restaurantId, itemId);
    await this.prisma.item.delete({ where: { id: itemId } });
  }

  async move(restaurantId: string, itemId: string, direction: 'up' | 'down'): Promise<void> {
    const item = await this.assertOwnership(restaurantId, itemId);
    const neighbor = await this.prisma.item.findFirst({
      where: {
        categoryId: item.categoryId,
        sortOrder: direction === 'up' ? { lt: item.sortOrder } : { gt: item.sortOrder },
      },
      orderBy: { sortOrder: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbor) return;

    await this.prisma.$transaction([
      this.prisma.item.update({ where: { id: item.id }, data: { sortOrder: neighbor.sortOrder } }),
      this.prisma.item.update({ where: { id: neighbor.id }, data: { sortOrder: item.sortOrder } }),
    ]);
  }

  async assertOwnership(restaurantId: string, itemId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');
    if (item.restaurantId !== restaurantId) {
      throw new ForbiddenException('Item does not belong to this restaurant');
    }
    return item;
  }

  private async assertCategoryOwnership(restaurantId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    if (category.restaurantId !== restaurantId) {
      throw new ForbiddenException('Category does not belong to this restaurant');
    }
    return category;
  }
}
