import { Injectable } from '@nestjs/common';
import { SuperAdmin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotp,
} from './totp';

@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * An authenticator code or a recovery code. A code is spent by recording
   * its step in the same statement that checks it, so two requests sent at
   * once cannot both use it.
   */
  async checkCode(admin: SuperAdmin, input: string): Promise<boolean> {
    if (!admin.totpSecretEnc) return false;
    const step = verifyTotp(decryptSecret(admin.totpSecretEnc), input, admin.totpLastStep);
    if (step !== null) {
      const claimed = await this.prisma.superAdmin.updateMany({
        where: {
          id: admin.id,
          OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
        },
        data: { totpLastStep: step },
      });
      return claimed.count === 1;
    }
    return this.useRecoveryCode(admin, input);
  }

  private async useRecoveryCode(admin: SuperAdmin, input: string): Promise<boolean> {
    if (!/^[a-z0-9]{5}[\s-]?[a-z0-9]{5}$/i.test(input.trim())) return false;
    const hash = hashRecoveryCode(input);
    if (!admin.recoveryCodes.includes(hash)) return false;
    const fresh = await this.prisma.superAdmin.findUnique({ where: { id: admin.id } });
    if (!fresh?.recoveryCodes.includes(hash)) return false;
    const updated = await this.prisma.superAdmin.updateMany({
      where: { id: admin.id, recoveryCodes: { equals: fresh.recoveryCodes } },
      data: { recoveryCodes: fresh.recoveryCodes.filter((h) => h !== hash) },
    });
    return updated.count === 1;
  }

  /** Stores a confirmed secret and returns the recovery codes, shown once. */
  async enable(adminId: string, secret: string, step: number): Promise<string[]> {
    const codes = generateRecoveryCodes();
    await this.prisma.superAdmin.update({
      where: { id: adminId },
      data: {
        totpSecretEnc: encryptSecret(secret),
        totpEnabledAt: new Date(),
        totpLastStep: step,
        recoveryCodes: codes.map(hashRecoveryCode),
      },
    });
    return codes;
  }

  async disable(adminId: string): Promise<void> {
    await this.prisma.superAdmin.update({
      where: { id: adminId },
      data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] },
    });
  }

  async newRecoveryCodes(adminId: string): Promise<string[]> {
    const codes = generateRecoveryCodes();
    await this.prisma.superAdmin.update({
      where: { id: adminId },
      data: { recoveryCodes: codes.map(hashRecoveryCode) },
    });
    return codes;
  }
}
