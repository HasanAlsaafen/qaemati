import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { eachDay, ReportRange } from './report-range';

/** An order's day in the restaurant's own time. createdAt is stored in UTC. */
const LOCAL = Prisma.sql`(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Hebron')`;
const LOCAL_O = Prisma.sql`((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Hebron')`;

export interface Report {
  range: ReportRange;
  currency: string | null;
  /** More than one currency was used in the period. */
  mixedCurrencies: boolean;
  summary: {
    orders: number;
    canceled: number;
    cancelRate: number;
    revenue: number;
    average: number;
    items: number;
  };
  days: { date: string; orders: number; revenue: number }[];
  hours: { hour: number; orders: number }[];
  dishes: { nameAr: string; nameEn: string; quantity: number; revenue: number }[];
  tables: { label: string; orders: number; revenue: number }[];
  calls: { total: number; answered: number; averageSeconds: number | null };
  maxDayOrders: number;
  maxHourOrders: number;
}

interface SummaryRow {
  currency: string;
  orders: number;
  canceled: number;
  revenue: number;
}

/** Numbers about table orders for one restaurant. Every query is scoped to it. */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private inRange(range: ReportRange, local: Prisma.Sql) {
    return Prisma.sql`${local}::date BETWEEN ${range.from}::date AND ${range.to}::date`;
  }

  async report(restaurantId: string, range: ReportRange): Promise<Report> {
    const where = Prisma.sql`"restaurantId" = ${restaurantId} AND ${this.inRange(range, LOCAL)}`;
    const summaryRows = await this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT "currency",
        (COUNT(*) FILTER (WHERE "status" <> 'CANCELED'))::int AS "orders",
        (COUNT(*) FILTER (WHERE "status" = 'CANCELED'))::int AS "canceled",
        COALESCE(SUM("total") FILTER (WHERE "status" <> 'CANCELED'), 0)::float8 AS "revenue"
      FROM "Order" WHERE ${where} GROUP BY "currency" ORDER BY "revenue" DESC
    `);
    // Money is never added across currencies. The busiest one is shown, and a note says there were others.
    const currency = summaryRows[0]?.currency ?? null;
    const main = summaryRows.find((row) => row.currency === currency);
    const orders = summaryRows.reduce((sum, row) => sum + row.orders, 0);
    const canceled = summaryRows.reduce((sum, row) => sum + row.canceled, 0);

    const [dayRows, hourRows, dishRows, tableRows, callRows, itemCount] = await Promise.all([
      this.prisma.$queryRaw<{ day: string; orders: number; revenue: number }[]>(Prisma.sql`
        SELECT to_char(${LOCAL}::date, 'YYYY-MM-DD') AS "day",
          COUNT(*)::int AS "orders",
          COALESCE(SUM("total") FILTER (WHERE "currency" = ${currency ?? ''}), 0)::float8 AS "revenue"
        FROM "Order" WHERE ${where} AND "status" <> 'CANCELED' GROUP BY 1 ORDER BY 1
      `),
      this.prisma.$queryRaw<{ hour: number; orders: number }[]>(Prisma.sql`
        SELECT EXTRACT(HOUR FROM ${LOCAL})::int AS "hour", COUNT(*)::int AS "orders"
        FROM "Order" WHERE ${where} AND "status" <> 'CANCELED' GROUP BY 1 ORDER BY 1
      `),
      this.prisma.$queryRaw<
        { nameAr: string; nameEn: string; quantity: number; revenue: number }[]
      >(Prisma.sql`
        SELECT COALESCE(MAX(i."nameAr"), MAX(oi."nameAr")) AS "nameAr",
          COALESCE(MAX(i."nameEn"), MAX(oi."nameEn")) AS "nameEn",
          SUM(oi."quantity")::int AS "quantity",
          COALESCE(SUM(oi."lineTotal") FILTER (WHERE o."currency" = ${currency ?? ''}), 0)::float8 AS "revenue"
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        LEFT JOIN "Item" i ON i."id" = oi."itemId" AND i."restaurantId" = o."restaurantId"
        WHERE o."restaurantId" = ${restaurantId} AND o."status" <> 'CANCELED' AND ${this.inRange(range, LOCAL_O)}
        GROUP BY COALESCE(oi."itemId", 'name:' || oi."nameEn")
        ORDER BY "quantity" DESC, "revenue" DESC LIMIT 10
      `),
      this.prisma.$queryRaw<{ label: string; orders: number; revenue: number }[]>(Prisma.sql`
        SELECT "tableLabel" AS "label", COUNT(*)::int AS "orders",
          COALESCE(SUM("total") FILTER (WHERE "currency" = ${currency ?? ''}), 0)::float8 AS "revenue"
        FROM "Order" WHERE ${where} AND "status" <> 'CANCELED'
        GROUP BY "tableLabel" ORDER BY "orders" DESC, "revenue" DESC LIMIT 10
      `),
      this.prisma.$queryRaw<
        { total: number; answered: number; seconds: number | null }[]
      >(Prisma.sql`
        SELECT COUNT(*)::int AS "total",
          (COUNT("acknowledgedAt"))::int AS "answered",
          AVG(EXTRACT(EPOCH FROM ("acknowledgedAt" - "createdAt")))::float8 AS "seconds"
        FROM "WaiterCall" WHERE ${where}
      `),
      this.prisma.$queryRaw<{ items: number }[]>(Prisma.sql`
        SELECT COALESCE(SUM(oi."quantity"), 0)::int AS "items"
        FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
        WHERE o."restaurantId" = ${restaurantId} AND o."status" <> 'CANCELED' AND ${this.inRange(range, LOCAL_O)}
      `),
    ]);

    // Days with no orders are zeros, not gaps.
    const byDay = new Map(dayRows.map((row) => [row.day, row]));
    const days = eachDay(range.from, range.to).map((date) => ({
      date,
      orders: byDay.get(date)?.orders ?? 0,
      revenue: byDay.get(date)?.revenue ?? 0,
    }));
    const revenue = main?.revenue ?? 0;
    const mainOrders = main?.orders ?? 0;
    const call = callRows[0];

    return {
      range,
      currency,
      mixedCurrencies: summaryRows.length > 1,
      summary: {
        orders,
        canceled,
        cancelRate: orders + canceled > 0 ? canceled / (orders + canceled) : 0,
        revenue,
        average: mainOrders > 0 ? revenue / mainOrders : 0,
        items: itemCount[0]?.items ?? 0,
      },
      days,
      hours: hourRows,
      dishes: dishRows,
      tables: tableRows,
      calls: {
        total: call?.total ?? 0,
        answered: call?.answered ?? 0,
        averageSeconds:
          call?.seconds === null || call?.seconds === undefined ? null : Math.round(call.seconds),
      },
      maxDayOrders: Math.max(0, ...days.map((d) => d.orders)),
      maxHourOrders: Math.max(0, ...hourRows.map((h) => h.orders)),
    };
  }

  /** One row per ordered dish, newest first, for accounting. Capped so one request cannot be enormous. */
  async lines(restaurantId: string, range: ReportRange) {
    return this.prisma.$queryRaw<
      {
        number: number;
        at: string;
        table: string;
        status: string;
        dishAr: string;
        dishEn: string;
        quantity: number;
        unit: number;
        line: number;
        total: number;
        currency: string;
        note: string | null;
        orderId: string;
      }[]
    >(Prisma.sql`
      SELECT o."number" AS "number", to_char(${LOCAL_O}, 'YYYY-MM-DD HH24:MI') AS "at",
        o."tableLabel" AS "table", o."status"::text AS "status",
        oi."nameAr" AS "dishAr", oi."nameEn" AS "dishEn", oi."quantity" AS "quantity",
        oi."unitPrice"::float8 AS "unit", oi."lineTotal"::float8 AS "line",
        o."total"::float8 AS "total", o."currency" AS "currency", o."note" AS "note", o."id" AS "orderId"
      FROM "Order" o JOIN "OrderItem" oi ON oi."orderId" = o."id"
      WHERE o."restaurantId" = ${restaurantId} AND ${this.inRange(range, LOCAL_O)}
      ORDER BY o."createdAt" ASC, o."number" ASC, oi."id" ASC
      LIMIT 50000
    `);
  }
}
