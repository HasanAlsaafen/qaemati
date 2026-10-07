import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { ForgotPasswordDto, ResetPasswordDto } from '../auth/dto/password-reset.dto';
import { LoginRateLimiter } from '../auth/login-rate-limiter';
import { PasswordResetService } from '../auth/password-reset.service';
import { getBaseUrl } from '../seo/seo';
import { MIN_OPERATOR_PASSWORD } from './security-policy';

/** The same flow as a restaurant owner's, for platform operators, with a longer minimum. */
@Controller('super')
export class SuperPasswordResetController {
  constructor(
    private readonly resets: PasswordResetService,
    private readonly rateLimiter: LoginRateLimiter,
    private readonly i18n: I18nService,
  ) {}

  private t(req: Request, key: string, args?: Record<string, unknown>): string {
    return this.i18n.t(`common.admin.auth.${key}`, { lang: req.locale ?? 'ar', args });
  }

  @Get('forgot')
  forgotForm(@Res() res: Response): void {
    res.render('admin/forgot', { area: 'super', email: '' });
  }

  @Post('forgot')
  async forgot(
    @Body() body: ForgotPasswordDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const email = (body.email ?? '').trim().toLowerCase();
    const ipKey = `super-forgot:${req.ip}`;
    if (await this.rateLimiter.isBlocked(ipKey, 20)) {
      res
        .status(429)
        .render('admin/forgot', { area: 'super', email, error: this.t(req, 'tooManyAttempts') });
      return;
    }
    await this.rateLimiter.recordFailure(ipKey);
    const emailKey = `super-forgot-email:${email}`;
    if (email && !(await this.rateLimiter.isBlocked(emailKey))) {
      await this.rateLimiter.recordFailure(emailKey);
      await this.resets.requestReset(
        email,
        getBaseUrl(req),
        req.locale === 'en' ? 'en' : 'ar',
        'super',
      );
    }
    res.status(200).render('admin/forgot', { area: 'super', sent: true, email });
  }

  @Get('reset/:token')
  async resetForm(@Param('token') token: string, @Res() res: Response): Promise<void> {
    if (!(await this.resets.isValid(token, 'super'))) {
      res.status(410).render('admin/reset', { area: 'super', invalid: true });
      return;
    }
    res.render('admin/reset', { area: 'super', token, minLength: MIN_OPERATOR_PASSWORD });
  }

  @Post('reset/:token')
  async reset(
    @Param('token') token: string,
    @Body() body: ResetPasswordDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!(await this.resets.isValid(token, 'super'))) {
      res.status(410).render('admin/reset', { area: 'super', invalid: true });
      return;
    }
    const password = body.password ?? '';
    const fieldErrors: Record<string, string> = {};
    if (password.length < MIN_OPERATOR_PASSWORD) {
      fieldErrors.password = this.t(req, 'passwordTooShort', { min: MIN_OPERATOR_PASSWORD });
    } else if (password !== body.confirm) {
      fieldErrors.confirm = this.t(req, 'passwordMismatch');
    }
    if (Object.keys(fieldErrors).length > 0) {
      res.status(422).render('admin/reset', {
        area: 'super',
        token,
        minLength: MIN_OPERATOR_PASSWORD,
        fieldErrors,
        error: this.t(req, 'fixErrors'),
      });
      return;
    }
    await this.resets.complete(token, password, 'super');
    res.redirect(303, '/super/login?reset=1');
  }
}
