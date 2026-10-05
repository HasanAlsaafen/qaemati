/**
 * Drag-and-drop reorder requests submit the new order as a repeated
 * `ids` field (categories-list and category-block's Sortable wiring
 * sends it via htmx.ajax's `values`, which serializes an array the same
 * way a form with several same-named inputs would). Express's urlencoded
 * parser already collects that into a string[] -- a single id (a
 * one-item list, or a non-array body from a non-browser client) arrives
 * as a bare string instead, same shape items.controller's `tags` field
 * has to handle.
 */
export function parseIds(raw: string | string[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0);
}
