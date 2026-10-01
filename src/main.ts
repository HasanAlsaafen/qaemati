import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { join } from 'path';
import { AppModule } from './app.module';
import { configureNunjucks } from './common/view/nunjucks';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Alpine.js evaluates x-data/x-show/etc expressions with `new
          // Function(...)`, which the default CSP's script-src blocks.
          // There is no way around this short of precompiling every
          // template's Alpine expressions, so unsafe-eval is allowed only
          // for same-origin scripts (nothing external is ever loaded).
          'script-src': ["'self'", "'unsafe-eval'"],
        },
      },
      // Helmet's default is "no-referrer", which strips the Referer header
      // entirely. The language switch (LocaleController) depends on Referer
      // to know which page to redirect back to. "same-origin" still sends
      // it for our own navigations (fixing that) while never leaking it
      // cross-origin, which is more private than the browser's own default
      // policy, and makes the Referer value safe to trust for a redirect
      // target (a cross-origin request can never produce one).
      referrerPolicy: { policy: 'same-origin' },
    }),
  );
  // gzip/brotli everything. Express sends no Content-Encoding by default,
  // and our HTML/CSS are mostly repeated Tailwind class names and JSON,
  // which compress extremely well (found via a Lighthouse run showing a
  // ~90KB uncompressed menu page).
  app.use(compression());
  app.use(cookieParser());
  app.useStaticAssets(join(__dirname, '..', 'public'));

  configureNunjucks(app);
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
