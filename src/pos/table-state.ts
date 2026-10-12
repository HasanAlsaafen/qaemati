/** A visit with no orders is dropped after this long without the guest's phone touching the table. */
export const IDLE_MS = 30 * 60_000;

export type TableState = 'FREE' | 'OCCUPIED' | 'BILL';

export interface TableTimes {
  occupiedAt: Date | null;
  lastSeenAt: Date | null;
  billRequestedAt: Date | null;
}

/**
 * Whether a table is taken right now. A visit that has orders stays until
 * staff check it out. A visit with none (someone only scanned the code) lapses
 * after IDLE_MS, so a table is never held by a scan that went nowhere. Computed
 * from the stored times, so nothing has to run in the background to free it.
 */
export function tableState(table: TableTimes, activeOrders: number, now: Date): TableState {
  if (!table.occupiedAt) return 'FREE';
  const lastSeen = table.lastSeenAt ?? table.occupiedAt;
  if (activeOrders === 0 && now.getTime() - lastSeen.getTime() >= IDLE_MS) return 'FREE';
  return table.billRequestedAt ? 'BILL' : 'OCCUPIED';
}
