import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Guards every /admin/* route except the login page itself. Redirects to
 * login with the originally requested path preserved, so a bookmarked
 * admin URL lands the owner back where they meant to go after signing in.
 */
@Injectable()
export class AdminAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (req.session.adminUserId) {
      next();
      return;
    }

    const redirectTo = encodeURIComponent(req.originalUrl);
    res.redirect(`/admin/login?redirect=${redirectTo}`);
  }
}
