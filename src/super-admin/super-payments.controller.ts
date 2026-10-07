import { Body, Controller, Get, Param, Post, Query, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentDto, VoidPaymentDto } from './dto/super.dto';
import { FieldError } from './field-error';
import { PaymentsService } from './payments.service';
import { actorOf, failField, flashSuccess, safeValues } from './super-http';

@Controller('super/payments')
export class SuperPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Render('super/payments')
  async index(
    @Query('restaurantId') restaurantId?: string,
    @Query('method') method?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const date = (value?: string) =>
      value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
    const filter = { restaurantId, method, status, from: date(from), to: date(to) };
    return {
      payments: await this.payments.list(filter),
      filter: {
        restaurantId: restaurantId ?? '',
        method: method ?? '',
        status: status ?? '',
        from: from ?? '',
        to: to ?? '',
      },
      restaurants: await this.prisma.restaurant.findMany({
        select: { id: true, nameAr: true, nameEn: true },
        orderBy: { nameEn: 'asc' },
      }),
    };
  }

  /** Two steps without script: pick the restaurant, then the form is filled from its plan. */
  @Get('new')
  @Render('super/payment-new')
  async newForm(@Query('restaurantId') restaurantId?: string) {
    const restaurants = await this.prisma.restaurant.findMany({
      where: { subscription: { isNot: null } },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: 'asc' },
    });
    const selected = restaurantId
      ? await this.prisma.subscription.findUnique({
          where: { restaurantId },
          include: { plan: true, restaurant: { select: { id: true, nameAr: true, nameEn: true } } },
        })
      : null;
    return { restaurants, selected, today: new Date().toISOString().slice(0, 10) };
  }

  @Post()
  async record(
    @Body() body: RecordPaymentDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const payment = await this.payments.record(actorOf(req), body);
      flashSuccess(req, this.i18n, 'paymentRecorded');
      res.redirect(303, `/super/payments/${payment.id}/receipt`);
    } catch (error) {
      if (error instanceof FieldError) {
        return failField(
          req,
          res,
          this.i18n,
          `/super/payments/new?restaurantId=${encodeURIComponent(body.restaurantId)}`,
          error,
          safeValues(body),
        );
      }
      throw error;
    }
  }

  @Get(':id/receipt')
  @Render('receipts/receipt')
  async receipt(@Param('id') id: string) {
    return { payment: await this.payments.get(id), layout: 'super' };
  }

  @Post(':id/void')
  async void(
    @Param('id') id: string,
    @Body() body: VoidPaymentDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.payments.void(actorOf(req), id, body);
    flashSuccess(req, this.i18n, 'paymentVoided');
    res.redirect(303, `/super/payments/${id}/receipt`);
  }
}
