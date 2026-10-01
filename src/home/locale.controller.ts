import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

const SUPPORTED_LOCALES = new Set(['ar', 'en']);
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

@Controller('lang')
export class LocaleController {
  @Get(':code')
  switch(@Param('code') code: string, @Res() res: Response): void {
    const locale = SUPPORTED_LOCALES.has(code) ? code : 'ar';
    res.cookie('qaemati_locale', locale, {
      maxAge: ONE_YEAR_MS,
      httpOnly: false,
      sameSite: 'lax',
    });
    res.redirect(this.sameOriginRedirectTarget(res.req.headers.referer, res.req.headers.host));
  }

  // Helmet's referrerPolicy is "same-origin" (see main.ts), so a non-empty
  // Referer here should only ever be our own origin. This re-validates that
  // against the request's actual Host rather than trusting the policy
  // alone, and redirects to the path only (dropping scheme/host) so the
  // result can never leave the current origin even if that assumption
  // ever breaks.
  private sameOriginRedirectTarget(referer: string | undefined, host: string | undefined): string {
    if (!referer || !host) return '/';
    try {
      const url = new URL(referer);
      if (url.host !== host) return '/';

      // The cookie just set above is now the source of truth for locale.
      // LocaleViewMiddleware resolves ?lang= before the cookie, so if the
      // referer carried its own ?lang= (e.g. a bookmarked or shared link),
      // redirecting back to it verbatim would re-apply that old value and
      // silently undo the switch. Drop it so the new cookie actually wins.
      url.searchParams.delete('lang');
      return `${url.pathname}${url.search}`;
    } catch {
      return '/';
    }
  }
}
