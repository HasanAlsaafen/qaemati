import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { inviteMail, resetPasswordMail } from '../mail/mail-templates';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export const RESET_MINUTES = 60;
export const INVITE_DAYS = 3;
export const MIN_PASSWORD_LENGTH = 10;
export type ResetArea = 'admin' | 'super';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Always silent about whether the address exists, so it cannot be probed. */
  async requestReset(
    email: string,
    baseUrl: string,
    locale: 'ar' | 'en',
    area: ResetArea = 'admin',
  ): Promise<void> {
    const address = email.trim().toLowerCase();
    const account =
      area === 'super'
        ? await this.prisma.superAdmin.findUnique({ where: { email: address } })
        : await this.prisma.adminUser.findUnique({ where: { email: address } });
    if (!account) return;
    const token = await this.issue(area, account.id, RESET_MINUTES * 60_000);
    await this.mail.send(
      resetPasswordMail(
        locale,
        account.email,
        account.name,
        `${baseUrl}/${area}/reset/${token}`,
        RESET_MINUTES,
      ),
    );
  }

  /** The first sign in link for an account an operator created. */
  async sendInvite(adminId: string, baseUrl: string, locale: 'ar' | 'en'): Promise<boolean> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      include: { restaurant: true },
    });
    if (!admin) return false;
    const token = await this.issue('admin', admin.id, INVITE_DAYS * 86_400_000);
    const restaurant = locale === 'ar' ? admin.restaurant.nameAr : admin.restaurant.nameEn;
    return this.mail.send(
      inviteMail(
        locale,
        admin.email,
        admin.name,
        restaurant,
        `${baseUrl}/admin/reset/${token}`,
        INVITE_DAYS,
      ),
    );
  }

  async sendInviteToEmail(email: string, baseUrl: string, locale: 'ar' | 'en'): Promise<boolean> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return admin ? this.sendInvite(admin.id, baseUrl, locale) : false;
  }

  async isValid(token: string, area: ResetArea = 'admin'): Promise<boolean> {
    return (await this.find(token, area)) !== null;
  }

  /** Sets the password, spends the link and signs the account out everywhere. */
  async complete(token: string, password: string, area: ResetArea = 'admin'): Promise<boolean> {
    const record = await this.find(token, area);
    if (!record) return false;
    const passwordHash = await bcrypt.hash(password, area === 'super' ? 12 : 10);
    const accountId = (area === 'super' ? record.superAdminId : record.adminUserId) as string;
    await this.prisma.$transaction([
      area === 'super'
        ? this.prisma.superAdmin.update({ where: { id: accountId }, data: { passwordHash } })
        : this.prisma.adminUser.update({ where: { id: accountId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.deleteMany({
        where: area === 'super' ? { superAdminId: accountId } : { adminUserId: accountId },
      }),
    ]);
    await this.endSessions(area === 'super' ? 'superAdminId' : 'adminUserId', accountId);
    return true;
  }

  /** Ends every open session of an account, for example after a password change. */
  async endSessions(field: 'adminUserId' | 'superAdminId', accountId: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`DELETE FROM "session" WHERE sess->>${field} = ${accountId}`;
    } catch (error) {
      this.logger.warn(
        `Could not end old sessions: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async issue(area: ResetArea, accountId: string, lifetimeMs: number): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const owner = area === 'super' ? { superAdminId: accountId } : { adminUserId: accountId };
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: owner }),
      this.prisma.passwordResetToken.create({
        data: {
          ...owner,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + lifetimeMs),
        },
      }),
    ]);
    return token;
  }

  private find(token: string, area: ResetArea) {
    if (!/^[a-f0-9]{64}$/.test(token)) return Promise.resolve(null);
    return this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
        ...(area === 'super' ? { superAdminId: { not: null } } : { adminUserId: { not: null } }),
      },
    });
  }
}
