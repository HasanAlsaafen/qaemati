import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A5: dismisses the first-login guided tour (views/admin/components/
 * guided-tour.njk), whether the admin clicked through every step or hit
 * "Skip." Updates both the DB (so it stays dismissed on the next login,
 * weeks from now) and the session (so it doesn't reappear on the very
 * next page load in this same session, without waiting for a fresh
 * login to re-read the DB).
 */
@Controller('admin/tour')
export class TourController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('dismiss')
  async dismiss(@Req() req: Request, @Res() res: Response): Promise<void> {
    const adminUserId = req.session.adminUserId as string;
    req.session.hasSeenTour = true;
    await this.prisma.adminUser.update({
      where: { id: adminUserId },
      data: { hasSeenTour: true },
    });
    res.status(204).send();
  }
}
