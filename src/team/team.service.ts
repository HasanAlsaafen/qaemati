import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StaffRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PasswordResetService } from '../auth/password-reset.service';
import { ValidationFailedException } from '../common/validation/validation-failed.exception';
import { PrismaService } from '../prisma/prisma.service';
import { generatePassword } from '../super-admin/password';
import { TenancyService } from '../tenancy/tenancy.service';

/** The people who sign in to one restaurant. Every query is scoped to that restaurant. */
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly resets: PasswordResetService,
  ) {}

  async overview(restaurantId: string) {
    const [members, usage, context] = await Promise.all([
      this.prisma.adminUser.findMany({
        where: { restaurantId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.tenancy.usage(restaurantId),
      this.tenancy.getContext(restaurantId),
    ]);
    return {
      members,
      used: usage.adminUsers,
      limit: this.tenancy.limitFor(context.plan, 'adminUsers'),
    };
  }

  /** A new account with a generated password, shown once, and an email with a link to choose their own. */
  async add(
    restaurantId: string,
    input: { name: string; email: string; role: StaffRole },
    mail: { baseUrl: string; locale: 'ar' | 'en' },
  ) {
    await this.tenancy.assertCanAdd(restaurantId, 'adminUsers');
    const password = generatePassword();
    const email = input.email.trim().toLowerCase();
    try {
      await this.prisma.adminUser.create({
        data: {
          restaurantId,
          email,
          name: input.name.trim(),
          role: input.role,
          passwordHash: await bcrypt.hash(password, 10),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ValidationFailedException({ email: ['emailTaken'] }, { ...input });
      }
      throw error;
    }
    const mailed = await this.resets.sendInviteToEmail(email, mail.baseUrl, mail.locale);
    return { email, password, mailed };
  }

  async setRole(restaurantId: string, memberId: string, role: StaffRole, actorId: string) {
    const member = await this.find(restaurantId, memberId);
    if (member.id === actorId) {
      throw new ConflictException('You cannot change your own role');
    }
    if (member.role === 'OWNER' && role !== 'OWNER')
      await this.assertAnotherOwner(restaurantId, memberId);
    await this.prisma.adminUser.update({ where: { id: memberId }, data: { role } });
    // Their open sessions still carry the old role, so they sign in again.
    await this.resets.endSessions('adminUserId', memberId);
  }

  async resetPassword(
    restaurantId: string,
    memberId: string,
    mail: { baseUrl: string; locale: 'ar' | 'en' },
  ) {
    const member = await this.find(restaurantId, memberId);
    const password = generatePassword();
    await this.prisma.adminUser.update({
      where: { id: memberId },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    await this.resets.endSessions('adminUserId', memberId);
    await this.resets.requestReset(member.email, mail.baseUrl, mail.locale);
    return { email: member.email, password, mailed: true };
  }

  async remove(restaurantId: string, memberId: string, actorId: string) {
    const member = await this.find(restaurantId, memberId);
    if (member.id === actorId) throw new ConflictException('You cannot remove your own account');
    if (member.role === 'OWNER') await this.assertAnotherOwner(restaurantId, memberId);
    await this.resets.endSessions('adminUserId', memberId);
    await this.prisma.adminUser.delete({ where: { id: memberId } });
  }

  private async find(restaurantId: string, memberId: string) {
    const member = await this.prisma.adminUser.findFirst({ where: { id: memberId, restaurantId } });
    if (!member) throw new NotFoundException('Team member not found');
    return member;
  }

  /** A restaurant always keeps at least one owner. */
  private async assertAnotherOwner(restaurantId: string, exceptId: string) {
    const others = await this.prisma.adminUser.count({
      where: { restaurantId, role: 'OWNER', id: { not: exceptId } },
    });
    if (others === 0) throw new ConflictException('A restaurant needs at least one owner');
  }
}
