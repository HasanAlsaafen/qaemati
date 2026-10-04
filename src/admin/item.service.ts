import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ItemTag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ItemOption {
  nameAr: string;
  nameEn: string;
  price: number;
}

export interface ItemInput {
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  price: number;
  currency: string;
  tags: ItemTag[];
  variants?: ItemOption[];
  addons?: ItemOption[];
  isTodaysSpecial?: boolean;
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

    // Variants/addons are replaced wholesale on every save (delete all,
    // recreate from the submitted list) rather than diffed row-by-row --
    // the admin form submits its whole current list as a flat indexed
    // array each time (variants[0][nameAr], variants[1][nameAr], ...),
    // so there's no stable "this row is the same row as before" identity
    // to diff against without inventing one. Simple and correct; the
    // tradeoff is new cuid()s for every variant/addon on every item save,
    // which is harmless since nothing else references them by id across
    // requests.
    const [item] = await this.prisma.$transaction([
      this.prisma.item.update({
        where: { id: itemId },
        data: {
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          descriptionAr: input.descriptionAr,
          descriptionEn: input.descriptionEn,
          price: input.price,
          currency: input.currency,
          tags: input.tags,
          isTodaysSpecial: input.isTodaysSpecial ?? false,
        },
      }),
      this.prisma.itemVariant.deleteMany({ where: { itemId } }),
      this.prisma.itemAddon.deleteMany({ where: { itemId } }),
      ...(input.variants ?? []).map((variant, index) =>
        this.prisma.itemVariant.create({
          data: {
            restaurantId,
            itemId,
            nameAr: variant.nameAr,
            nameEn: variant.nameEn,
            price: variant.price,
            sortOrder: index,
          },
        }),
      ),
      ...(input.addons ?? []).map((addon, index) =>
        this.prisma.itemAddon.create({
          data: {
            restaurantId,
            itemId,
            nameAr: addon.nameAr,
            nameEn: addon.nameEn,
            price: addon.price,
            sortOrder: index,
          },
        }),
      ),
    ]);

    return item;
  }

  async toggleAvailability(restaurantId: string, itemId: string) {
    const item = await this.assertOwnership(restaurantId, itemId);
    return this.prisma.item.update({
      where: { id: itemId },
      data: { available: !item.available },
      include: {
        variants: { orderBy: { sortOrder: 'asc' } },
        addons: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async setImage(restaurantId: string, itemId: string, imagePath: string) {
    await this.assertOwnership(restaurantId, itemId);
    return this.prisma.item.update({
      where: { id: itemId },
      data: { imagePath },
      include: {
        variants: { orderBy: { sortOrder: 'asc' } },
        addons: { orderBy: { sortOrder: 'asc' } },
      },
    });
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
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: {
        variants: { orderBy: { sortOrder: 'asc' } },
        addons: { orderBy: { sortOrder: 'asc' } },
      },
    });
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
