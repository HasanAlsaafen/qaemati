import { Controller, Get, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HomeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Render('pages/home')
  async index(@Req() req: Request) {
    const locale = req.locale ?? 'ar';
    const restaurants = await this.prisma.restaurant.findMany({
      select: { slug: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: 'asc' },
    });

    return {
      restaurants: restaurants.map((restaurant) => ({
        slug: restaurant.slug,
        name: locale === 'ar' ? restaurant.nameAr : restaurant.nameEn,
      })),
    };
  }
}
