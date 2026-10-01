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
    const referer = res.req.headers.referer;
    res.redirect(referer && referer.length > 0 ? referer : '/');
  }
}
