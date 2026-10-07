import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Exposes the signed-in admin's name and restaurant slug to every admin
 * template via res.locals (used by layouts/admin.njk for the "Preview
 * menu" link and the "Signed in as..." label), so controllers don't each
 * have to pass them through manually.
 */
@Injectable()
export class AdminLocalsMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    res.locals.adminName = req.session.adminName;
    res.locals.adminRole = req.session.adminRole ?? 'OWNER';
    res.locals.restaurantSlug = req.session.restaurantSlug;
    // A5: show the first-login guided tour until dismissed (see
    // tour.controller.ts). req.session.hasSeenTour is undefined for any
    // session that predates this feature -- treated as "not seen" so
    // existing logged-in sessions get the tour too, not just new logins.
    res.locals.showTour =
      (req.session.adminRole ?? 'OWNER') === 'OWNER' &&
      (req.session.hasSeenTour === false || req.session.hasSeenTour === undefined);
    // The category blocks that offer "move to another menu" are rendered
    // by several controllers. Loading the list here means none of them
    // can forget it. A handler that changes the menus passes a fresh list
    // itself, which wins over this one.
    try {
      const restaurantId = req.session.restaurantId;
      res.locals.menus = restaurantId
        ? await this.prisma.menu.findMany({
            where: { restaurantId },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, nameAr: true, nameEn: true },
          })
        : [];
      next();
    } catch (error) {
      next(error);
    }
  }
}
