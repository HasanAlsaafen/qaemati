import { OrderStatus, StaffRole } from '@prisma/client';

export type Role = StaffRole;

/** What a staff member may do. Owners may do all of it. */
export const ROLE_RULES = {
  /** The pages a cashier or a kitchen account may open. Everything else is for owners. */
  staffPaths: ['/admin/pos', '/admin/logout', '/admin/login', '/admin/tour/dismiss'],
  /** Orders move forward through the kitchen first, and the floor finishes them. */
  orderStatuses: {
    OWNER: ['PREPARING', 'READY', 'SERVED', 'CANCELED'],
    CASHIER: ['PREPARING', 'READY', 'SERVED', 'CANCELED'],
    KITCHEN: ['PREPARING', 'READY'],
  } as Record<Role, OrderStatus[]>,
} as const;

export const canSetOrderStatus = (role: Role, to: OrderStatus): boolean =>
  ROLE_RULES.orderStatuses[role].includes(to);

/** The kitchen cooks, it does not take the guest's calls or see what they pay. */
export const canHandleCalls = (role: Role): boolean => role !== 'KITCHEN';
export const canSeeMoney = (role: Role): boolean => role !== 'KITCHEN';
export const canEditSettings = (role: Role): boolean => role === 'OWNER';

export function canOpen(role: Role, path: string): boolean {
  if (role === 'OWNER') return true;
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  // A dot segment (plain or percent encoded) could walk out of an allowed prefix.
  if (/\.\.|%2e|%2f|\\/i.test(clean)) return false;
  return ROLE_RULES.staffPaths.some(
    (allowed) => clean === allowed || clean.startsWith(`${allowed}/`),
  );
}

/** Where an account lands after signing in. */
export const homeFor = (role: Role): string => (role === 'OWNER' ? '/admin' : '/admin/pos');

export const parseRole = (value: unknown): Role | null =>
  value === 'OWNER' || value === 'CASHIER' || value === 'KITCHEN' ? value : null;
