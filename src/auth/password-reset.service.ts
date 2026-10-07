import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { inviteMail, resetPasswordMail } from '../mail/mail-templates';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export const RESET_MINUTES = 60;
export const INVITE_DAYS = 3;
export const MIN_PASSWORD_LENGTH = 10;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Always silent about whether the address exists, so it cannot be probed. */
  async requestReset(email: string, baseUrl: string, locale: 'ar' | 'en'): Promise<void> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!admin) return;
    const token = await this.issue(admin.id, RESET_MINUTES * 60_000);
    await this.mail.send(
      resetPasswordMail(
        locale,
        admin.email,
        admin.name,
        `${baseUrl}/admin/reset/${token}`,
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
    const token = await this.issue(admin.id, INVITE_DAYS * 86_400_000);
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

  async isValid(token: string): Promise<boolean> {
    return (await this.find(token)) !== null;
  }

  /** Sets the password, spends the link and signs the account out everywhere. */
  async complete(token: string, password: string): Promise<boolean> {
    const record = await this.find(token);
    if (!record) return false;
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction([
      this.prisma.adminUser.update({ where: { id: record.adminUserId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.deleteMany({ where: { adminUserId: record.adminUserId } }),
    ]);
    try {
      await this.prisma
        .$executeRaw`DELETE FROM "session" WHERE sess->>'adminUserId' = ${record.adminUserId}`;
    } catch (error) {
      this.logger.warn(
        `Could not end old sessions: ${error instanceof Error ? error.message : error}`,
      );
    }
    return true;
  }

  private async issue(adminUserId: string, lifetimeMs: number): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { adminUserId } }),
      this.prisma.passwordResetToken.create({
        data: {
          adminUserId,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + lifetimeMs),
        },
      }),
    ]);
    return token;
  }

  private find(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return Promise.resolve(null);
    return this.prisma.passwordResetToken.findFirst({
      where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    });
  }
}
