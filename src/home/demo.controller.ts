import { Controller, ForbiddenException, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { isDemoModeEnabled } from '../common/demo-mode';
import { runSeed } from '../prisma-seed/run-seed';

/**
 * A5: "Reset demo data" -- re-runs the exact seed logic the CLI uses
 * (prisma/seed.ts, now a thin wrapper around src/prisma-seed/run-seed.ts)
 * through the app's own PrismaService rather than shelling out to a
 * child process. Wipes and recreates every restaurant, not just one --
 * acceptable here because this entire endpoint only exists when
 * DEMO_MODE is set, and a demo environment's "reset" is expected to mean
 * "back to the clean two-restaurant demo state," not a scoped per-tenant
 * reset (there is no concept of a tenant resetting only their own data
 * elsewhere in this app either).
 */
@Controller('demo')
export class DemoController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('reset')
  async reset(@Res() res: Response): Promise<void> {
    if (!isDemoModeEnabled()) {
      throw new ForbiddenException('Demo mode is not enabled');
    }
    await runSeed(this.prisma);
    res.redirect('/?demoReset=success');
  }
}
