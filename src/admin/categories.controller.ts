import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Req,
  Res,
  Render,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { CategoryService } from './category.service';
import { Locale } from '../common/middleware/locale-view.middleware';
import { MenusService } from './menus.service';
import { RestaurantService } from './restaurant.service';
import { buildAdminLabels } from './admin-labels';
import { toCategoryViewList } from './admin-view-model';
import { triggerToast } from './htmx-toast';
import { parseIds } from './parse-ids';
import { categoryImageMulterOptions } from './upload.config';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { MoveDto, ReorderDto } from './dto/common.dto';

@Controller('admin/categories')
export class CategoriesController {
  constructor(
    private readonly categories: CategoryService,
    private readonly menus: MenusService,
    private readonly restaurants: RestaurantService,
    private readonly i18n: I18nService,
  ) {}

  @Post()
  @Render('admin/partials/categories-list')
  async create(
    @Body() body: CreateCategoryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { nameAr, nameEn } = body;
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';

    const menu = await this.menus.resolve(restaurantId, body.menuId);

    if (nameAr?.trim() && nameEn?.trim()) {
      await this.categories.create(restaurantId, {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        menuId: menu.id,
      });
      triggerToast(res, this.i18n.t('common.admin.categories.addedToast', { lang: locale }));
    } else {
      triggerToast(res, this.i18n.t('common.admin.form.required', { lang: locale }), 'danger');
    }

    const categories = await this.categories.listForMenu(restaurantId, menu.id);
    const restaurant = await this.restaurants.findById(restaurantId);
    return {
      categories: toCategoryViewList(categories),
      menuId: menu.id,
      labels: buildAdminLabels(this.i18n, locale, restaurant.currency),
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { nameAr, nameEn, availableFrom, availableTo } = body;
    const menuId = body.menuId?.trim() || undefined;
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';

    // Both-or-neither: a one-sided time (e.g. only availableFrom set,
    // left blank by mistake) is treated the same as "always available"
    // rather than silently producing a window that never closes or
    // never opens.
    const hasWindow = Boolean(availableFrom?.trim()) && Boolean(availableTo?.trim());

    const before = await this.categories.findOneWithItems(id);
    if (menuId) await this.menus.assertOwnership(restaurantId, menuId);
    const movedToAnotherMenu = Boolean(menuId) && menuId !== before.menuId;

    await this.categories.update(restaurantId, id, {
      nameAr: nameAr?.trim() || '',
      nameEn: nameEn?.trim() || '',
      availableFrom: hasWindow ? availableFrom!.trim() : null,
      availableTo: hasWindow ? availableTo!.trim() : null,
      menuId,
    });

    // The block belongs to the menu on screen, so once it moves it has to
    // leave this list: an empty body swaps it out of the page.
    if (movedToAnotherMenu) {
      triggerToast(res, this.i18n.t('common.admin.menus.categoryMovedToast', { lang: locale }));
      res.status(200).send('');
      return;
    }
    triggerToast(res, this.i18n.t('common.admin.categories.savedToast', { lang: locale }));

    const category = await this.categories.findOneWithItems(id);
    const restaurant = await this.restaurants.findById(restaurantId);
    res.render('admin/partials/category', {
      category: toCategoryViewList([category])[0],
      labels: buildAdminLabels(this.i18n, locale, restaurant.currency),
    });
  }

  @Post(':id/image')
  @Render('admin/partials/category')
  @UseInterceptors(FileInterceptor('image', categoryImageMulterOptions))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!file) throw new BadRequestException('No image uploaded');
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    await this.categories.setImage(restaurantId, id, `/uploads/categories/${file.filename}`);
    triggerToast(res, this.i18n.t('common.admin.categories.imageUpdatedToast', { lang: locale }));
    return this.categoryPartial(id, restaurantId, locale);
  }

  @Delete(':id/image')
  @Render('admin/partials/category')
  async removeImage(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    await this.categories.setImage(restaurantId, id, null);
    triggerToast(res, this.i18n.t('common.admin.categories.imageRemovedToast', { lang: locale }));
    return this.categoryPartial(id, restaurantId, locale);
  }

  private async categoryPartial(id: string, restaurantId: string, locale: Locale) {
    const category = await this.categories.findOneWithItems(id);
    const restaurant = await this.restaurants.findById(restaurantId);
    return {
      category: toCategoryViewList([category])[0],
      labels: buildAdminLabels(this.i18n, locale, restaurant.currency),
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    await this.categories.remove(restaurantId, id);
    triggerToast(res, this.i18n.t('common.admin.categories.deletedToast', { lang: locale }));
    res.status(200).send('');
  }

  @Post('reorder')
  @Render('admin/partials/categories-list')
  async reorder(@Body() body: ReorderDto, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    const ids = parseIds(body.ids);
    await this.categories.reorder(restaurantId, ids);
    const menuId = ids.length
      ? (await this.categories.findOneWithItems(ids[0])).menuId
      : (await this.menus.resolve(restaurantId)).id;
    const categories = await this.categories.listForMenu(restaurantId, menuId!);
    const restaurant = await this.restaurants.findById(restaurantId);
    return {
      categories: toCategoryViewList(categories),
      menuId,
      labels: buildAdminLabels(this.i18n, locale, restaurant.currency),
    };
  }

  @Post(':id/move')
  @Render('admin/partials/categories-list')
  async move(@Param('id') id: string, @Body() body: MoveDto, @Req() req: Request) {
    const restaurantId = req.session.restaurantId as string;
    const locale = req.locale ?? 'ar';
    await this.categories.move(restaurantId, id, body.direction);
    const { menuId } = await this.categories.findOneWithItems(id);
    const categories = await this.categories.listForMenu(restaurantId, menuId!);
    const restaurant = await this.restaurants.findById(restaurantId);
    return {
      categories: toCategoryViewList(categories),
      menuId,
      labels: buildAdminLabels(this.i18n, locale, restaurant.currency),
    };
  }
}
