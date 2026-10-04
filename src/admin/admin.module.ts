import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { CategoriesController } from './categories.controller';
import { ItemsController } from './items.controller';
import { QrController } from './qr.controller';
import { BrandingController } from './branding.controller';
import { CategoryService } from './category.service';
import { ItemService } from './item.service';
import { TableService } from './table.service';
import { RestaurantService } from './restaurant.service';

@Module({
  controllers: [
    DashboardController,
    CategoriesController,
    ItemsController,
    QrController,
    BrandingController,
  ],
  providers: [CategoryService, ItemService, TableService, RestaurantService],
})
export class AdminModule {}
