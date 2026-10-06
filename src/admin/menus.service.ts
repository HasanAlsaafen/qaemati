import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MenuInput {
  nameAr: string;
  nameEn: string;
  /** "HH:MM" 24h. Both set or both null, the controller normalises a
   *  one sided pair to null before it gets here. */
  availableFrom?: string | null;
  availableTo?: string | null;
}

export const DEFAULT_MENU_NAME_AR = 'القائمة الرئيسية';
export const DEFAULT_MENU_NAME_EN = 'Main menu';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every restaurant is expected to have at least one menu. Rows written
   * before menus existed, or by code that only knows about categories,
   * leave a restaurant with none or leave categories unassigned, so the
   * admin side repairs that lazily here instead of assuming a migration
   * covered it.
   */
  async ensureDefault(restaurantId: string) {
    let first = await this.prisma.menu.findFirst({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
    });
    if (!first) {
      first = await this.prisma.menu.create({
        data: {
          restaurantId,
          nameAr: DEFAULT_MENU_NAME_AR,
          nameEn: DEFAULT_MENU_NAME_EN,
          sortOrder: 0,
        },
      });
    }
    await this.prisma.category.updateMany({
      where: { restaurantId, menuId: null },
      data: { menuId: first.id },
    });
    return first;
  }

  async listForRestaurant(restaurantId: string) {
    await this.ensureDefault(restaurantId);
    return this.prisma.menu.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { categories: true } } },
    });
  }

  /** The requested menu if it belongs to this restaurant, else the first one. */
  async resolve(restaurantId: string, menuId?: string | null) {
    const menus = await this.listForRestaurant(restaurantId);
    return menus.find((menu) => menu.id === menuId) ?? menus[0];
  }

  async create(restaurantId: string, input: MenuInput) {
    await this.ensureDefault(restaurantId);
    const last = await this.prisma.menu.findFirst({
      where: { restaurantId },
      orderBy: { sortOrder: 'desc' },
    });
    return this.prisma.menu.create({
      data: {
        restaurantId,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        availableFrom: input.availableFrom ?? null,
        availableTo: input.availableTo ?? null,
        sortOrder: last ? last.sortOrder + 1 : 0,
      },
    });
  }

  async update(restaurantId: string, menuId: string, input: MenuInput) {
    await this.assertOwnership(restaurantId, menuId);
    return this.prisma.menu.update({
      where: { id: menuId },
      data: {
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        availableFrom: input.availableFrom ?? null,
        availableTo: input.availableTo ?? null,
      },
    });
  }

  /**
   * Categories are never deleted along with their menu: they move to the
   * next menu so an owner cannot lose a whole section of dishes by
   * removing a tab. The last remaining menu cannot be removed.
   */
  async remove(restaurantId: string, menuId: string) {
    await this.assertOwnership(restaurantId, menuId);
    const menus = await this.prisma.menu.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
    });
    if (menus.length <= 1) throw new BadRequestException('LAST_MENU');

    const target = menus.find((menu) => menu.id !== menuId)!;
    await this.prisma.$transaction([
      this.prisma.category.updateMany({
        where: { restaurantId, menuId },
        data: { menuId: target.id },
      }),
      this.prisma.menu.delete({ where: { id: menuId } }),
    ]);
    return target;
  }

  async move(restaurantId: string, menuId: string, direction: 'up' | 'down'): Promise<void> {
    const menu = await this.assertOwnership(restaurantId, menuId);
    const neighbor = await this.prisma.menu.findFirst({
      where: {
        restaurantId,
        sortOrder: direction === 'up' ? { lt: menu.sortOrder } : { gt: menu.sortOrder },
      },
      orderBy: { sortOrder: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbor) return;
    await this.prisma.$transaction([
      this.prisma.menu.update({ where: { id: menu.id }, data: { sortOrder: neighbor.sortOrder } }),
      this.prisma.menu.update({ where: { id: neighbor.id }, data: { sortOrder: menu.sortOrder } }),
    ]);
  }

  async assertOwnership(restaurantId: string, menuId: string) {
    const menu = await this.prisma.menu.findUnique({ where: { id: menuId } });
    if (!menu) throw new NotFoundException('Menu not found');
    if (menu.restaurantId !== restaurantId) {
      throw new ForbiddenException('Menu does not belong to this restaurant');
    }
    return menu;
  }
}
