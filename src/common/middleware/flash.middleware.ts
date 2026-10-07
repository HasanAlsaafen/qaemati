import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * A plain form post ends in a redirect, so the message about what happened has
 * to ride in the session. This moves it onto the template locals for exactly
 * one render and clears it.
 */
@Injectable()
export class FlashMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (req.session?.flash) {
      res.locals.flash = req.session.flash;
      delete req.session.flash;
    }
    next();
  }
}
