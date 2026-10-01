import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AcceptLanguageResolver, CookieResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { LocaleViewMiddleware } from './common/middleware/locale-view.middleware';
import { HomeModule } from './home/home.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    I18nModule.forRoot({
      fallbackLanguage: 'ar',
      loaderOptions: {
        path: join(__dirname, '..', 'i18n'),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [
        new QueryResolver(['lang']),
        new CookieResolver(['qaemati_locale']),
        AcceptLanguageResolver,
      ],
    }),
    HomeModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LocaleViewMiddleware).forRoutes('*');
  }
}
