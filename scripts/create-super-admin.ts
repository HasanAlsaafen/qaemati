/**
 * Creates (or updates the password of) a platform operator.
 *
 *   npm run super:create -- you@example.org "Your Name"
 *
 * Add --reset-2fa to also turn off the account's authenticator and recovery
 * codes, for an operator who lost both their phone and their recovery codes.
 * They set it up again after signing in.
 *
 * The password comes from SUPER_ADMIN_PASSWORD when set, otherwise a strong one
 * is generated and printed once. Run it against the production database with
 * DATABASE_URL pointing there.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generatePassword } from '../src/super-admin/password';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reset2fa = args.includes('--reset-2fa');
  const [email, ...nameParts] = args.filter((a) => a !== '--reset-2fa');
  const name = nameParts.join(' ').trim() || 'Platform Owner';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage: npm run super:create -- <email> [name]');
    process.exitCode = 1;
    return;
  }
  const fromEnv = process.env.SUPER_ADMIN_PASSWORD;
  if (fromEnv !== undefined && fromEnv.length < 12) {
    console.error('SUPER_ADMIN_PASSWORD must be at least 12 characters.');
    process.exitCode = 1;
    return;
  }
  const password = fromEnv ?? generatePassword(16);
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.superAdmin.upsert({
      where: { email: email.toLowerCase() },
      update: {
        passwordHash,
        name,
        ...(reset2fa
          ? { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] }
          : {}),
      },
      create: { email: email.toLowerCase(), passwordHash, name },
    });
    console.log(`Super admin ready: ${admin.email}`);
    if (reset2fa) console.log('Two step verification was reset. Set it up again after signing in.');
    if (fromEnv === undefined) console.log(`Password (shown once): ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
