import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Exposes the current CSRF token to every Nunjucks template via
 * res.locals, mirroring how LocaleViewMiddleware exposes `t`/`locale`.
 * req.csrfToken() is attached by doubleCsrfProtection (see main.ts), which
 * must run before this middleware.
 *
 * Called as (overwrite=false, validateOnReuse=false): reuse the existing
 * cookie's token when it's still valid, but if it isn't -- e.g. a stale
 * cookie left over from before the session was established, since
 * express-session's session id isn't stable until something actually
 * saves the session -- silently issue a new one instead of throwing.
 * req.csrfToken()'s own default (validateOnReuse=true) throws in exactly
 * that case, which took down every page with a 500 the first time this
 * was wired up.
 */
@Injectable()
export class CsrfViewMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.locals.csrfToken = req.csrfToken ? req.csrfToken(false, false) : '';
    next();
  }
}
