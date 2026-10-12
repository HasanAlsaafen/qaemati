import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { LocaleController } from './locale.controller';
import { DemoController } from './demo.controller';
import { SeoController } from '../seo/seo.controller';
import { PosModule } from '../pos/pos.module';
import { SignupModule } from '../signup/signup.module';
import { DemoBoardController } from './demo-board.controller';

@Module({
  imports: [SignupModule, PosModule],
  controllers: [
    HomeController,
    LocaleController,
    DemoController,
    DemoBoardController,
    SeoController,
  ],
})
export class HomeModule {}
