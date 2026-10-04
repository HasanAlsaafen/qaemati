import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hexToRgb, meetsPrimaryColorContrast } from '../common/color';

export interface RestaurantDetailsInput {
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  whatsapp?: string | null;
  instagramHandle?: string | null;
  workingHoursAr?: string | null;
  workingHoursEn?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  currency: string;
  /** Null clears back to the default Zaytoun palette. */
  primaryColor?: string | null;
}

@Injectable()
export class RestaurantService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  async update(restaurantId: string, input: RestaurantDetailsInput) {
    await this.findById(restaurantId);

    const hasWindow = Boolean(input.openTime) && Boolean(input.closeTime);
    if ((input.openTime || input.closeTime) && !hasWindow) {
      throw new BadRequestException('OPEN_CLOSE_BOTH_REQUIRED');
    }

    const primaryColor = this.validatePrimaryColor(input.primaryColor);

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descriptionAr: input.descriptionAr ?? null,
        descriptionEn: input.descriptionEn ?? null,
        whatsapp: input.whatsapp ?? null,
        instagramHandle: input.instagramHandle ?? null,
        workingHoursAr: input.workingHoursAr ?? null,
        workingHoursEn: input.workingHoursEn ?? null,
        openTime: hasWindow ? input.openTime : null,
        closeTime: hasWindow ? input.closeTime : null,
        currency: input.currency,
        primaryColor,
      },
    });
  }

  async setLogo(restaurantId: string, logoPath: string) {
    await this.findById(restaurantId);
    return this.prisma.restaurant.update({ where: { id: restaurantId }, data: { logoPath } });
  }

  async setCoverImage(restaurantId: string, coverImagePath: string) {
    await this.findById(restaurantId);
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { coverImagePath },
    });
  }

  /** Re-validated here even though the admin form's live JS already
   *  blocks submission for a failing color -- the form can be bypassed
   *  (curl, a modified request), and a bad primary color isn't just a
   *  cosmetic nit, it would make every button/badge label unreadable
   *  for every diner on the public menu. */
  private validatePrimaryColor(input: string | null | undefined): string | null {
    if (!input) return null;
    const rgb = hexToRgb(input);
    if (!rgb) throw new BadRequestException('INVALID_COLOR');
    if (!meetsPrimaryColorContrast(rgb)) {
      throw new BadRequestException('COLOR_CONTRAST_TOO_LOW');
    }
    return input.startsWith('#') ? input : `#${input}`;
  }
}
