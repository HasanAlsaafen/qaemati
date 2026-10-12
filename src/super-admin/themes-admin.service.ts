import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { checkThemeValues, ThemeValues } from '../admin/themes';
import { Actor, AuditService } from './audit.service';
import { CreateThemeDto, ThemeDto } from './dto/super.dto';
import { FieldError } from './field-error';

function toData(dto: ThemeDto) {
  const values: ThemeValues = {
    primaryColor: dto.primaryColor.trim().toUpperCase(),
    secondaryColor: dto.secondaryColor.trim().toUpperCase(),
    backgroundColor: dto.backgroundColor.trim().toUpperCase(),
    fontTheme: dto.fontTheme,
    cornerStyle: dto.cornerStyle,
    cardStyle: dto.cardStyle,
    buttonShape: dto.buttonShape,
    categoryDivider: dto.categoryDivider,
    categoryMarker: dto.categoryMarker,
    headingAlign: dto.headingAlign,
    priceStyle: dto.priceStyle,
    backgroundStyle: dto.backgroundStyle,
    backgroundPattern: dto.backgroundPattern,
    themeDecor: dto.themeDecor,
  };
  const problem = checkThemeValues(values);
  if (problem) throw new FieldError(problem.field, problem.key);
  return {
    ...values,
    nameAr: dto.nameAr.trim(),
    nameEn: dto.nameEn.trim(),
    descriptionAr: dto.descriptionAr?.trim() || null,
    descriptionEn: dto.descriptionEn?.trim() || null,
    sortOrder: dto.sortOrder ? Number(dto.sortOrder) : 0,
  };
}

/** The platform owner's side of the ready-made themes. */
@Injectable()
export class ThemesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.brandTheme.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async get(id: string) {
    const theme = await this.prisma.brandTheme.findUnique({ where: { id } });
    if (!theme) throw new NotFoundException('Theme not found');
    return theme;
  }

  async create(actor: Actor, dto: CreateThemeDto) {
    const data = toData(dto);
    if (await this.prisma.brandTheme.findUnique({ where: { key: dto.key } })) {
      throw new FieldError('key', 'themeKeyTaken');
    }
    const theme = await this.prisma.brandTheme.create({ data: { ...data, key: dto.key } });
    await this.audit.log(actor, 'theme.created', null, { themeId: theme.id, key: theme.key });
    return theme;
  }

  /** The key stays the same: it is how the branding page refers to the theme. */
  async update(actor: Actor, id: string, dto: ThemeDto) {
    await this.get(id);
    const theme = await this.prisma.brandTheme.update({ where: { id }, data: toData(dto) });
    await this.audit.log(actor, 'theme.updated', null, { themeId: id, key: theme.key });
    return theme;
  }

  /** An archived theme is hidden from owners and kept. */
  async setActive(actor: Actor, id: string, isActive: boolean) {
    await this.get(id);
    await this.prisma.brandTheme.update({ where: { id }, data: { isActive } });
    await this.audit.log(actor, isActive ? 'theme.restored' : 'theme.archived', null, {
      themeId: id,
    });
  }
}
