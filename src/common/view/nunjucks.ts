import { NestExpressApplication } from '@nestjs/platform-express';
import * as nunjucks from 'nunjucks';
import { join } from 'path';
import { assetUrl } from './asset-url';
import { currencySymbol } from '../currency';

/**
 * Wires Nunjucks as the Express view engine. Nest has no official Nunjucks
 * adapter, so the engine is registered directly on the underlying Express
 * instance.
 */
export function configureNunjucks(app: NestExpressApplication): void {
  const viewsDir = join(__dirname, '..', '..', '..', 'views');
  const env = nunjucks.configure(viewsDir, {
    autoescape: true,
    watch: process.env.NODE_ENV !== 'production',
    express: app.getHttpAdapter().getInstance(),
  });
  env.addGlobal('asset', assetUrl);
  // 2026-10-08, always Western digits and a fixed order, in both languages.
  env.addFilter('isoDate', (value: Date | string | null | undefined) =>
    value ? new Date(value).toISOString().slice(0, 10) : '',
  );
  // Share of a limit that is used, capped at 100 for a progress bar.
  env.addFilter('percentOf', (used: number, limit: number) =>
    limit > 0 ? Math.min(100, Math.round((used * 100) / limit)) : 0,
  );
  env.addFilter('money', (value: unknown) => Number(value ?? 0).toFixed(2));
  env.addFilter('symbol', (code: string, locale: 'ar' | 'en') => currencySymbol(code, locale));
  env.addFilter('receiptNo', (value: number) => `R-${String(value).padStart(6, '0')}`);

  app.set('view engine', 'njk');
  app.set('views', viewsDir);
}
