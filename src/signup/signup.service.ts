import { Inject, Injectable } from '@nestjs/common';
import { Plan, Restaurant } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { MIN_PASSWORD_LENGTH } from '../auth/password-reset.service';
import { RATE_LIMIT_STORE, RateLimitStore } from '../common/rate-limit/rate-limit-store';
import { MailService } from '../mail/mail.service';
import { signupExistsMail, signupVerifyMail } from '../mail/mail-templates';
import { PrismaService } from '../prisma/prisma.service';
import { ProvisionConflict, TenantProvisioner } from '../provisioning/tenant-provisioner.service';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
export const SIGNUP_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

export type SignupProblem =
  | { field: 'slug'; key: 'slugTaken' | 'slugReserved' }
  | { field: 'planId'; key: 'planUnavailable' }
  | { field: 'password'; key: 'passwordTooShort' }
  | { field: 'confirm'; key: 'passwordMismatch' }
  | { field: 'form'; key: 'tooMany' | 'mailDown' };

export interface SignupInput {
  nameAr: string;
  nameEn: string;
  slug: string;
  planId: string;
  ownerName: string;
  email: string;
  password: string;
  confirm: string;
}

export interface SignupContext {
  ip: string;
  baseUrl: string;
  locale: 'ar' | 'en';
}

/**
 * Self sign up. Nothing is created for the restaurant until the owner follows
 * the link in the email, so a stranger's address cannot be claimed, the
 * database cannot be filled with restaurants by a script, and the owner has
 * proved the address works before it becomes their only way to reset a password.
 */
@Injectable()
export class SignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly provisioner: TenantProvisioner,
    @Inject(RATE_LIMIT_STORE) private readonly limits: RateLimitStore,
  ) {}

  /** Off with SIGNUP_ENABLED=false. */
  static enabled(): boolean {
    return process.env.SIGNUP_ENABLED !== 'false';
  }

  plans(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceAmount: 'asc' }],
    });
  }

  /**
   * Signing up needs a plan to start a trial on, and in production a working
   * mailbox, because the confirmation link is the only thing that creates the
   * restaurant.
   */
  async available(): Promise<boolean> {
    if (!SignupService.enabled()) return false;
    if (process.env.NODE_ENV === 'production' && !this.mail.configured) return false;
    return (await this.plans()).length > 0;
  }

  /** Returns what is wrong with the form, or null when a confirmation email went out (or was quietly dropped for a bot). */
  async request(input: SignupInput, context: SignupContext): Promise<SignupProblem | null> {
    if (input.password.length < MIN_PASSWORD_LENGTH)
      return { field: 'password', key: 'passwordTooShort' };
    if (input.password !== input.confirm) return { field: 'confirm', key: 'passwordMismatch' };
    const email = input.email.trim().toLowerCase();
    const slug = input.slug.trim();

    if (!(
      (await this.allow(`signup-ip:${context.ip}`, 6)) &&
      (await this.allow(`signup-email:${email}`, 3))
    )) {
      return { field: 'form', key: 'tooMany' };
    }
    await this.prisma.signupRequest.deleteMany({ where: { expiresAt: { lte: new Date() } } });

    const plan = await this.prisma.plan.findFirst({ where: { id: input.planId, isActive: true } });
    if (!plan) return { field: 'planId', key: 'planUnavailable' };
    if (this.provisioner.isReserved(slug)) return { field: 'slug', key: 'slugReserved' };
    const [takenBy, pending] = await Promise.all([
      this.prisma.restaurant.findUnique({ where: { slug }, select: { id: true } }),
      this.prisma.signupRequest.findFirst({
        where: { slug, email: { not: email } },
        select: { id: true },
      }),
    ]);
    if (takenBy || pending) return { field: 'slug', key: 'slugTaken' };

    // Whether this email already has an account is not for a stranger to learn:
    // the page answers the same, and the owner of the address is told by email.
    const existing =
      (await this.prisma.adminUser.findUnique({ where: { email }, select: { id: true } })) ||
      (await this.prisma.superAdmin.findUnique({ where: { email }, select: { id: true } }));
    if (existing) {
      const sent = await this.mail.send(
        signupExistsMail(context.locale, email, `${context.baseUrl}/admin/login`),
      );
      return sent || !this.mail.configured ? null : { field: 'form', key: 'mailDown' };
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.signupRequest.deleteMany({ where: { email } });
    await this.prisma.signupRequest.create({
      data: {
        tokenHash: hashToken(token),
        email,
        ownerName: input.ownerName.trim(),
        passwordHash: await bcrypt.hash(input.password, 10),
        nameAr: input.nameAr.trim(),
        nameEn: input.nameEn.trim(),
        slug,
        planId: plan.id,
        expiresAt: new Date(Date.now() + SIGNUP_HOURS * HOUR_MS),
      },
    });
    const restaurant = context.locale === 'ar' ? input.nameAr.trim() : input.nameEn.trim();
    const delivered = await this.mail.send(
      signupVerifyMail(
        context.locale,
        email,
        input.ownerName.trim(),
        restaurant,
        `${context.baseUrl}/signup/verify/${token}`,
        SIGNUP_HOURS,
      ),
    );
    if (!delivered && process.env.NODE_ENV === 'production') {
      await this.prisma.signupRequest.deleteMany({ where: { email } });
      return { field: 'form', key: 'mailDown' };
    }
    return null;
  }

  /** A request still waiting, for the confirmation page. Reading it does not use it up. */
  async peek(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    return this.prisma.signupRequest.findFirst({
      where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
      select: {
        nameAr: true,
        nameEn: true,
        slug: true,
        email: true,
        plan: { select: { nameAr: true, nameEn: true, trialDays: true } },
      },
    });
  }

  /**
   * Creates the restaurant from a confirmed request. The request is deleted
   * first, so a link can only ever be used once, even if opened twice at once.
   */
  async complete(
    token: string,
  ): Promise<{ restaurant: Restaurant; ownerId: string; ownerName: string } | 'gone' | 'taken'> {
    if (!/^[a-f0-9]{64}$/.test(token)) return 'gone';
    const request = await this.prisma.signupRequest.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { plan: true },
    });
    if (!request || request.expiresAt <= new Date()) return 'gone';
    // Whoever's delete removes the row owns the link. A second click at the same
    // moment removes nothing and is told the link is used.
    const claimed = await this.prisma.signupRequest.deleteMany({ where: { id: request.id } });
    if (claimed.count !== 1) return 'gone';
    try {
      const restaurant = await this.provisioner.provision({
        slug: request.slug,
        nameAr: request.nameAr,
        nameEn: request.nameEn,
        plan: request.plan,
        start: { mode: 'TRIAL' },
        owner: {
          name: request.ownerName,
          email: request.email,
          passwordHash: request.passwordHash,
        },
      });
      const owner = await this.prisma.adminUser.findFirstOrThrow({
        where: { restaurantId: restaurant.id },
      });
      return { restaurant, ownerId: owner.id, ownerName: owner.name };
    } catch (error) {
      if (error instanceof ProvisionConflict) return 'taken';
      throw error;
    }
  }

  private async allow(key: string, perHour: number): Promise<boolean> {
    try {
      return (await this.limits.hit(key, HOUR_MS)) <= perHour;
    } catch {
      return true;
    }
  }
}
