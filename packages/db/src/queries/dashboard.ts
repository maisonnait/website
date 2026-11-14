/** Figures of the back-office home page. */
import { gte, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { orders } from '../schema';
import { ORDER_STATUSES } from '../types';
import type { Dashboard, DashboardDay, OrderStatus } from '../types';
import { loadLowStock } from './stock';

/** The shop's days are Moroccan days, whatever the time zone of the server or of the database. */
export const SHOP_TIME_ZONE = 'Africa/Casablanca';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHOP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' of an instant, in Morocco. */
export function shopDay(instant: Date): string {
  const parts = dayFormat.formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The `count` calendar days ending with `lastDay`, oldest first. */
function daysEndingWith(lastDay: string, count: number): string[] {
  const [year = 1970, month = 1, day = 1] = lastDay.split('-').map(Number);
  const days: string[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    days.push(new Date(Date.UTC(year, month - 1, day - back)).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * `ordersToday`, `revenueToday` and `last7Days` count the orders placed on each Moroccan day,
 * leaving out cancelled and returned ones. `ordersByStatus` counts all orders ever placed.
 */
export async function dashboard(): Promise<Dashboard> {
  const db = await getDb();
  const now = new Date();
  const days = daysEndingWith(shopDay(now), 7);

  const statusRows = await db
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .groupBy(orders.status);
  const ordersByStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<OrderStatus, number>;
  for (const row of statusRows) {
    if (row.status in ordersByStatus) ordersByStatus[row.status] = Number(row.count);
  }

  // Eight days back always covers the seven Moroccan days; each order is then filed under its own day.
  const since = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const recent = await db
    .select({ createdAt: orders.createdAt, totalMad: orders.totalMad, status: orders.status })
    .from(orders)
    .where(gte(orders.createdAt, since));
  const byDay = new Map<string, DashboardDay>(days.map((day) => [day, { day, orders: 0, revenue: 0 }]));
  for (const order of recent) {
    if (order.status === 'cancelled' || order.status === 'returned') continue;
    const bucket = byDay.get(shopDay(order.createdAt));
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenue += order.totalMad;
  }
  const last7Days = days.map((day) => byDay.get(day) ?? { day, orders: 0, revenue: 0 });
  const today = last7Days[last7Days.length - 1];

  return {
    ordersToday: today?.orders ?? 0,
    revenueToday: today?.revenue ?? 0,
    ordersByStatus,
    lowStock: await loadLowStock(db),
    last7Days,
  };
}
