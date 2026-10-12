import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { CallWaiterDto, PlaceOrderDto } from './dto/guest-pos.dto';
import { GuestPosError, GuestPosService } from './guest-pos.service';
import { sessionIdleMs, signSessionCookie, TABLE_SESSION_COOKIE } from './table-session-token';

const sessionCookie = (req: Request): unknown => req.cookies?.[TABLE_SESSION_COOKIE];

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
    await this.respond(req, res, async () => {
      const { sessionId, ...result } = await this.guest.placeOrder(
        slug,
        { ...body },
        req.ip ?? 'unknown',
      );
      // The proof of membership: signed, httpOnly, and sent only to this restaurant's menu.
      res.cookie(TABLE_SESSION_COOKIE, signSessionCookie(sessionId), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: `/m/${slug}`,
        maxAge: sessionIdleMs(),
      });
      return result;
    });
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
      () => this.guest.orderStatus(slug, token, req.ip ?? 'unknown', sessionCookie(req)),
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
      this.guest.callWaiter(slug, { ...body }, req.ip ?? 'unknown', sessionCookie(req)),
    );
  }

  @Post('tables/occupy')
  @HttpCode(200)
  async occupy(
    @Param('slug') slug: string,
    @Body() body: CallWaiterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.respond(
      req,
      res,
      () => this.guest.occupy(slug, { ...body }, req.ip ?? 'unknown'),
      200,
    );
  }

  @Get('tables/session-ticket')
  async ticket(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.respond(
      req,
      res,
      () => this.guest.socketTicket(slug, req.ip ?? 'unknown', sessionCookie(req)),
      200,
    );
  }

  @Get('tables/:token/bill')
  async bill(
    @Param('slug') slug: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.respond(
      req,
      res,
      () => this.guest.bill(slug, token, req.ip ?? 'unknown', sessionCookie(req)),
      200,
    );
  }

  @Post('tables/bill-request')
  @HttpCode(200)
  async requestBill(
    @Param('slug') slug: string,
    @Body() body: CallWaiterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.respond(
      req,
      res,
      () => this.guest.requestBill(slug, { ...body }, req.ip ?? 'unknown', sessionCookie(req)),
      200,
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
