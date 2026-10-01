import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Exposes the signed-in admin's name and restaurant slug to every admin
 * template via res.locals (used by layouts/admin.njk for the "Preview
 * menu" link and the "Signed in as..." label), so controllers don't each
 * have to pass them through manually.
 */
@Injectable()
export class AdminLocalsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.locals.adminName = req.session.adminName;
    res.locals.restaurantSlug = req.session.restaurantSlug;
    next();
  }
}
