import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isCategoryAvailableNow, nowInHebronMinutes } from '../common/open-status';
import { RATE_LIMIT_STORE, RateLimitStore } from '../common/rate-limit/rate-limit-store';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { isServable } from '../tenancy/tenant-access';
import { checkLocation, GuestPosition } from './geo';
import { fromCents, lineKey, parseLineKey, toCents } from './order-lines';
import { PosEventBus } from './pos-event-bus';

export type GuestErrorCode =
  | 'unknown_table'
  | 'menu_offline'
  | 'not_available'
  | 'location_required'
  | 'location_inaccurate'
  | 'too_far'
  | 'rate_limited'
  | 'invalid_order'
  | 'item_unavailable'
  | 'unknown_order';

/** A refusal the guest can be told about, with the HTTP status that fits it. */
export class GuestPosError extends Error {
  constructor(
    readonly code: GuestErrorCode,
    readonly status: number,
    readonly detail?: { ar: string; en: string },
  ) {
    super(code);
  }
}

export interface PlaceOrderInput extends GuestPosPosition {
  table: string;
  lines: { key: string; qty: number }[];
  note?: string;
}

export type GuestPosPosition = GuestPosition;

const ORDER_WINDOW_MS = 10 * 60_000;
const CALL_COOLDOWN_MS = 20_000;
const MAX_NOTE = 300;

const cleanNote = (note: string | undefined): string | null => {
  // Control characters out, so a note can never break a line on the POS screen or in a log.
  const text = (note ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, MAX_NOTE);
  return text || null;
};

@Injectable()
export class GuestPosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly bus: PosEventBus,
    @Inject(RATE_LIMIT_STORE) private readonly limits: RateLimitStore,
  ) {}

  /** What the public menu needs to decide how to order, for the table behind a QR code. */
  async tableContext(restaurantId: string, token: string | undefined) {
    if (!token) return null;
    const table = await this.prisma.restaurantTable.findFirst({
      where: { token, restaurantId },
      select: { id: true, label: true },
    });
    if (!table) return null;
    const context = await this.tenancy.getContext(restaurantId);
    const ordering = isServable(context.access) && context.features.has('tableOrdering');
    const restaurant = await this.prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { latitude: true, longitude: true, requireLocationCheck: true },
    });
    return {
      label: table.label,
      /** False when the plan has no table ordering, so the menu falls back to WhatsApp. */
      ordering,
      locationCheck:
        restaurant.requireLocationCheck &&
        restaurant.latitude !== null &&
        restaurant.longitude !== null,
    };
  }

  async placeOrder(slug: string, input: PlaceOrderInput, ip: string) {
    const { restaurant, table } = await this.gate(slug, input.table);
    await this.limit(`order-ip:${ip}`, ORDER_WINDOW_MS, 15);
    await this.limit(`order-table:${table.id}`, ORDER_WINDOW_MS, 8);
    const distance = this.verifyLocation(restaurant, input);

    const priced = await this.priceLines(restaurant.id, input.lines);
    const order = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ number: number }[]>(Prisma.sql`
        UPDATE "Restaurant" SET "nextOrderNumber" = "nextOrderNumber" + 1
        WHERE "id" = ${restaurant.id}
        RETURNING "nextOrderNumber" - 1 AS "number"
      `);
      return tx.order.create({
        data: {
          restaurantId: restaurant.id,
          tableId: table.id,
          tableLabel: table.label,
          number: Number(rows[0].number),
          note: cleanNote(input.note),
          total: fromCents(priced.totalCents),
          currency: priced.currency,
          distanceMeters: distance,
          items: { create: priced.items },
        },
      });
    });
    await this.bus.publish({ type: 'order.new', restaurantId: restaurant.id, id: order.id });
    return {
      id: order.id,
      number: order.number,
      track: order.publicToken,
      total: fromCents(priced.totalCents),
      currency: priced.currency,
    };
  }

  /** The guest's view of their own order: a number and where it is, nothing else. */
  async orderStatus(slug: string, token: string, ip: string) {
    await this.limit(`track-ip:${ip}`, 60_000, 90);
    const order = await this.prisma.order.findFirst({
      where: { publicToken: token, restaurant: { slug } },
      select: { number: true, status: true },
    });
    if (!order) throw new GuestPosError('unknown_order', 404);
    return order;
  }

  async callWaiter(slug: string, input: GuestPosPosition & { table: string }, ip: string) {
    const { restaurant, table } = await this.gate(slug, input.table);
    await this.limit(`call-ip:${ip}`, ORDER_WINDOW_MS, 12);
    const distance = this.verifyLocation(restaurant, input);

    // A second tap while staff have not answered the first is not a second call.
    const open = await this.prisma.waiterCall.findFirst({
      where: { restaurantId: restaurant.id, tableId: table.id, status: { not: 'RESOLVED' } },
    });
    if (open) return { id: open.id, alreadyCalled: true };
    await this.limit(`call-table:${table.id}`, CALL_COOLDOWN_MS, 1);

    const call = await this.prisma.waiterCall.create({
      data: {
        restaurantId: restaurant.id,
        tableId: table.id,
        tableLabel: table.label,
        distanceMeters: distance,
      },
    });
    await this.bus.publish({ type: 'call.new', restaurantId: restaurant.id, id: call.id });
    return { id: call.id, alreadyCalled: false };
  }

  /** The restaurant and table behind a QR code, if ordering from it is allowed at all. */
  private async gate(slug: string, token: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        orderRadiusMeters: true,
        requireLocationCheck: true,
      },
    });
    if (!restaurant) throw new GuestPosError('unknown_table', 404);
    const table = await this.prisma.restaurantTable.findFirst({
      where: { token: token ?? '', restaurantId: restaurant.id },
      select: { id: true, label: true },
    });
    if (!table) throw new GuestPosError('unknown_table', 404);
    const context = await this.tenancy.getContext(restaurant.id);
    if (!isServable(context.access)) throw new GuestPosError('menu_offline', 503);
    if (!context.features.has('tableOrdering')) throw new GuestPosError('not_available', 403);
    return { restaurant, table };
  }

  private verifyLocation(
    restaurant: {
      latitude: Prisma.Decimal | null;
      longitude: Prisma.Decimal | null;
      orderRadiusMeters: number;
      requireLocationCheck: boolean;
    },
    guest: GuestPosPosition,
  ): number | null {
    const verdict = checkLocation(
      {
        center:
          restaurant.latitude !== null && restaurant.longitude !== null
            ? { lat: Number(restaurant.latitude), lng: Number(restaurant.longitude) }
            : null,
        radiusMeters: restaurant.orderRadiusMeters,
        enabled: restaurant.requireLocationCheck,
      },
      guest,
    );
    if (!verdict.ok) throw new GuestPosError(verdict.reason, 403);
    return verdict.distance;
  }

  private async limit(key: string, windowMs: number, max: number): Promise<void> {
    let count = 0;
    try {
      count = await this.limits.hit(key, windowMs);
    } catch {
      return;
    }
    if (count > max) throw new GuestPosError('rate_limited', 429);
  }

  /** Every price and name comes from the database, whatever the browser claimed. */
  private async priceLines(restaurantId: string, lines: { key: string; qty: number }[]) {
    const merged = new Map<
      string,
      { parsed: NonNullable<ReturnType<typeof parseLineKey>>; qty: number }
    >();
    for (const line of lines) {
      const parsed = parseLineKey(line.key);
      if (!parsed || !Number.isInteger(line.qty) || line.qty < 1) {
        throw new GuestPosError('invalid_order', 422);
      }
      const key = lineKey(parsed);
      const existing = merged.get(key);
      merged.set(key, { parsed, qty: Math.min(50, (existing?.qty ?? 0) + line.qty) });
    }

    const items = await this.prisma.item.findMany({
      where: {
        id: { in: [...new Set([...merged.values()].map((l) => l.parsed.itemId))] },
        restaurantId,
      },
      include: { variants: true, addons: true, category: true },
    });
    const byId = new Map(items.map((item) => [item.id, item]));
    const nowMinutes = nowInHebronMinutes();

    const out: Prisma.OrderItemCreateWithoutOrderInput[] = [];
    let totalCents = 0;
    let currency = '';
    for (const { parsed, qty } of merged.values()) {
      const item = byId.get(parsed.itemId);
      if (!item) throw new GuestPosError('invalid_order', 422);
      const serving =
        item.available &&
        isCategoryAvailableNow(item.category.availableFrom, item.category.availableTo, nowMinutes);
      if (!serving)
        throw new GuestPosError('item_unavailable', 409, { ar: item.nameAr, en: item.nameEn });

      const variant = parsed.variantId
        ? item.variants.find((v) => v.id === parsed.variantId)
        : null;
      // A dish with sizes must be ordered with one, and a dish without sizes cannot have one.
      if (
        item.variants.length > 0 !== Boolean(parsed.variantId) ||
        (parsed.variantId && !variant)
      ) {
        throw new GuestPosError('invalid_order', 422);
      }
      const addons = parsed.addonIds.map((id) => item.addons.find((a) => a.id === id));
      if (addons.some((a) => !a)) throw new GuestPosError('invalid_order', 422);
      const chosen = addons as NonNullable<(typeof addons)[number]>[];

      const unitCents =
        toCents(variant ? variant.price : item.price) +
        chosen.reduce((sum, a) => sum + toCents(a.price), 0);
      const compose = (pick: (x: { nameAr: string; nameEn: string }) => string) =>
        pick(item) +
        (variant ? ` (${pick(variant)})` : '') +
        (chosen.length ? ` + ${chosen.map(pick).join(', ')}` : '');
      out.push({
        itemId: item.id,
        nameAr: compose((x) => x.nameAr),
        nameEn: compose((x) => x.nameEn),
        quantity: qty,
        unitPrice: fromCents(unitCents),
        lineTotal: fromCents(unitCents * qty),
      });
      totalCents += unitCents * qty;
      currency ||= item.currency;
    }
    return { items: out, totalCents, currency };
  }
}
