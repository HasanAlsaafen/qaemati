import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { getBaseUrl } from '../seo/seo';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { LoginRateLimiter } from './login-rate-limiter';
import { MIN_PASSWORD_LENGTH, PasswordResetService } from './password-reset.service';

@Controller('admin')
export class PasswordResetController {
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
    res.render('admin/forgot', { email: '' });
  }

  @Post('forgot')
  async forgot(
    @Body() body: ForgotPasswordDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const email = (body.email ?? '').trim().toLowerCase();
    const ipKey = `forgot:${req.ip}`;
    if (await this.rateLimiter.isBlocked(ipKey, 20)) {
      res.status(429).render('admin/forgot', { email, error: this.t(req, 'tooManyAttempts') });
      return;
    }
    await this.rateLimiter.recordFailure(ipKey);

    // A second limit per address stops someone from filling an inbox.
    const emailKey = `forgot-email:${email}`;
    if (email && !(await this.rateLimiter.isBlocked(emailKey))) {
      await this.rateLimiter.recordFailure(emailKey);
      await this.resets.requestReset(email, getBaseUrl(req), req.locale === 'en' ? 'en' : 'ar');
    }
    res.status(200).render('admin/forgot', { sent: true, email });
  }

  @Get('reset/:token')
  async resetForm(@Param('token') token: string, @Res() res: Response): Promise<void> {
    if (!(await this.resets.isValid(token))) {
      res.status(410).render('admin/reset', { invalid: true });
      return;
    }
    res.render('admin/reset', { token });
  }

  @Post('reset/:token')
  async reset(
    @Param('token') token: string,
    @Body() body: ResetPasswordDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!(await this.resets.isValid(token))) {
      res.status(410).render('admin/reset', { invalid: true });
      return;
    }
    const password = body.password ?? '';
    const fieldErrors: Record<string, string> = {};
    if (password.length < MIN_PASSWORD_LENGTH) {
      fieldErrors.password = this.t(req, 'passwordTooShort', { min: MIN_PASSWORD_LENGTH });
    } else if (password !== body.confirm) {
      fieldErrors.confirm = this.t(req, 'passwordMismatch');
    }
    if (Object.keys(fieldErrors).length > 0) {
      res
        .status(422)
        .render('admin/reset', { token, fieldErrors, error: this.t(req, 'fixErrors') });
      return;
    }
    await this.resets.complete(token, password);
    res.redirect(303, '/admin/login?reset=1');
  }
}
