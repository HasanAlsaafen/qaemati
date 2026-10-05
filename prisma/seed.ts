import { PrismaClient } from '@prisma/client';
import { DEMO_ADMIN_PASSWORD, runSeed } from '../src/prisma-seed/run-seed';

const prisma = new PrismaClient();

runSeed(prisma)
  .then((summary) => {
    summary.forEach((line) => console.log(line));
    console.log(`\nDemo admin password for every seeded account: ${DEMO_ADMIN_PASSWORD}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
