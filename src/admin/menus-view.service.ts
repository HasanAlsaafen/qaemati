import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CategoryService } from './category.service';
import { MenusService } from './menus.service';
import { RestaurantService } from './restaurant.service';
import { Locale } from '../common/middleware/locale-view.middleware';
import { buildAdminLabels } from './admin-labels';
import { toCategoryViewList } from './admin-view-model';

/** Builds the data the menus panel needs, shared by the dashboard page and
 *  every handler that answers with a fresh panel. */
@Injectable()
export class MenusViewService {
  constructor(
    private readonly menus: MenusService,
    private readonly categories: CategoryService,
    private readonly restaurants: RestaurantService,
    private readonly i18n: I18nService,
  ) {}

  async build(restaurantId: string, locale: Locale, activeMenuId?: string | null) {
    const menus = await this.menus.listForRestaurant(restaurantId);
    const activeMenu = menus.find((menu) => menu.id === activeMenuId) ?? menus[0];
    const categories = await this.categories.listForMenu(restaurantId, activeMenu.id);
    const restaurant = await this.restaurants.findById(restaurantId);
    return {
      menus,
      activeMenu,
      menuId: activeMenu.id,
      categories: toCategoryViewList(categories),
      labels: buildAdminLabels(this.i18n, locale, restaurant.currency),
    };
  }
}
