/** Feature keys a plan can switch on. Stored as text in Plan.features. */
export const PLAN_FEATURES = ['bulkTools', 'analytics', 'whatsappOrdering'] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

export function isPlanFeature(value: string): value is PlanFeature {
  return (PLAN_FEATURES as readonly string[]).includes(value);
}

/** What a plan can cap, and which Plan column holds the cap. */
export const LIMIT_RESOURCES = {
  menus: 'maxMenus',
  categories: 'maxCategories',
  items: 'maxItems',
  adminUsers: 'maxAdminUsers',
} as const;
export type LimitResource = keyof typeof LIMIT_RESOURCES;
