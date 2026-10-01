import { Body, Controller, Get, Post, Query, Req, Res, Render } from '@nestjs/common';
import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import { LoginRateLimiter } from './login-rate-limiter';

@Controller('admin')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimiter: LoginRateLimiter,
    private readonly i18n: I18nService,
  ) {}

  @Get('login')
  @Render('admin/login')
  loginForm(@Query('redirect') redirect: string | undefined, @Req() req: Request) {
    if (req.session.adminUserId) {
      return { alreadyLoggedIn: true, redirect: redirect ?? '/admin' };
    }
    return { redirect: redirect ?? '/admin', email: '' };
  }

  @Post('login')
  async login(
    @Body('email') email: string | undefined,
    @Body('password') password: string | undefined,
    @Body('redirect') redirect: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const locale = req.locale ?? 'ar';
    const safeRedirect = redirect && redirect.startsWith('/admin') ? redirect : '/admin';
    const rateLimitKey = `${req.ip}:${(email ?? '').toLowerCase()}`;

    const renderError = (error: string) =>
      res.render('admin/login', { redirect: safeRedirect, email, error });

    if (this.rateLimiter.isBlocked(rateLimitKey)) {
      renderError(this.i18n.t('common.admin.auth.tooManyAttempts', { lang: locale }));
      return;
    }

    const invalidCredentialsError = this.i18n.t('common.admin.auth.invalidCredentials', {
      lang: locale,
    });

    if (!email || !password) {
      this.rateLimiter.recordFailure(rateLimitKey);
      renderError(invalidCredentialsError);
      return;
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { restaurant: { select: { slug: true } } },
    });

    const passwordMatches = admin ? await bcrypt.compare(password, admin.passwordHash) : false;

    if (!admin || !passwordMatches) {
      this.rateLimiter.recordFailure(rateLimitKey);
      renderError(invalidCredentialsError);
      return;
    }

    this.rateLimiter.reset(rateLimitKey);

    // Regenerate the session on login so a session id issued before
    // authentication (e.g. to an attacker who shared a login link) can't be
    // reused after it succeeds.
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    req.session.adminUserId = admin.id;
    req.session.restaurantId = admin.restaurantId;
    req.session.restaurantSlug = admin.restaurant.slug;
    req.session.adminName = admin.name;

    req.session.save((err) => {
      if (err) throw err;
      res.redirect(safeRedirect);
    });
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    req.session.destroy(() => {
      res.redirect('/admin/login');
    });
  }
}
