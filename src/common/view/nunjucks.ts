import { NestExpressApplication } from '@nestjs/platform-express';
import * as nunjucks from 'nunjucks';
import { join } from 'path';

/**
 * Wires Nunjucks as the Express view engine. Nest has no official Nunjucks
 * adapter, so the engine is registered directly on the underlying Express
 * instance.
 */
export function configureNunjucks(app: NestExpressApplication): void {
  const viewsDir = join(__dirname, '..', '..', '..', 'views');
  nunjucks.configure(viewsDir, {
    autoescape: true,
    watch: process.env.NODE_ENV !== 'production',
    express: app.getHttpAdapter().getInstance(),
  });

  app.set('view engine', 'njk');
  app.set('views', viewsDir);
}
