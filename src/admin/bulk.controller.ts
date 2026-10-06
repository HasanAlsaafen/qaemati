import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  Render,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { BulkService, ImportRowResult } from './bulk.service';
import { buildAdminLabels } from './admin-labels';
import { csvImportMulterOptions } from './upload.config';
import { parseIds } from './parse-ids';
import { PriceChangeDto, UndoDto } from './dto/bulk.dto';

@Controller('admin/bulk')
export class BulkController {
  constructor(
    private readonly bulk: BulkService,
    private readonly i18n: I18nService,
  ) {}

  private async pageData(req: Request, extra: Record<string, unknown> = {}) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const [items, latestLog] = await Promise.all([
      this.bulk.listItems(restaurantId),
      this.bulk.getLatestUndoable(restaurantId),
    ]);
    return {
      items,
      undoableLog: latestLog,
      labels: buildAdminLabels(this.i18n, locale),
      ...extra,
    };
  }

  @Get()
  @Render('admin/bulk')
  async index(@Req() req: Request) {
    return this.pageData(req);
  }

  @Post('items/:id/duplicate')
  @Render('admin/bulk')
  async duplicate(@Param('id') id: string, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    await this.bulk.duplicateItem(restaurantId, id);
    return this.pageData(req, { message: { key: 'duplicated', tone: 'success' } });
  }

  @Post('price-change')
  @Render('admin/bulk')
  async priceChange(@Body() body: PriceChangeDto, @Req() req: Request) {
    const { itemIds, percent } = body;
    const restaurantId = req.session.restaurantId as string;
    const percentValue = Number(percent);
    const ids = parseIds(itemIds);

    if (!ids.length || !Number.isFinite(percentValue) || percentValue === 0) {
      return this.pageData(req, { message: { key: 'priceChangeInvalid', tone: 'danger' } });
    }

    const count = await this.bulk.changePrices(restaurantId, ids, percentValue);
    return this.pageData(req, {
      message: { key: 'priceChangeApplied', tone: 'success', args: { count } },
    });
  }

  @Get('export.csv')
  async exportCsv(@Req() req: Request, @Res() res: Response): Promise<void> {
    const restaurantId = req.session.restaurantId as string;
    const csv = await this.bulk.exportCsv(restaurantId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="menu-items.csv"');
    res.send(csv);
  }

  @Post('import')
  @Render('admin/bulk')
  @UseInterceptors(FileInterceptor('file', csvImportMulterOptions))
  async importCsv(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    if (!file) {
      return this.pageData(req, { message: { key: 'importNoFile', tone: 'danger' } });
    }
    const results: ImportRowResult[] = await this.bulk.importCsv(
      restaurantId,
      file.buffer.toString('utf-8'),
    );
    const created = results.filter((r) => r.status === 'created').length;
    const updated = results.filter((r) => r.status === 'updated').length;
    const errors = results.filter((r) => r.status === 'error');
    return this.pageData(req, {
      message: {
        key: 'importDone',
        tone: errors.length ? 'warning' : 'success',
        args: { created, updated, errorCount: errors.length },
      },
      importErrors: errors,
    });
  }

  @Post('undo')
  @Render('admin/bulk')
  async undo(@Body() body: UndoDto, @Req() req: Request) {
    const logId = body.logId ?? '';
    const restaurantId = req.session.restaurantId as string;
    const ok = await this.bulk.undo(restaurantId, logId);
    return this.pageData(req, {
      message: ok
        ? { key: 'undoApplied', tone: 'success' }
        : { key: 'undoUnavailable', tone: 'danger' },
    });
  }
}
