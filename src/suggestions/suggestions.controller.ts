import { Controller, Get, HttpCode, Param, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { SuggestionsService } from './suggestions.service';

/**
 * Public, like the menu itself. Reading suggestions changes nothing. The count
 * of taps is a GET beacon on purpose, the same as the dish view beacon: it needs
 * no token, is limited per device, and is only a number for the owner's report.
 */
@Controller('m/:slug/suggestions')
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Get()
  async list(
    @Param('slug') slug: string,
    @Query('items') items: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    const keys = typeof items === 'string' ? items.split(',').filter(Boolean) : [];
    res.json({ suggestions: await this.suggestions.forSelection(slug, keys, req.ip ?? 'unknown') });
  }

  @Get(':itemId/added')
  @HttpCode(204)
  async added(
    @Param('slug') slug: string,
    @Param('itemId') itemId: string,
    @Query('reason') reason: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    await this.suggestions.recordAdd(
      slug,
      itemId,
      typeof reason === 'string' ? reason : '',
      req.ip ?? 'unknown',
    );
  }
}
