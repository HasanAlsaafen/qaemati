/**
 * Creates (or updates the password of) a platform operator.
 *
 *   npm run super:create -- you@example.org "Your Name"
 *
 * The password comes from SUPER_ADMIN_PASSWORD when set, otherwise a strong one
 * is generated and printed once. Run it against the production database with
 * DATABASE_URL pointing there.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generatePassword } from '../src/super-admin/password';

async function main(): Promise<void> {
  const [email, ...nameParts] = process.argv.slice(2);
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
      update: { passwordHash, name },
      create: { email: email.toLowerCase(), passwordHash, name },
    });
    console.log(`Super admin ready: ${admin.email}`);
    if (fromEnv === undefined) console.log(`Password (shown once): ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
