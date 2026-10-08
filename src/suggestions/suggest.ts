export type Reason = 'pairing' | 'together' | 'popular';

export interface Candidate {
  id: string;
  categoryId: string;
  /** Carries the POPULAR tag. */
  tagged: boolean;
  /** Units ordered from tables in the last 30 days. */
  sold: number;
  sortOrder: number;
}

export interface Suggestion {
  id: string;
  reason: Reason;
}

export interface SuggestInput {
  /** What the guest has chosen, in the order they chose it. */
  selected: string[];
  /** Dishes that can be offered right now: switched on and inside their serving hours. */
  candidates: Candidate[];
  /** Owner picks per dish, in the owner's order. */
  pairings: Map<string, string[]>;
  /** For each other dish, in how many recent orders it was ordered with the selection. */
  together: Map<string, number>;
  limit?: number;
  /** Fewer orders than this is chance, not a pattern. */
  minSupport?: number;
}

export const MAX_SUGGESTIONS = 3;
export const MIN_SUPPORT = 3;

/**
 * Up to three dishes to offer next to what the guest chose, from the most
 * trustworthy source to the least:
 *   1. what the owner said goes well with those dishes,
 *   2. what real orders show is often ordered with them (only with enough
 *      orders to mean something),
 *   3. popular dishes from categories the guest has not picked from yet, one
 *      per category so the offer is varied.
 * Never a dish already chosen, never one that cannot be ordered now.
 */
export function suggest(input: SuggestInput): Suggestion[] {
  const limit = input.limit ?? MAX_SUGGESTIONS;
  const minSupport = input.minSupport ?? MIN_SUPPORT;
  const byId = new Map(input.candidates.map((c) => [c.id, c]));
  const chosen = new Set(input.selected);
  const out: Suggestion[] = [];
  const take = (id: string, reason: Reason): boolean => {
    if (out.length >= limit || chosen.has(id) || !byId.has(id)) return false;
    chosen.add(id);
    out.push({ id, reason });
    return true;
  };

  // 1. The owner's picks, dish by dish in the order the guest chose them.
  for (const selected of input.selected) {
    for (const id of input.pairings.get(selected) ?? []) take(id, 'pairing');
  }

  // 2. Dishes that real orders keep putting together.
  if (out.length < limit) {
    const ranked = [...input.together.entries()]
      .filter(([id, count]) => count >= minSupport && byId.has(id) && !chosen.has(id))
      .sort(
        (a, b) =>
          b[1] - a[1] || byId.get(b[0])!.sold - byId.get(a[0])!.sold || a[0].localeCompare(b[0]),
      );
    for (const [id] of ranked) take(id, 'together');
  }

  // 3. Popular dishes from somewhere new on the menu.
  if (out.length < limit) {
    const picked = new Set(
      input.selected.map((id) => byId.get(id)?.categoryId).filter((id): id is string => !!id),
    );
    const usedCategories = new Set<string>();
    const pool = input.candidates
      .filter((c) => !chosen.has(c.id))
      .sort(
        (a, b) =>
          Number(picked.has(a.categoryId)) - Number(picked.has(b.categoryId)) ||
          Number(b.tagged) - Number(a.tagged) ||
          b.sold - a.sold ||
          a.sortOrder - b.sortOrder ||
          a.id.localeCompare(b.id),
      );
    // One per category first, so three drinks do not crowd out a dessert.
    for (const c of pool) {
      if (out.length >= limit) break;
      if (usedCategories.has(c.categoryId)) continue;
      if (take(c.id, 'popular')) usedCategories.add(c.categoryId);
    }
    for (const c of pool) take(c.id, 'popular');
  }
  return out;
}
