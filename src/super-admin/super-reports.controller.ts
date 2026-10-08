import { Controller, Get, Query, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { csvRows } from '../reports/csv-safe';
import { parseMonths, PlatformReportsService } from './platform-reports.service';

/** The platform's own numbers. Everything under /super is already behind the operator login. */
@Controller('super/reports')
export class SuperReportsController {
  constructor(private readonly reports: PlatformReportsService) {}

  @Get()
  @Render('super/reports')
  async index(@Query('months') months?: string) {
    const count = parseMonths(months);
    return { section: 'reports', months: count, report: await this.reports.report(count) };
  }

  @Get('payments.csv')
  async payments(@Query('months') months: string | undefined, @Res() res: Response): Promise<void> {
    const count = parseMonths(months);
    const payments = await this.reports.paymentsForExport(count);
    const day = (date: Date) => date.toISOString().slice(0, 10);
    const rows: unknown[][] = [
      [
        'receipt',
        'paid_on',
        'restaurant_en',
        'restaurant_ar',
        'address',
        'method',
        'amount',
        'currency',
        'status',
        'period_start',
        'period_end',
        'reference',
      ],
      ...payments.map((p) => [
        `R-${String(p.receiptNo).padStart(6, '0')}`,
        day(p.paidAt),
        p.restaurant.nameEn,
        p.restaurant.nameAr,
        p.restaurant.slug,
        p.method,
        Number(p.amount).toFixed(2),
        p.currency,
        p.status,
        day(p.periodStart),
        day(p.periodEnd),
        p.reference ?? '',
      ]),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payments-last-${count}-months.csv"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(csvRows(rows));
  }
}
