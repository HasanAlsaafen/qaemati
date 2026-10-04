# Phase 7 audit

Screenshots: `docs/ux/screenshots/before/` (36 images — 4 viewports × 2 locales for the public
menu and admin dashboard, plus targeted states: empty search, item detail sheet, 404, login
error, category edit mode, QR page empty/populated, QR print page, delete confirm dialog).
Captured with `scripts/ux-screenshots.js` (Playwright). Accessibility: `scripts/ux-axe-audit.js`
(axe-core, WCAG 2.0/2.2 A+AA tags). Performance/SEO/best-practices: Lighthouse, raw JSON in
`docs/ux/lighthouse/`.

## Automated results

**axe-core** (8 pages: public menu AR/EN, admin login AR/EN, admin dashboard AR/EN, admin QR
AR/EN): **0 violations on every page.** Clean baseline — no serious/critical accessibility
issues found by automated scanning going into Phase 8.

**Lighthouse** (mobile form factor):

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Public menu (AR) | 90 | 100 | 100 | 100 |
| Public menu (EN) | 97 | 100 | 100 | 100 |
| Admin dashboard (AR, authenticated) | 89 | 100 | 100 | 100 |

Accessibility is already at 100 everywhere tested — ahead of the Phase 8 acceptance bar (≥95).
Performance sits in the high 80s/90s; the Arabic/English gap on the public menu (90 vs 97) is a
real, specific finding below, not noise — same page, same data, only the locale differs.
Scores were measured on a shared dev machine under background load (other processes competing
for CPU/memory — see the Phase 7 interruption notes in `docs/progress.md`), so treat the exact
numbers as directional; the accessibility/best-practices/SEO scores (100, deterministic) are
solid regardless.

## AI-tells checklist — findings

Each item from `ai-tells.md`, stated against the actual product.

1. **Purple/indigo gradients** — absent. Palette is the Zaytoun olive/cream system
   (`docs/design-system.md`), verified by grep (`gradient|purple|indigo|violet`) across
   `src/styles/` — zero hits.
2. **Glowing blobs / gradient mesh** — absent, same grep.
3. **Glassmorphism/blur everywhere** — present in exactly one place: the sticky search/category
   bar's `backdrop-blur` over scrolling menu content (`views/pages/menu.njk`). This is the
   *legitimate* use case called out in `ai-tells.md` #3, not the tell — no other blur usage
   found. **No fix needed.**
4. **Box-shadow on every element, uniform elevation** — not present as a default; shadow tokens
   (`--shadow-raised`, `--shadow-overlay`) exist but are used selectively (e.g. the admin confirm
   dialog), not stamped on every card. **No fix needed.**
5. **Multi-color gradient headlines** — absent.
6. **Thin colored accent bar on every card** — absent.
7. **Identical uniform-grid cards, same weight** — **present, P2.** Menu item cards and admin
   category/item rows are visually uniform regardless of importance (e.g., a "Popular"-tagged
   item looks exactly like every other item except for a small badge). Low severity — the tag
   badges already provide *some* differentiation, and a food menu listing genuinely benefits from
   scannable uniformity (confirmed by the Wolt/Talabat/Uber Eats research in `references.md`), so
   this is a justified pattern here, not a blind default. Logged as P2 polish, not fixed in
   Phase 8.
8. **Everything centered, perfect symmetry** — absent; layouts are left/right-aligned to reading
   direction (RTL/LTR), not centered. Verified visually across all 36 screenshots.
9. **3-column feature-grid-with-icons marketing sections** — absent; this is a functional app,
   not a marketing page, and no such section exists anywhere.
10. **Every screen a variation of the same dashboard template** — not present; each admin screen
    (categories list, QR grid, print page) has a layout shaped by its actual task, not a forced
    shared dashboard shell.
11. **Uniform spacing everywhere, no grouping** — not systematically present; spacing scale
    (`gap-*`, `p-*` via Tailwind) is used contextually. Not independently re-verified pixel-by-
    pixel in this pass — logged as a P2 spot-check item for Phase 8 if time allows.
12. **Inconsistent spacing/radii between components that should match** — not found; shared
    macros (`button.njk`, category/item/table row macros) structurally prevent this by
    construction (one macro, one set of classes, reused everywhere).
13. **Over-rounded everything as a blanket default** — not present; a defined radius scale
    (`--radius-sm/md/lg`) is used, not maximal rounding on every element.
14. **Decorative hover animation with no purpose** — not found in a scan of the Tailwind classes
    in use; transitions (`transition-colors duration-fast`) are applied to actually-interactive
    elements (buttons) for state feedback, not decorative lift/scale.
15. **Arrow icons on every button regardless of direction** — not present; icons appear only
    where they add information (chevrons on expand/move controls, trash on delete). Verified
    against the button macro and row-action icons.
16. **Emoji used as icons or bullets** — **absent, verified by regex scan** of `i18n/` and
    `views/` for the emoji Unicode ranges. Zero hits.
17. **Sparkle icons signaling "AI/magic"** — absent.
18. **Mixed icon styles** — all icons are hand-written inline SVG with a consistent stroke width
    (1.6–1.8) and corner treatment; not independently audited icon-by-icon in this pass, logged
    as a P2 spot-check for Phase 8.
19. **Fake/stock-feeling photography** — not applicable; Qaemati uses honest generated
    placeholders (fork-and-spoon glyph on a gradient circle, Phase 2/3), never a photo presented
    as if it were a real item's actual photo.
20. **Vague, aspirational headlines ("Welcome to X," "Elevate your experience")** — **present,
    P1.** `i18n/en/common.json` → `home.title` is literally `"Welcome to Qaemati"`
    (`مرحبا بك في قائمتي` in Arabic), rendered as the `<h1>` on `views/pages/home.njk`. This is
    the exact pattern called out in the brief's seed list. The subtitle
    ("Beautiful digital menus for cafes and restaurants in Palestine") is also generic-SaaS-
    adjacent, though less severe. **Fix in Phase 8:** replace with copy that names what the page
    actually does (it's a restaurant picker for this demo instance) rather than a greeting.
21. **Generic/translated-feeling Arabic microcopy** — not found as a systemic issue; the existing
    admin/menu strings read as natively written (verified by the glossary-building pass in
    `glossary.md`, which found zero awkward word-for-word translations in the existing 60+
    string pairs). The one exception is the `home.title`/`subtitle` pair above — same fix.
22. **Fake stats, fake testimonials, "John Doe," lorem ipsum** — **absent, verified by grep**
    across `i18n/`, `views/`, and `prisma/`. The seed data uses a specific, real-feeling fictional
    restaurant (Bayt Al-Zaytoun) with real-sounding item descriptions, not placeholder text.
23. **Em dash as AI-generated connective tissue** — **absent, verified by grep** across
    `i18n/`, `views/`, `src/`. Zero em dashes found in user-facing copy (this project's own
    CLAUDE.md already bans them as a hard constraint — confirmed as actually enforced, not just
    stated).
24. **Low-contrast gray-on-gray text as a default** — not present; every color pairing is gated
    by `scripts/check-contrast.ts` (Phase 1), which already enforces 4.5:1/3:1 minimums against
    the token palette.
25. **Default system font / Inter as the only typographic personality** — absent; Thmanyah
    (Arabic) paired deliberately with Inter (Latin/numerals), not a single generic typeface.
26. **Pill badges/chips on everything** — present, but as information (tag badges: Spicy,
    Vegetarian, New, Popular — each conveys something real), not decoration on every element.
    Matches the `ai-tells.md` guidance directly (badges earn their place). **No fix needed.**
27. **Perfect symmetry as a layout crutch** — same as #8, absent.

**Summary: 2 of 27 items present as genuine tells** (#7 uniform-card-weight, #20 generic
headline), one of which (#20) is P1 and fixed in Phase 8, the other (#7) is justified by the
product's actual use case and logged as P2. The remaining 25 are either absent or are a
legitimate, non-default use of the pattern. This is a meaningfully better starting position than
a typical AI-assisted build, consistent with every prior phase's human-reviewed, iteratively-
fixed construction (see `docs/progress.md`'s "bugs found and fixed" sections) rather than a
one-shot generation.

## P0 — blocks use

### P0-1: Admin header nav is not responsive at phone width
**Where:** `views/layouts/admin.njk`, visible in `admin-qr-ar-390.png` / every
`admin-dashboard-*-390.png` / `admin-qr-*-390.png` screenshot. At 390px the nav row (logo + 3
text links + "Signed in as X" + Log Out button) overflows and wraps unpredictably — "QR & print"
breaks across two lines, nav items collide with the logged-in-as text.
**Why P0:** the project's own Pack A/Phase 9 brief and the Shopify-mobile-admin/Square-Dashboard
research in `references.md` both treat "owner manages the menu from a phone, between serving
tables" as the primary admin use case, not a secondary one. A nav that visibly breaks at the
exact viewport width owners will actually use blocks comfortable use of the entire admin panel,
not just one screen.
**Fix direction for Phase 8:** collapse to a proper mobile nav pattern (e.g., a hamburger/menu
toggle revealing nav links, with "Signed in as X" and Log Out moved into that panel) below a
breakpoint, rather than letting the flex row wrap.

### P0-2: Admin item/category names truncate illegibly at phone width
**Where:** `views/admin/components/item-row.njk` (and the equivalent category display),
visible in `admin-dashboard-ar-390.png` — English names render as `"Coffee..."`,
`"...onade Juice"`, `"...dwich"` etc., cut off mid-word with no visible full name anywhere on
screen without opening edit mode.
**Why P0:** this directly blocks the core admin task ("change a price," "toggle availability")
at the targeted device width, since the owner can't reliably identify which row is which item
before acting on it.
**Fix direction for Phase 8:** either wrap the bilingual name onto two lines instead of
truncating, or reduce competing horizontal space (icon size, button count shown by default) so
the name gets enough room; truncation (if kept at all) needs a `title` attribute or similar for
the full value, not a bare CSS `text-overflow` cutoff with no recovery.

## P1 — hurts the experience

### P1-1: Arabic public menu LCP is 3.5s vs 1.8s in English (same page, same data)
**Where:** Lighthouse performance 90 (AR) vs 97 (EN) on `/m/bayt-al-zaytoun`; LCP specifically
0.65 score (3.5s) in Arabic vs a passing score in English.
**Hypothesis (not yet confirmed — flagged for Phase 8 investigation):** the Thmanyah Arabic
webfont likely isn't preloaded/prioritized as aggressively as Inter, delaying paint of the
largest Arabic text block. `views/partials/head.njk` already preloads both
`thmanyahsans-Regular.woff2` and `thmanyahsans-Medium.woff2` plus `inter-variable-latin.woff2`,
so the preload itself exists — the gap needs profiling (network waterfall / LCP element
identification), not a guessed fix.
**Why P1, not P0:** the page is still usable and the gap doesn't block any task, but it's a
real, measured, locale-specific regression for the Arabic-first primary audience — exactly the
kind of "secondary locale as an afterthought" failure `references.md` calls out as a competitor
weakness to beat, so letting it stand would undercut Qaemati's actual differentiator.

### P1-2: Generic "Welcome to Qaemati" home page headline
Covered under AI-tells #20 above — included here as a P1 item since it also hurts first
impression/clarity, not purely a stylistic tell. Fix: same, in Phase 8.

### P1-3: Possible bidi scroll artifact on the email field after a failed login
**Where:** `admin-login-error-ar-390.png` — the re-displayed email value appears to show
`"dmin@baytalzaytoun.example.com"` (first character apparently scrolled out of view) inside an
RTL-direction page.
**Status: unverified, needs confirmation before fixing.** The server-side value is not
truncated (`src/auth/auth.controller.ts` passes the full posted `email` back to the template
unmodified) — this is very likely a browser bidi-aware scroll-anchor quirk on an `dir="ltr"`
input nested in an RTL document when its value overflows the visible width, not an actual data
loss bug. **Phase 8 action:** confirm by focusing the field and checking cursor/scroll behavior
interactively (not just a static screenshot) before deciding whether a fix (e.g. forcing
`scrollLeft = 0` on render, or a CSS/dir adjustment) is actually needed.

### P1-4: No rich inline server-side validation messages on create forms
**Where:** category/item/table "add" forms (Phase 4/5) rely on HTML5 `required`/`min`/`type`
constraints only; a request that bypasses client-side validation (or a future feature with more
complex rules, e.g. A2's variant pricing) gets a generic toast, not a field-level message.
**Why P1, not P0:** the happy path is fully protected by HTML5 validation today, so this doesn't
block normal use — but `principles.md`'s form-design section explicitly flags this as a known
gap, and Pack A's A2 (variants/add-ons) and A4 (branding) both introduce more complex forms
where "which field is wrong" matters more than it has so far. **Fix direction for Phase 8:**
wire real field-level error display (the removed-as-dead-code `validation.ts` helpers from the
Phase 6 cleanup were a reasonable shape for this — worth revisiting, not resurrecting as-is).

## P2 — polish (logged, not fixed in Phase 8)

- AI-tells #7: uniform card/row visual weight regardless of importance — justified pattern for a
  menu listing, revisit only if a specific screen needs stronger hierarchy later.
- AI-tells #11 and #18: spacing-grouping and icon-style consistency were not exhaustively
  re-verified pixel-by-pixel or icon-by-icon in this pass; spot-check if time allows in Phase 8,
  otherwise defer.
- Home page subtitle ("Beautiful digital menus for cafes and restaurants in Palestine") is
  milder generic-SaaS-adjacent copy — rewrite alongside the P1-2 headline fix, same commit.
- Lighthouse performance scores (89–97) were measured under shared-machine background load; a
  clean re-run once Phase 8's fixes land would give a more trustworthy before/after comparison
  than this pass's raw numbers.

## Addendum: skills that became available mid-audit

A `/reload-skills` run partway through this phase synced new skills into `.agents/skills/`
(project-local, gitignored — not Qaemati source) that didn't exist during the Step 0 report
above, including three relevant to this phase: `frontend-design`, `web-design-guidelines`
(Vercel's Web Interface Guidelines reviewer), and `ui-ux-pro-max`. Per Step 0's own instruction
to read and follow any relevant skill, all three were read and applied retroactively:

- **`frontend-design`:** names specific AI-generated-design tells beyond the brief's seed list —
  a terracotta `#D97757` accent, all-caps tracked-out labels, middle-dot-joined meta strings,
  tracked eyebrow labels, "→" appended to button text, monospace for data labels. Checked against
  the actual codebase (grep across `views/` and `i18n/`): **zero hits on every pattern.** Adds
  confidence to the existing ai-tells findings above rather than surfacing anything new.
- **`web-design-guidelines`:** fetched Vercel's current Web Interface Guidelines
  (`vercel-labs/web-interface-guidelines`) and spot-checked the codebase against it. Confirmed
  already-solid: `prefers-reduced-motion` handled globally (`src/styles/tokens.css`), no
  `transition-all`/`outline-none` misuse, `Escape`-key dialog dismissal present on both confirm
  dialogs, `aria-live` on the toast host, lazy-loading + explicit `width`/`height` on the menu
  card image. **One new minor finding (P2):** `views/components/item-detail-sheet.njk`'s
  dynamically-populated image has no explicit `width`/`height` HTML attributes (sized via a
  fixed-height Tailwind class instead) — doesn't actually cause layout shift since the CSS
  already reserves the space, but doesn't match the guideline's letter. Logged as P2, not P1,
  since the guideline's actual concern (CLS) doesn't materialize here.
- **`ui-ux-pro-max`:** a large local searchable guideline set (119 rules) plus a third-party
  paid design-generation tool (`design-mobile-apps`, requires a `SLEEK_API_KEY` this environment
  doesn't have — noted as unusable/not needed, since Qaemati already has its own hand-built
  design system from Phase 1 rather than a reason to route design decisions through an external
  service). Ran targeted queries against the highest-priority categories (navigation, forms);
  results reinforced the existing P0 nav finding and didn't surface anything new. Not
  exhaustively queried against all 119 rules given this phase's time budget — the targeted
  findings above (from direct screenshot review, axe, Lighthouse, and the two skills with
  concrete, checkable rule lists) already cover the same priority categories this tool's top
  entries point to (accessibility, touch targets, performance/CLS, navigation).

## What's explicitly NOT a finding

- Accessibility: axe-core 0 violations, Lighthouse accessibility 100 on every page tested —
  already past the Phase 8 acceptance bar before any fixes.
- Contrast: enforced by `scripts/check-contrast.ts` since Phase 1, not re-litigated here.
- RTL/LTR correctness, numerals, and price-isolation bidi handling: spot-checked across all 36
  screenshots (Arabic and English versions of every page), no reordering or mirroring bugs
  observed beyond the P1-3 input-scroll item above, which is a different (browser scroll-anchor)
  mechanism, not the bidi-reordering bug class already fixed in Phase 3.
