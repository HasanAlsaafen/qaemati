# UX principles rulebook

Each rule is paired with a concrete decision for Qaemati — not a restatement of the theory.
Used during the Phase 7 audit (`audit.md`) and binding for every feature in Phases 8–11.

## Nielsen's 10 usability heuristics

1. **Visibility of system status** → every htmx mutation (save, delete, toggle, move) fires a
   toast within the same interaction; the admin never wonders if a click "took."
2. **Match between system and the real world** → Arabic UI copy is written natively (see
   `glossary.md`), not translated word-for-word from English; prices always read in the order a
   human says them (`12.00 ILS`, isolated from RTL reordering per `docs/design-system.md`).
3. **User control and freedom** → every destructive action (delete category/item/table) goes
   through the shared confirm dialog with an explicit Cancel; nothing destructive fires on a
   single tap.
4. **Consistency and standards** → one shared edit-toggle pattern (display ↔ inline form) across
   categories, items, and tables; one toast mechanism; one confirm dialog — audited explicitly
   in Phase 7 as new features (branding, analytics, bulk tools) are added, so they inherit this
   rather than invent new patterns.
5. **Error prevention** → HTML5 `required`/`min`/`type` constraints block malformed submission
   client-side before the server is even asked; price inputs can't go negative.
6. **Recognition rather than recall** → the admin nav always shows where you are (active-state
   styling) and what a field is for (persistent `<label>`, not placeholder-only text that
   disappears on focus).
7. **Flexibility and efficiency of use** → up/down move buttons work without JS libraries for
   every user; a future drag-and-drop (not currently planned) would be an addition, not a
   replacement, so keyboard/screen-reader users are never worse off.
8. **Aesthetic and minimalist design** → the AI-tells audit (`ai-tells.md`) exists specifically
   to enforce this against generic-SaaS visual noise.
9. **Help users recognize, diagnose, and recover from errors** → `HttpExceptionFilter` surfaces
   a toast on htmx failures rather than silently discarding the response; form validation
   messages are bilingual and specific ("price must be 0 or more"), not a generic "error."
10. **Help and documentation** → deliberately minimal for this product: a 3–5 step guided tour
    (A5) covers first-run admin onboarding; no help-center sprawl, since the whole premise of the
    product is that an owner can use it without training.

## Laws of UX

- **Hick's Law** (more choices = longer decision time) → admin nav stays a flat list of named
  sections (Categories, QR & print, Branding, Analytics — not a nested multi-level menu); the
  item edit form shows only the fields relevant to that item (no empty variant/add-on rows by
  default once A2 ships).
- **Fitts's Law** (bigger/closer targets are faster to hit) → `min-h-11` (44px) touch targets
  already enforced everywhere; the primary action per row (edit, the future `+` selection button)
  sits closest to where a thumb naturally rests when scrolling one-handed.
- **Jakob's Law** (users expect your product to work like the ones they already know) → category
  chips, bottom-sheet item details, and a cart-like "selection" affordance (A1) all deliberately
  echo the food-delivery-app mental model from `references.md`, rather than inventing a novel
  interaction for something this familiar.
- **Miller's Law** (~7±2 items in working memory) → category chip bar scrolls horizontally
  instead of trying to fit every category as equally-weighted text at once; tag filters (B1) will
  use a bottom sheet rather than inline checkboxes crowding the search bar.
- **Doherty Threshold** (keep response under ~400ms or perceived flow breaks) → htmx partial
  swaps already avoid full-page reloads for every admin mutation; new features must do the same
  (e.g., the A1 selection list updates from `localStorage` instantly, no network round-trip).

## Mobile ergonomics

- **Thumb zone:** primary actions (selection `+`, edit, save) stay in the lower two-thirds of the
  viewport where they appear in-flow; nothing primary is placed at the very top of a tall page
  that requires a reach.
- **Touch targets:** 44×44px minimum (already the house standard), with visible spacing between
  adjacent targets so a mis-tap doesn't trigger the wrong row's action — audited explicitly for
  the new per-row controls Phases 9–10 add (variant selectors, dietary filter chips).
- **One-handed use:** the public menu's only persistent chrome is the sticky search/category bar
  near the top (reachable on scroll, not on every tap) and a bottom-anchored selection summary
  once A1 ships — both within comfortable one-handed reach on a typical phone.

## WCAG 2.2 AA

Source: [WebAIM WCAG 2.2 overview](https://webaim.org/blog/wcag-2-2-overview-and-feedback/),
[WCAG 2.2 new success criteria](https://testparty.ai/blog/wcag-22-new-success-criteria).

- **2.5.8 Target Size (Minimum, AA):** interactive targets at least 24×24 CSS px, with adequate
  spacing — already met by the 44px house standard, audited per-screen in Phase 7.
- **2.4.13 Focus Appearance** is AAA, not AA, but followed anyway where cheap: focus rings use
  `focus-visible:outline` at 2px with sufficient contrast against both light backgrounds already.
- **Contrast:** body text ≥4.5:1, large/bold text ≥3:1 — already enforced by
  `scripts/check-contrast.ts` (Phase 1) against the token palette; re-run in Phase 7 against any
  new colors (branding picker, analytics charts).
- **Keyboard operability:** every htmx/Alpine interaction (edit toggle, confirm dialog, move
  buttons) must be reachable and operable via keyboard alone, not only pointer/touch — explicit
  audit item for Phase 7 since this was verified by browser-click testing in Phases 4–5, not
  keyboard testing.
- **Non-text content (images):** every `<img>` needs meaningful `alt` (or empty `alt=""` for
  decorative images, already the pattern for the restaurant logo) — audited per new image surface
  (branding cover image, analytics icons).

## Core Web Vitals

Source: [Core Web Vitals thresholds](https://www.debugbear.com/docs/core-web-vitals-metrics).

- **LCP** good < 2.5s, **INP** good < 200ms, **CLS** good < 0.1, measured at the 75th percentile.
- Phase 3's Lighthouse baseline (performance 97) is the floor to protect, not just hit once —
  every new feature (branding image upload, analytics charts, PWA service worker) gets a
  Lighthouse re-run before merging, not just at the end of Phase 11.
- CLS specifically: new dynamic content (specials banner, open/closed status, selection summary
  bar) must reserve its layout space up front (explicit height/min-height) rather than popping in
  after client-side JS runs, the same discipline already used for item images in Phase 3.

## Form design

- **Inline validation:** errors appear next to the field that caused them, in the request's
  active language, at the moment of blur/submit — not a single generic banner at the top of the
  form. Currently a known gap (Phase 4/6 notes: HTML5-only, no rich inline server message on
  create forms) — explicit P1/P2 candidate for the Phase 7 audit.
- **Error recovery:** a failed submission must never silently discard what the user typed; htmx
  partial swaps already preserve the rest of the page state, but a validation failure needs to
  re-render the form with the submitted values intact, not reset to blank.
- **Sensible defaults:** new item forms default `currency` to the restaurant's configured
  currency (ties to A4), not a hardcoded `ILS` — current hardcoded default is a Phase 9
  dependency, not a bug, since branding/currency settings don't exist yet.

## Empty, loading, error, and success states

- **Empty:** every list (categories, items, tables) already has a dedicated empty-state component
  with a clear next action — the new lists (variants, dietary filters, analytics with zero scans
  yet) must match this, not just show blank space.
- **Loading:** htmx requests are typically fast enough that a spinner would flash-and-vanish
  (Doherty threshold territory); where a new feature might genuinely take longer (CSV import,
  branding image upload), it needs a visible in-progress state, not a frozen-looking button.
- **Error:** the existing htmx-aware `HttpExceptionFilter` toast pattern is the standard for every
  new mutating endpoint — no new error-handling mechanism gets invented per feature.
- **Success:** the existing toast-on-save pattern is the standard; no feature should introduce a
  second notification mechanism (e.g., a banner) for the same kind of event.

## Microcopy

Arabic UI copy is written natively in clear Modern Standard Arabic with a warm, local tone —
never a literal word-for-word translation of the English string. A shared glossary
(`glossary.md`) keeps terms consistent across the growing surface area (QR/print added its own
terms in Phase 5; Packs A/B will add many more — "selection," "variant," "special," "allergen,"
etc. each need one locked Arabic term, chosen once, reused everywhere).

## Arabic and bidi specifics

- **Numerals:** Western Arabic numerals (0–9) throughout, including in Arabic text — already the
  house rule (`docs/design-system.md`), re-affirmed here since every new numeric field (variant
  price deltas, analytics counts) must follow it.
- **Mixed Arabic/Latin and prices:** any digit-run adjacent to Latin text inside an RTL paragraph
  needs `dir="ltr"` isolation, or the bidi algorithm reorders it — the exact bug fixed in Phase 3,
  and a standing checklist item for every new UI that shows a price or a Latin currency code
  (branding currency selector, analytics dashboards) next to Arabic text.
- **Punctuation:** Arabic comma (،) and question mark (؟) in Arabic copy, not their Latin
  equivalents, matching the existing i18n JSON files.
- **Phone numbers inside RTL text:** always LTR-isolated like prices (relevant to the WhatsApp
  number shown on the public menu and in admin branding settings), since a phone number read
  digit-reversed is actually wrong, not just stylistically off.
- **Mirrored vs. non-mirrored icons:** directional icons (arrows, chevrons indicating "next/back"
  in a horizontal flow) mirror in RTL; icons representing a real-world object or a non-directional
  concept (QR code, trash/delete, image/upload, star) do not — audited explicitly in Phase 7,
  since the existing move-up/move-down icons are correctly *not* mirrored (vertical, not
  directional-in-reading-order) but this hasn't been checked for every icon in the codebase yet.
