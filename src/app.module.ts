import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { validateEnv } from './config/env.validation';
import { AcceptLanguageResolver, CookieResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LocaleViewMiddleware } from './common/middleware/locale-view.middleware';
import { AdminAuthMiddleware } from './auth/admin-auth.middleware';
import { AdminRoleMiddleware } from './auth/admin-role.middleware';
import { AdminLocalsMiddleware } from './auth/admin-locals.middleware';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { PosModule } from './pos/pos.module';
import { TeamModule } from './team/team.module';
import { SignupModule } from './signup/signup.module';
import { ReportsModule } from './reports/reports.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { BillingNoticesModule } from './billing-notices/billing-notices.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { CsrfViewMiddleware } from './auth/csrf-view.middleware';
import { AdminModule } from './admin/admin.module';
import { HomeModule } from './home/home.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { SuperIpMiddleware } from './super-admin/super-ip.middleware';
import { SuperAdminAuthMiddleware } from './super-admin/super-admin-auth.middleware';
import { FlashMiddleware } from './common/middleware/flash.middleware';
import { FeatureGuard } from './tenancy/requires-feature';
import { TenantContextMiddleware } from './tenancy/tenant-context.middleware';
import { MenuModule } from './menu/menu.module';
import { PrismaModule } from './prisma/prisma.module';
import { StyleguideModule } from './styleguide/styleguide.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
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
    PrismaModule,
    MailModule,
    RateLimitModule,
    PosModule,
    TeamModule,
    SignupModule,
    ReportsModule,
    SuggestionsModule,
    BillingNoticesModule,
    TenancyModule,
    SuperAdminModule,
    HomeModule,
    MenuModule,
    StyleguideModule,
    AuthModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: FeatureGuard },
    // Not applied via consumer.apply() (see configure() below) -- only
    // registered here as a provider so main.ts can fetch an instance with
    // app.get() and app.use() it before session/CSRF middleware.
    LocaleViewMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // LocaleViewMiddleware is applied earlier, directly in main.ts -- see
    // the comment there for why (error pages rendered by middleware that
    // runs before this one need `t` to already be set).
    consumer.apply(CsrfViewMiddleware).forRoutes('*');
    consumer
      .apply(AdminAuthMiddleware)
      .exclude('admin/login', 'admin/logout', 'admin/forgot', 'admin/reset/(.*)')
      .forRoutes('admin');
    consumer
      .apply(AdminRoleMiddleware)
      .exclude('admin/login', 'admin/logout', 'admin/forgot', 'admin/reset/(.*)')
      .forRoutes('admin');
    consumer.apply(FlashMiddleware).forRoutes('super');
    consumer.apply(SuperIpMiddleware).forRoutes('super');
    consumer
      .apply(SuperAdminAuthMiddleware)
      .exclude('super/login', 'super/login/verify', 'super/forgot', 'super/reset/(.*)')
      .forRoutes('super');
    consumer
      .apply(TenantContextMiddleware)
      .exclude('admin/login', 'admin/forgot', 'admin/reset/(.*)')
      .forRoutes('admin');
    consumer.apply(AdminLocalsMiddleware).forRoutes('admin');
  }
}
