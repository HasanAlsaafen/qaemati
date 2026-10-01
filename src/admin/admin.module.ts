import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { CategoriesController } from './categories.controller';
import { ItemsController } from './items.controller';
import { QrController } from './qr.controller';
import { CategoryService } from './category.service';
import { ItemService } from './item.service';
import { TableService } from './table.service';

@Module({
  controllers: [DashboardController, CategoriesController, ItemsController, QrController],
  providers: [CategoryService, ItemService, TableService],
})
export class AdminModule {}
