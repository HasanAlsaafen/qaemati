import { Controller, Get, NotFoundException, Query, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { isDemoModeEnabled } from '../common/demo-mode';
import { PosService } from '../pos/pos.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The staff screen as a read-only picture for the landing page tour: the same
 * board partial the cashier uses, filled with the demo restaurant's real
 * rows, with no scripts and no way to press anything. It exists only when
 * DEMO_MODE is on, because on a real restaurant it would publish its orders.
 */
@Controller('demo')
export class DemoBoardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pos: PosService,
  ) {}

  @Get('board')
  @Render('pages/demo-board')
  async board(@Query('slug') slug: string | undefined, @Res({ passthrough: true }) res: Response) {
    if (!isDemoModeEnabled()) throw new NotFoundException();
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug: slug ?? '' },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException();
    res.setHeader('Cache-Control', 'no-store');
    return { role: 'OWNER', ...(await this.pos.board(restaurant.id, 'OWNER')) };
  }
}
