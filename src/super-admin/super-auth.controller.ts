import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import { LoginDto } from '../auth/dto/login.dto';
import { LoginRateLimiter } from '../auth/login-rate-limiter';
import { PrismaService } from '../prisma/prisma.service';
import { VerifyCodeDto } from './dto/security.dto';
import { TwoFactorService } from './two-factor.service';

const PENDING_MS = 5 * 60 * 1000;

@Controller('super')
export class SuperAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: LoginRateLimiter,
    private readonly i18n: I18nService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  private t(req: Request, key: string): string {
    return this.i18n.t(`common.admin.auth.${key}`, { lang: req.locale ?? 'ar' });
  }

  @Get('login')
  form(@Req() req: Request, @Res() res: Response): void {
    if (req.session.superAdminId) return res.redirect('/super');
    res.render('super/login', { email: '', resetDone: req.query.reset === '1' });
  }

  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    const email = (body.email ?? '').trim().toLowerCase();
    const key = `super:${req.ip}:${email}`;
    const fail = (message: string) =>
      res.status(200).render('super/login', { email, error: message });

    if (await this.limiter.isBlocked(key)) return void fail(this.t(req, 'tooManyAttempts'));
    const admin =
      email && body.password ? await this.prisma.superAdmin.findUnique({ where: { email } }) : null;
    // Compared even when the account does not exist, so timing does not reveal it.
    const hash =
      admin?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid.';
    const matches = await bcrypt.compare(body.password ?? '', hash).catch(() => false);
    if (!admin || !matches) {
      await this.limiter.recordFailure(key);
      return void fail(this.t(req, 'invalidCredentials'));
    }
    await this.limiter.reset(key);
    await this.regenerate(req);

    if (admin.totpEnabledAt) {
      req.session.pendingSuperAdminId = admin.id;
      req.session.pendingSuperAdminAt = Date.now();
      return this.save(req, () => res.redirect('/super/login/verify'));
    }
    this.signIn(req, admin.id, admin.name, false);
    this.save(req, () => res.redirect('/super'));
  }

  @Get('login/verify')
  verifyForm(@Req() req: Request, @Res() res: Response): void {
    if (!this.pendingId(req)) return res.redirect('/super/login');
    res.render('super/verify', {});
  }

  @Post('login/verify')
  async verify(
    @Body() body: VerifyCodeDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const id = this.pendingId(req);
    if (!id) return res.redirect('/super/login');
    const key = `super2fa:${id}`;
    const reject = (message: string, status = 200) =>
      res.status(status).render('super/verify', { error: message });

    if (await this.limiter.isBlocked(key)) {
      delete req.session.pendingSuperAdminId;
      return void res.status(200).render('super/login', {
        email: '',
        error: this.t(req, 'tooManyAttempts'),
      });
    }
    const admin = await this.prisma.superAdmin.findUnique({ where: { id } });
    if (!admin || !(await this.twoFactor.checkCode(admin, body.code ?? ''))) {
      await this.limiter.recordFailure(key);
      return reject(this.i18n.t('common.super.security.wrongCode', { lang: req.locale ?? 'ar' }));
    }
    await this.limiter.reset(key);
    await this.regenerate(req);
    this.signIn(req, admin.id, admin.name, true);
    this.save(req, () => res.redirect('/super'));
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    req.session.destroy(() => res.redirect('/super/login'));
  }

  private pendingId(req: Request): string | undefined {
    const at = req.session.pendingSuperAdminAt ?? 0;
    return Date.now() - at < PENDING_MS ? req.session.pendingSuperAdminId : undefined;
  }

  private signIn(req: Request, id: string, name: string, twoFactor: boolean): void {
    req.session.superAdminId = id;
    req.session.superAdminName = name;
    req.session.superTwoFactor = twoFactor;
  }

  private regenerate(req: Request): Promise<void> {
    return new Promise((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
  }

  private save(req: Request, done: () => void): void {
    req.session.save((err) => {
      if (err) throw err;
      done();
    });
  }
}
