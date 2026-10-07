import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { LocaleController } from './locale.controller';
import { DemoController } from './demo.controller';
import { SeoController } from '../seo/seo.controller';
import { SignupModule } from '../signup/signup.module';

@Module({
  imports: [SignupModule],
  controllers: [HomeController, LocaleController, DemoController, SeoController],
})
export class HomeModule {}
