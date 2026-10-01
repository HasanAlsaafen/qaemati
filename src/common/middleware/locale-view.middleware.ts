import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';

const SUPPORTED_LOCALES = ['ar', 'en'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'ar';
const RTL_LOCALES = new Set<Locale>(['ar']);

function isSupported(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Resolves the active locale the same way the I18nModule resolvers do
 * (query param, then cookie, then Accept-Language, then fallback) and
 * exposes it, the text direction, and a translate helper to every Nunjucks
 * template via res.locals. Resolved independently of nestjs-i18n's own
 * request-scoped middleware so template rendering never depends on which
 * middleware Nest happens to run first.
 */
@Injectable()
export class LocaleViewMiddleware implements NestMiddleware {
  constructor(private readonly i18n: I18nService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const locale = this.resolveLocale(req);
    const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

    res.locals.locale = locale;
    res.locals.dir = dir;
    res.locals.otherLocale = locale === 'ar' ? 'en' : 'ar';
    res.locals.t = (key: string, args?: Record<string, unknown>) =>
      this.i18n.t(key, { lang: locale, args });

    next();
  }

  private resolveLocale(req: Request): Locale {
    const fromQuery = req.query['lang'];
    if (isSupported(fromQuery)) {
      return fromQuery;
    }

    const fromCookie = req.cookies?.['qaemati_locale'];
    if (isSupported(fromCookie)) {
      return fromCookie;
    }

    const acceptLanguage = req.headers['accept-language'];
    if (typeof acceptLanguage === 'string') {
      const preferred = acceptLanguage.split(',')[0]?.split('-')[0]?.trim();
      if (isSupported(preferred)) {
        return preferred;
      }
    }

    return DEFAULT_LOCALE;
  }
}
