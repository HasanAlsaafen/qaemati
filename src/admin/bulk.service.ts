import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseCsv, stringifyCsv } from './csv';

const CSV_HEADER = ['id', 'category', 'nameAr', 'nameEn', 'price', 'currency', 'available'];

export interface ImportRowResult {
  line: number;
  status: 'created' | 'updated' | 'error';
  message?: string;
}

interface SnapshotEntry {
  itemId: string;
  created: boolean;
  previous: {
    nameAr: string;
    nameEn: string;
    price: number;
    currency: string;
    available: boolean;
  } | null;
}

@Injectable()
export class BulkService {
  constructor(private readonly prisma: PrismaService) {}

  /** B3: copies an item (and its variants/addons) into the same
   *  category, appended to the end -- not undo-logged, since deleting
   *  the copy is itself a one-click undo. */
  async duplicateItem(restaurantId: string, itemId: string): Promise<void> {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, restaurantId },
      include: { variants: true, addons: true },
    });
    if (!item) throw new NotFoundException('Item not found');

    const last = await this.prisma.item.findFirst({
      where: { categoryId: item.categoryId },
      orderBy: { sortOrder: 'desc' },
    });

    await this.prisma.item.create({
      data: {
        restaurantId,
        categoryId: item.categoryId,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        descriptionAr: item.descriptionAr,
        descriptionEn: item.descriptionEn,
        allergenNoteAr: item.allergenNoteAr,
        allergenNoteEn: item.allergenNoteEn,
        price: item.price,
        currency: item.currency,
        tags: item.tags,
        available: item.available,
        sortOrder: last ? last.sortOrder + 1 : 0,
        variants: {
          create: item.variants.map((v) => ({
            restaurantId,
            nameAr: v.nameAr,
            nameEn: v.nameEn,
            price: v.price,
            sortOrder: v.sortOrder,
          })),
        },
        addons: {
          create: item.addons.map((a) => ({
            restaurantId,
            nameAr: a.nameAr,
            nameEn: a.nameEn,
            price: a.price,
            sortOrder: a.sortOrder,
          })),
        },
      },
    });
  }

  /** Applies a percentage change (positive or negative) to the base
   *  price of every selected item AND every variant price on those
   *  items -- an item with variants still has its own `price` field
   *  (see ItemService.update's comment), so leaving variants out would
   *  make "change all my prices by +10%" silently incomplete for any
   *  item that has them. Rounded to 2 decimal places (currency). */
  async changePrices(restaurantId: string, itemIds: string[], percent: number): Promise<number> {
    const items = await this.prisma.item.findMany({
      where: { id: { in: itemIds }, restaurantId },
      include: { variants: true },
    });
    if (items.length === 0) return 0;

    const factor = 1 + percent / 100;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const snapshot: SnapshotEntry[] = items.map((item) => ({
      itemId: item.id,
      created: false,
      previous: {
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        price: Number(item.price),
        currency: item.currency,
        available: item.available,
      },
    }));

    await this.prisma.$transaction([
      ...items.map((item) =>
        this.prisma.item.update({
          where: { id: item.id },
          data: { price: round2(Math.max(0, Number(item.price) * factor)) },
        }),
      ),
      ...items.flatMap((item) =>
        item.variants.map((variant) =>
          this.prisma.itemVariant.update({
            where: { id: variant.id },
            data: { price: round2(Math.max(0, Number(variant.price) * factor)) },
          }),
        ),
      ),
      this.prisma.bulkOperationLog.create({
        data: {
          restaurantId,
          type: 'PRICE_CHANGE',
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    return items.length;
  }

  async exportCsv(restaurantId: string): Promise<string> {
    const items = await this.prisma.item.findMany({
      where: { restaurantId },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
    const rows = [
      CSV_HEADER,
      ...items.map((item) => [
        item.id,
        item.category.nameEn,
        item.nameAr,
        item.nameEn,
        String(item.price),
        item.currency,
        String(item.available),
      ]),
    ];
    return stringifyCsv(rows);
  }

  /** Create-or-update by `id` column (blank id = create). `category`
   *  must match an existing category's English name exactly
   *  (case-insensitive) -- rows that don't match are reported as errors
   *  rather than silently creating a new category, since a typo'd
   *  category name would otherwise fork the menu structure invisibly. */
  async importCsv(restaurantId: string, text: string): Promise<ImportRowResult[]> {
    const rows = parseCsv(text);
    if (rows.length === 0) return [];

    const [header, ...dataRows] = rows;
    const col = (name: string) => header.indexOf(name);
    const idCol = col('id');
    const categoryCol = col('category');
    const nameArCol = col('nameAr');
    const nameEnCol = col('nameEn');
    const priceCol = col('price');
    const currencyCol = col('currency');
    const availableCol = col('available');

    if (nameArCol === -1 || nameEnCol === -1 || priceCol === -1 || categoryCol === -1) {
      return [{ line: 1, status: 'error', message: 'Missing required column(s)' }];
    }

    const categories = await this.prisma.category.findMany({ where: { restaurantId } });
    const categoryByName = new Map(categories.map((c) => [c.nameEn.trim().toLowerCase(), c]));

    const results: ImportRowResult[] = [];
    const snapshot: SnapshotEntry[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const line = i + 2;
      const id = idCol !== -1 ? row[idCol]?.trim() : '';
      const categoryName = row[categoryCol]?.trim() ?? '';
      const nameAr = row[nameArCol]?.trim() ?? '';
      const nameEn = row[nameEnCol]?.trim() ?? '';
      const priceValue = Number(row[priceCol]);
      const currency = (currencyCol !== -1 ? row[currencyCol]?.trim() : '') || 'ILS';
      const availableRaw = availableCol !== -1 ? row[availableCol]?.trim().toLowerCase() : 'true';
      const available = availableRaw !== 'false';

      const category = categoryByName.get(categoryName.trim().toLowerCase());
      if (!category) {
        results.push({ line, status: 'error', message: `Unknown category "${categoryName}"` });
        continue;
      }
      if (!nameAr || !nameEn) {
        results.push({ line, status: 'error', message: 'Missing nameAr/nameEn' });
        continue;
      }
      if (!Number.isFinite(priceValue) || priceValue < 0) {
        results.push({ line, status: 'error', message: 'Invalid price' });
        continue;
      }

      if (id) {
        const existing = await this.prisma.item.findFirst({ where: { id, restaurantId } });
        if (!existing) {
          results.push({ line, status: 'error', message: `Unknown item id "${id}"` });
          continue;
        }
        snapshot.push({
          itemId: existing.id,
          created: false,
          previous: {
            nameAr: existing.nameAr,
            nameEn: existing.nameEn,
            price: Number(existing.price),
            currency: existing.currency,
            available: existing.available,
          },
        });
        await this.prisma.item.update({
          where: { id: existing.id },
          data: { categoryId: category.id, nameAr, nameEn, price: priceValue, currency, available },
        });
        results.push({ line, status: 'updated' });
      } else {
        const last = await this.prisma.item.findFirst({
          where: { categoryId: category.id },
          orderBy: { sortOrder: 'desc' },
        });
        const created = await this.prisma.item.create({
          data: {
            restaurantId,
            categoryId: category.id,
            nameAr,
            nameEn,
            price: priceValue,
            currency,
            available,
            tags: [],
            sortOrder: last ? last.sortOrder + 1 : 0,
          },
        });
        snapshot.push({ itemId: created.id, created: true, previous: null });
        results.push({ line, status: 'created' });
      }
    }

    if (snapshot.length > 0) {
      await this.prisma.bulkOperationLog.create({
        data: {
          restaurantId,
          type: 'IMPORT',
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return results;
  }

  // Kept deliberately simple (a flat list, no category grouping/drag
  // handles) -- this page is a utility tool, not the main menu editor
  // (that's the dashboard); re-using its richer item-row UI here isn't
  // worth the coupling for a page whose job is bulk selection.
  async listItems(restaurantId: string) {
    return this.prisma.item.findMany({
      where: { restaurantId },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  async getLatestUndoable(restaurantId: string) {
    return this.prisma.bulkOperationLog.findFirst({
      where: { restaurantId, undoneAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Single-level undo -- reverts exactly the most recent un-undone
   *  log, then marks it undone so it can't be replayed. Returns false
   *  if `logId` isn't that log (stale page, e.g. a second tab), so the
   *  caller can show a "nothing to undo" message instead of silently
   *  no-op'ing. */
  async undo(restaurantId: string, logId: string): Promise<boolean> {
    const log = await this.getLatestUndoable(restaurantId);
    if (!log || log.id !== logId) return false;

    const snapshot = log.snapshot as unknown as SnapshotEntry[];
    for (const entry of snapshot) {
      if (entry.created) {
        await this.prisma.item.deleteMany({ where: { id: entry.itemId, restaurantId } });
      } else if (entry.previous) {
        await this.prisma.item.updateMany({
          where: { id: entry.itemId, restaurantId },
          data: entry.previous,
        });
      }
    }
    await this.prisma.bulkOperationLog.update({
      where: { id: log.id },
      data: { undoneAt: new Date() },
    });
    return true;
  }
}
