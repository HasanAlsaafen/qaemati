import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { CallWaiterDto, PlaceOrderDto } from './dto/guest-pos.dto';
import { GuestPosError, GuestPosService } from './guest-pos.service';

/** The public side of table service: a guest at a table sends an order or calls the waiter. */
@Controller('m/:slug')
export class GuestPosController {
  constructor(
    private readonly guest: GuestPosService,
    private readonly i18n: I18nService,
  ) {}

  @Post('orders')
  @HttpCode(201)
  async order(
    @Param('slug') slug: string,
    @Body() body: PlaceOrderDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.respond(req, res, () =>
      this.guest.placeOrder(slug, { ...body }, req.ip ?? 'unknown'),
    );
  }

  @Get('orders/:token')
  async status(
    @Param('slug') slug: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.respond(
      req,
      res,
      () => this.guest.orderStatus(slug, token, req.ip ?? 'unknown'),
      200,
    );
  }

  @Post('waiter-calls')
  @HttpCode(201)
  async call(
    @Param('slug') slug: string,
    @Body() body: CallWaiterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.respond(req, res, () =>
      this.guest.callWaiter(slug, { ...body }, req.ip ?? 'unknown'),
    );
  }

  private async respond<T extends object>(
    req: Request,
    res: Response,
    run: () => Promise<T>,
    okStatus = 201,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    try {
      res.status(okStatus).json(await run());
    } catch (error) {
      if (!(error instanceof GuestPosError)) throw error;
      const lang = req.locale ?? 'ar';
      const message = this.i18n.t(`common.menu.tableOrder.errors.${error.code}`, {
        lang,
        args: { item: (lang === 'ar' ? error.detail?.ar : error.detail?.en) ?? '' },
      });
      res.status(error.status).json({ error: error.code, message });
    }
  }
}
