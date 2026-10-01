import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
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
    }),
  );
  app.use(cookieParser());
  app.useStaticAssets(join(__dirname, '..', 'public'));

  configureNunjucks(app);
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
