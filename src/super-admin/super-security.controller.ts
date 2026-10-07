import { Body, Controller, Get, NotFoundException, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import * as QRCode from 'qrcode';
import { PasswordResetService } from '../auth/password-reset.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { ChangeOperatorPasswordDto, DisableTwoFactorDto, VerifyCodeDto } from './dto/security.dto';
import { MIN_OPERATOR_PASSWORD, requireTwoFactor } from './security-policy';
import { actorOf, flashSuccess } from './super-http';
import { decryptSecret, encryptSecret, generateTotpSecret, otpauthUri, verifyTotp } from './totp';
import { TwoFactorService } from './two-factor.service';

@Controller('super/security')
export class SuperSecurityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twoFactor: TwoFactorService,
    private readonly audit: AuditService,
    private readonly resets: PasswordResetService,
    private readonly i18n: I18nService,
  ) {}

  private t(req: Request, key: string, args?: Record<string, unknown>): string {
    return this.i18n.t(`common.super.security.${key}`, { lang: req.locale ?? 'ar', args });
  }

  private async me(req: Request) {
    const admin = await this.prisma.superAdmin.findUnique({
      where: { id: req.session.superAdminId },
    });
    if (!admin) throw new NotFoundException();
    return admin;
  }

  private back(req: Request, res: Response, message: string, to = '/super/security'): void {
    req.session.flash = { type: 'danger', message };
    res.redirect(303, to);
  }

  @Get()
  async index(@Req() req: Request, @Res() res: Response): Promise<void> {
    const admin = await this.me(req);
    res.render('super/security', {
      section: 'security',
      enabled: Boolean(admin.totpEnabledAt),
      enabledAt: admin.totpEnabledAt,
      required: requireTwoFactor(),
      recoveryLeft: admin.recoveryCodes.length,
      email: admin.email,
    });
  }

  @Get('setup')
  async setup(@Req() req: Request, @Res() res: Response): Promise<void> {
    const admin = await this.me(req);
    if (admin.totpEnabledAt) return res.redirect('/super/security');
    const secret = generateTotpSecret();
    req.session.pendingTotpSecret = encryptSecret(secret);
    await this.renderSetup(res, secret, admin.email);
  }

  @Post('enable')
  async enable(
    @Body() body: VerifyCodeDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const admin = await this.me(req);
    const stored = req.session.pendingTotpSecret;
    if (!stored || admin.totpEnabledAt) return res.redirect('/super/security');
    const secret = decryptSecret(stored);
    const step = verifyTotp(secret, body.code ?? '', null);
    if (step === null) {
      res.status(422);
      return this.renderSetup(res, secret, admin.email, this.t(req, 'wrongCode'));
    }
    const codes = await this.twoFactor.enable(admin.id, secret, step);
    delete req.session.pendingTotpSecret;
    req.session.superTwoFactor = true;
    await this.audit.log(actorOf(req), 'super.2fa_enabled');
    res
      .status(200)
      .render('super/security-codes', { section: 'security', codes, title: 'enabled' });
  }

  @Post('disable')
  async disable(
    @Body() body: DisableTwoFactorDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (requireTwoFactor()) return this.back(req, res, this.t(req, 'cannotDisable'));
    const admin = await this.me(req);
    const passwordOk = await bcrypt.compare(body.password ?? '', admin.passwordHash);
    if (!passwordOk || !(await this.twoFactor.checkCode(admin, body.code ?? ''))) {
      return this.back(req, res, this.t(req, 'wrongPasswordOrCode'));
    }
    await this.twoFactor.disable(admin.id);
    req.session.superTwoFactor = false;
    await this.audit.log(actorOf(req), 'super.2fa_disabled');
    flashSuccess(req, this.i18n, 'twoFactorOff');
    res.redirect(303, '/super/security');
  }

  @Post('recovery')
  async recovery(
    @Body() body: VerifyCodeDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const admin = await this.me(req);
    if (!admin.totpEnabledAt || !(await this.twoFactor.checkCode(admin, body.code ?? ''))) {
      return this.back(req, res, this.t(req, 'wrongCode'));
    }
    const codes = await this.twoFactor.newRecoveryCodes(admin.id);
    await this.audit.log(actorOf(req), 'super.recovery_codes_renewed');
    res
      .status(200)
      .render('super/security-codes', { section: 'security', codes, title: 'renewed' });
  }

  @Post('password')
  async password(
    @Body() body: ChangeOperatorPasswordDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const admin = await this.me(req);
    if (!(await bcrypt.compare(body.current ?? '', admin.passwordHash))) {
      return this.back(req, res, this.t(req, 'wrongCurrentPassword'));
    }
    const next = body.password ?? '';
    if (next.length < MIN_OPERATOR_PASSWORD) {
      return this.back(req, res, this.t(req, 'passwordTooShort', { min: MIN_OPERATOR_PASSWORD }));
    }
    if (next !== body.confirm) return this.back(req, res, this.t(req, 'passwordMismatch'));
    await this.prisma.superAdmin.update({
      where: { id: admin.id },
      data: { passwordHash: await bcrypt.hash(next, 12) },
    });
    await this.audit.log(actorOf(req), 'super.password_changed');
    await this.resets.endSessions('superAdminId', admin.id);
    req.session.destroy(() => res.redirect(303, '/super/login?reset=1'));
  }

  private async renderSetup(
    res: Response,
    secret: string,
    account: string,
    error?: string,
  ): Promise<void> {
    const qr = await QRCode.toDataURL(otpauthUri(secret, account), { margin: 1, width: 220 });
    res.render('super/security-setup', {
      section: 'security',
      qr,
      secret: secret.replace(/(.{4})/g, '$1 ').trim(),
      error,
    });
  }
}
