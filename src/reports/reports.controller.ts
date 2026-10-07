import { Controller, Get, Query, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { RequiresFeature } from '../tenancy/requires-feature';
import { csvRows } from './csv-safe';
import { parseRange, todayInHebron } from './report-range';
import { ReportsService } from './reports.service';

interface RangeQuery {
  range?: string;
  from?: string;
  to?: string;
}

/** Owners only (the role middleware keeps staff out), and only on plans with analytics. */
@Controller('admin/reports')
@RequiresFeature('analytics')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @Render('admin/reports')
  async index(@Query() query: RangeQuery, @Req() req: Request) {
    const range = parseRange(query, todayInHebron());
    return {
      section: 'reports',
      report: await this.reports.report(req.session.restaurantId as string, range),
    };
  }

  @Get('export.csv')
  async export(
    @Query() query: RangeQuery,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const range = parseRange(query, todayInHebron());
    const lines = await this.reports.lines(req.session.restaurantId as string, range);
    let lastOrder = '';
    const rows: unknown[][] = [
      [
        'order',
        'date',
        'table',
        'status',
        'dish_ar',
        'dish_en',
        'quantity',
        'unit_price',
        'line_total',
        'order_total',
        'currency',
        'note',
      ],
      ...lines.map((line) => {
        const first = line.orderId !== lastOrder;
        lastOrder = line.orderId;
        return [
          line.number,
          line.at,
          line.table,
          line.status,
          line.dishAr,
          line.dishEn,
          line.quantity,
          line.unit.toFixed(2),
          line.line.toFixed(2),
          first ? line.total.toFixed(2) : '',
          line.currency,
          first ? (line.note ?? '') : '',
        ];
      }),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orders-${range.from}-to-${range.to}.csv"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(csvRows(rows));
  }
}
