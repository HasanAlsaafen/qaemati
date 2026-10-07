import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import { LoginDto } from '../auth/dto/login.dto';
import { LoginRateLimiter } from '../auth/login-rate-limiter';
import { PrismaService } from '../prisma/prisma.service';

@Controller('super')
export class SuperAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: LoginRateLimiter,
    private readonly i18n: I18nService,
  ) {}

  @Get('login')
  form(@Req() req: Request, @Res() res: Response): void {
    if (req.session.superAdminId) return res.redirect('/super');
    res.render('super/login', { email: '' });
  }

  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    const locale = req.locale ?? 'ar';
    const email = (body.email ?? '').trim().toLowerCase();
    const key = `super:${req.ip}:${email}`;
    const fail = (message: string) =>
      res.status(200).render('super/login', { email, error: message });
    const t = (k: string) => this.i18n.t(`common.admin.auth.${k}`, { lang: locale });

    if (this.limiter.isBlocked(key)) return void fail(t('tooManyAttempts'));
    const admin =
      email && body.password ? await this.prisma.superAdmin.findUnique({ where: { email } }) : null;
    // Compared even when the account does not exist, so timing does not reveal it.
    const hash =
      admin?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid.';
    const matches = await bcrypt.compare(body.password ?? '', hash).catch(() => false);
    if (!admin || !matches) {
      this.limiter.recordFailure(key);
      return void fail(t('invalidCredentials'));
    }
    this.limiter.reset(key);
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    req.session.superAdminId = admin.id;
    req.session.superAdminName = admin.name;
    req.session.save((err) => {
      if (err) throw err;
      res.redirect('/super');
    });
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    req.session.destroy(() => res.redirect('/super/login'));
  }
}
