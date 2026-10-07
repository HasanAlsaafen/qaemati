/**
 * A line in a guest's selection is keyed the way the menu page builds it:
 * "<itemId>", "<itemId>:<variantId>", "<itemId>::<addon>,<addon>" or both.
 * The server never trusts a name or a price from the browser, it only reads
 * which dish, which size and which extras, then prices them itself.
 */
export interface ParsedLine {
  itemId: string;
  variantId: string | null;
  addonIds: string[];
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function parseLineKey(key: string): ParsedLine | null {
  const parts = key.split(':');
  if (parts.length > 3) return null;
  const [itemId, variantId = '', addons = ''] = parts;
  const addonIds = addons ? addons.split(',') : [];
  if (!ID.test(itemId)) return null;
  if (variantId && !ID.test(variantId)) return null;
  if (addonIds.length > 20 || addonIds.some((id) => !ID.test(id))) return null;
  if (new Set(addonIds).size !== addonIds.length) return null;
  return { itemId, variantId: variantId || null, addonIds: [...addonIds].sort() };
}

/** The same key for the same choice, whatever order the extras were tapped in. */
export function lineKey(line: ParsedLine): string {
  const addons = line.addonIds.length ? `:${[...line.addonIds].sort().join(',')}` : '';
  const variant = line.variantId ? `:${line.variantId}` : addons ? ':' : '';
  return `${line.itemId}${variant}${addons}`;
}

/** Prices are added as whole cents so 0.1 + 0.2 never drifts. */
export const toCents = (value: unknown): number => Math.round(Number(value) * 100);
export const fromCents = (cents: number): string => (cents / 100).toFixed(2);
