# Progress

## Phase 0: Foundation (done)

Scaffolded the NestJS + Express + Nunjucks + Tailwind + Prisma + nestjs-i18n project.

What was built:

- NestJS app (`src/`) with TypeScript strict mode, ESLint + Prettier.
- Nunjucks wired as the Express view engine directly (Nest has no official adapter); templates
  in `views/layouts`, `views/pages`, `views/components` (empty, used from Phase 1).
- Tailwind CSS pipeline (`src/styles/app.css` -> `public/css/app.css`), run alongside Nest in
  watch mode via `concurrently`.
- nestjs-i18n with Arabic (default) and English, translation files in `i18n/ar` and `i18n/en`
  under the `common` namespace. Locale switch via `/lang/:code`, persisted in a
  `qaemati_locale` cookie.
- Bilingual 404 and 500 error pages via a global exception filter.
- Prisma initialized with the PostgreSQL datasource only (no models yet; those are Phase 2).
- Docker Compose for local PostgreSQL (`qaemati-postgres` service, named volume).
- helmet and cookie-parser wired in `main.ts`.

### Decisions made

- **Locale resolution is duplicated, not shared, with nestjs-i18n's own middleware.** nestjs-i18n
  auto-registers `I18nMiddleware` via each module's `configure()` hook, and Nest does not
  guarantee that `AppModule`'s own middleware runs after it. Rather than fight that ordering,
  `LocaleViewMiddleware` resolves the locale itself (query param `lang`, then the
  `qaemati_locale` cookie, then `Accept-Language`, then fallback to Arabic) and calls
  `I18nService.t()` with an explicit `lang`, so template rendering never depends on
  `req.i18nLang` or middleware order. The `I18nModule.forRoot` resolver list is kept as
  documentation of the same precedence and for future use (e.g. validation messages).
- **Translation keys use a `common.` prefix** (e.g. `t('common.app.name')`) because
  nestjs-i18n's JSON loader namespaces each file by its filename (`common.json` -> `common`).
- **Multer pinned to `^2.4.0`**, not the `1.4.5-lts.1` originally listed, because 1.x has several
  known DoS vulnerabilities with no fix released on that branch. Still the same dependency from
  the approved stack, just a secure version. `@nestjs/platform-express` still bundles its own
  older multer internally as a transitive dependency; that's outside our control and only
  affects Nest's own (unused, for now) `FileInterceptor` helpers.
- **`.njk` files are excluded from Prettier.** Running Prettier's HTML parser against Nunjucks
  templates collapses `{% block %}` / `{% extends %}` tags onto other lines, which is risky to
  do unsupervised. Formatting of templates is manual for now.
- **No multi-tenancy yet**, but every restaurant-owned table will get a `restaurantId` foreign
  key starting in Phase 2, per the hard constraints.

### Known gaps / follow-ups

- `docker compose up -d` was not run end-to-end in this environment because the local user
  account is not in the `docker` group (sandbox permission, not a project issue). The compose
  file was reviewed by inspection; please run `docker compose up -d` yourself once group
  membership is active and confirm PostgreSQL comes up (port mapping was changed to host port
  5435 locally, presumably because 5432 was already taken; `.env`/`.env.example` match this).
- `npm audit` reports vulnerabilities in dev-only build tooling (`@nestjs/cli`'s Angular
  devkit chain, `tar`, `lodash`, `picomatch`, `tmp`, `glob`). These are build-time only, not
  shipped to production, and come from upstream NestJS tooling; no action taken in Phase 0.
- Design system tokens in `tailwind.config.js` and `src/styles/app.css` are provisional
  (enough to render a styled page). The full documented design system, Thmanyang font wiring,
  and component macros are Phase 1 work.

### Verified

- `npm run lint` passes clean.
- `npx nest build` succeeds.
- `npx prisma validate` succeeds.
- Server boots and serves:
  - `/` in Arabic (`dir="rtl"`) by default.
  - `/?lang=en` and cookie-based switch in English (`dir="ltr"`).
  - `/lang/en` sets the cookie and redirects back.
  - An unknown route returns a styled, bilingual 404 page.

## Phase 1: Design system (done)

Wrote `docs/design-system.md`, implemented the Zaytoun palette and remaining tokens as CSS
variables, self-hosted the interim fallback fonts, built all 18 required Nunjucks component
macros, and added a hidden `/styleguide` page that renders every component in both languages and
both directions.

What was built:

- `docs/design-system.md`: full token table, typography/fallback-font rationale, numeral
  decision, spacing/elevation/motion scale, RTL rules, and the component list.
- `src/styles/tokens.css`: Zaytoun palette, radii, shadow, motion, and per-language line-height
  tokens, all as CSS custom properties stored as `R G B` triplets (not hex) so Tailwind's
  opacity modifiers (`bg-text/40`, used by every overlay's scrim) work correctly, and so a
  restaurant can override `--color-primary` etc. later without touching Tailwind config.
- `src/styles/fonts.css`: Thmanyah `@font-face` rules pointing at `public/fonts/thmanyah/`
  (still just a `.gitkeep`, files not provided yet) plus IBM Plex Sans Arabic and Inter,
  self-hosted under `public/fonts/` (SIL OFL, license files included) as the fallback chain.
  Both Arabic faces are scoped to the Arabic unicode range so Latin characters and digits
  always render in Inter regardless of which Arabic face is active.
- `npm run contrast:check` (`scripts/check-contrast.ts`): WCAG AA check over every
  text/background and status-label pairing in the palette.
- 18 Nunjucks macros in `views/components/`: button, icon-button, input, textarea, select,
  toggle, badge, card, menu-item-card, category-chip, bottom-sheet, modal, toast, skeleton,
  empty-state, confirm-dialog, table-row, language-switcher.
- `/styleguide` (hidden, not linked anywhere): renders every component and state; visiting it
  in `ar`/`en` covers both languages and both text directions.
- htmx and Alpine.js added as npm dependencies (per the approved stack) and self-hosted via a
  `scripts/copy-vendor-js.js` build step into `public/js/vendor/`, rather than loaded from a
  CDN, consistent with the font self-hosting approach and the Lighthouse performance goal.

### Bugs found and fixed while building this (worth knowing about)

- **CSP blocked Alpine entirely.** Helmet's default Content-Security-Policy sets
  `script-src 'self'` with no `unsafe-eval`, but Alpine evaluates every `x-data`/`x-show`/etc.
  expression via `new Function(...)`. Every overlay (bottom sheet, modal, confirm dialog, toast)
  was stuck either fully open or fully inert on page load, silently, with no visible error
  except in the browser console. Fixed in `src/main.ts` by explicitly adding `'unsafe-eval'` to
  `script-src` (documented inline as the known, unavoidable Alpine/CSP tradeoff; nothing
  external is ever loaded, so the risk is contained to our own same-origin scripts).
- **`@import` after `@tailwind` is silently dropped.** `src/styles/app.css` originally had
  `@import './tokens.css'` and `@import './fonts.css'` after the three `@tailwind` directives.
  Per the CSS spec, an `@import` that isn't the first rule in a stylesheet (aside from
  `@charset`) is ignored by the browser. The build produced no error, the CSS file loaded fine,
  but every single color/radius/shadow/font-family token was silently missing, so the whole
  site rendered as unstyled browser-default HTML even though `/css/app.css` returned 200.
  Fixed by moving both `@import` lines to the very top of the file. Caught only by actually
  loading the page in a browser and checking `getComputedStyle` for a CSS variable's value, not
  by curl or a build-success check, since both the HTTP status and the build both looked fine.
- **Nunjucks uses lowercase `true`/`false`/`none`, not Python's `True`/`False`/`None`.**
  Several macro calls and default parameter values used the capitalized Python forms. Nunjucks
  treats an unrecognized capitalized identifier as an undefined variable (silently falsy), so
  `toggle(..., True)` rendered as unchecked, and `confirmDialog`'s `destructive=True` default
  rendered the delete button in the primary (non-destructive) color instead of danger red, with
  no error either in the server log or the browser console. Fixed every occurrence across
  `views/`. Worth remembering for any future template code: Nunjucks/Jinja2 syntax, not Python.

Both bugs after the CSP fix, and the boolean-literal bug, were only caught by actually opening
the page in a browser and interacting with it (clicking buttons, inspecting computed styles and
DOM attributes via the console) — `curl` and successful builds showed no problem at all in any
of the three cases.

### Decisions made

- `--color-warning` adjusted from the originally specified `#B7791F` (3.64:1 contrast with white
  text) to `#A56716` (4.61:1), the only palette value that needed changing to pass WCAG AA.
- Added `--color-border-strong` (`#9C927F`, 3.07:1 against white) for interactive boundaries
  (inputs, selects, toggles), since the original `--color-border` (`#E6DCC9`) is intentionally a
  low-contrast decorative divider and fails WCAG 1.4.11's 3:1 non-text contrast requirement.
  `--color-border` stays as-is for decorative use, always paired with spacing/background, never
  the sole cue for an interactive element's boundary.
- Numerals: Western digits (0-9) everywhere, in both languages, documented in
  `docs/design-system.md`. The font stack already renders Latin/digit characters in Inter
  regardless of surrounding Arabic text, so this keeps prices visually consistent across
  languages without a separate numeral-conversion step anywhere in the codebase.
- Thmanyah's declared weights (400/500/700) in `fonts.css` were a placeholder assumption at the
  time; superseded the same day once the real files arrived (see addendum below).

### Known gaps / follow-ups

- `docker compose up -d` still not verified end-to-end in this environment (see Phase 0 note);
  port mapping is now 5435 on the host.

## Phase 1 addendum: real Thmanyah font files (done, same day)

The project owner provided the official Thmanyah font package
(`Thmanyah-Font-Family.zip`, downloaded from font.thmanyah.com) and the real files replaced the
placeholder the same day Phase 1 was built.

What changed:

- `public/fonts/thmanyah/` now has real files: `thmanyahsans-{Regular,Medium,Bold}.woff2` and
  `thmanyahserifdisplay-Bold.woff2` (only the weights an actual `@font-face` rule references
  are kept; the source zip also has Light/Black/Serif Text variants, not committed), plus the
  official `LICENSE.pdf`.
- `src/styles/fonts.css` updated to reference the real filenames and added a second family,
  `'Thmanyah Serif Display'`, for the editorial treatment. `src/styles/app.css`'s
  `--font-display` now actually differs from `--font-sans` (previously identical placeholders).
- Audited every template for the `font-display` Tailwind class and restricted it to exactly the
  two contexts the brief specifies (public menu header, category titles) — a styleguide
  demonstration heading is the only current usage, since Phase 3 hasn't built the real public
  menu header yet. Everything else (modal/dialog/card titles, admin headings) was switched to
  `font-sans`, since `--font-display` now renders visibly differently and using it everywhere
  would have violated "editorial touch... only" from the brief.
- Replaced every `font-semibold` (weight 600) with `font-bold` (700) across all templates. Thmanyah
  only ships 300/400/500/700/900 — no 600 — so `font-semibold` was silently being remapped by the
  browser's font-matching algorithm to the nearest declared weight (700 in this case) anyway;
  using `font-bold` directly makes that explicit instead of implicit. Updated the type scale table
  in `docs/design-system.md` to match (H1/H2 now documented as weight 700, not 600).

## Phase 2: Data model and seed (done)

Prisma schema with `Restaurant`, `AdminUser`, `Category`, `Item`; one migration; a seed script
creating one fictional cafe and one fictional restaurant with realistic bilingual content.

What was built:

- `prisma/schema.prisma`: `Restaurant` (slug, bilingual name/description, logo, WhatsApp,
  Instagram handle, bilingual working hours), `AdminUser`, `Category`, `Item` (bilingual
  name/description, `Decimal(10,2)` price, currency, `ItemTag[]` enum array for
  spicy/vegetarian/new/popular, availability, sort order, image path). `AdminUser`, `Category`,
  and `Item` all carry an explicit `restaurantId` FK (with an index), per the hard constraint
  that every restaurant-owned table gets one even though multi-tenancy isn't implemented yet.
  Migration `20261001095723_init` applied cleanly against the Phase 0 Docker Postgres.
- `prisma/seed.ts` + `prisma/seed/data.ts` + `prisma/seed/placeholder-image.ts`: seeds
  **Bayt Al-Zaytoun** (بيت الزيتون, a cafe, 7 categories, 30 items, ILS) and **Al-Sanabel**
  (السنابل, a restaurant, 6 categories, 21 items, JOD), each with a seeded `AdminUser`
  (bcrypt-hashed password, shared demo password printed at the end of the seed run). Every
  item/category name and description is written in both Arabic and English by hand, not
  machine-translated, and every dish is a generic traditional Levantine dish or drink (hummus,
  knafeh, mansaf, manakeesh, etc.) — common dish names, not any real restaurant's menu or
  branding. A couple of items are seeded `available: false` to exercise that UI state later.
- Item and restaurant-logo images are deterministic gradient SVGs
  (`prisma/seed/placeholder-image.ts`, keyed off a hash of the item/restaurant name so re-seeding
  produces identical output), written to `public/uploads/seed/` (gitignored, regenerated by
  `npm run prisma:seed`), satisfying "no real/copyrighted images."
- `npm run prisma:seed` script added (`prisma db seed`, configured via `package.json`'s
  `prisma.seed` field).

### Bugs found and fixed while building this

- **`prisma/seed.ts` broke the Nest production build.** `tsconfig.build.json` had no exclusion
  for `prisma/`, so once TypeScript files existed there, `nest build`'s compiler widened its
  inferred `rootDir` to cover both `src/` and `prisma/`, which shifted the output layout from
  `dist/main.js` to `dist/src/main.js` — `node dist/main.js` then failed with
  `Cannot find module`. Build succeeded with no warning; only running the built output surfaced
  it. Fixed by adding `"prisma"` to `tsconfig.build.json`'s `exclude` array. Seed scripts still
  run fine standalone via `ts-node`, which doesn't care about project-wide `rootDir` inference.

### Decisions made

- Multilingual content uses plain `nameAr`/`nameEn` (and `descriptionAr`/`descriptionEn`) column
  pairs rather than a JSON blob or a separate translations table, matching the brief's own
  phrasing ("translated name and description fields for Arabic and English") and keeping queries
  and the seed data simple.
- `Item.restaurantId` is a denormalized, explicit FK even though `Item.categoryId` ->
  `Category.restaurantId` could derive it — this keeps restaurant-scoped queries (and the FK
  constraint used by `onDelete: Cascade`) a single-column lookup, and is what "every
  restaurant-owned table" was read to require literally.
- `ItemTag` is a Postgres native enum array (`ItemTag[]`) rather than a join table, since the
  tag set is small and fixed (spicy/vegetarian/new/popular) — a join table would be premature
  structure for four fixed values with no per-tag metadata.
- Seeded admin emails use `@example.com` (an address reserved by RFC 2606 for documentation,
  guaranteed not a real deliverable domain), not real email providers, so none of the fictional
  businesses are ever reachable by accident.

### Verified

- `npm run lint` and `npx tsc --noEmit -p tsconfig.json` (covers `prisma/` too) pass clean.
- `npm run build` produces a working `dist/main.js`; full smoke test (home AR/EN, styleguide,
  404) all still 200/404 as expected.
- `npx prisma db seed` runs twice in a row cleanly (delete-then-recreate), producing identical
  counts both times: 30 items/7 categories for the cafe, 21 items/6 categories for the
  restaurant, 1 admin user each.
- Verified by direct query (not just "no errors"): restaurant/category/item counts, at least one
  `available: false` item exists, `ItemTag` filtering (`tags: { has: 'POPULAR' }`) returns
  results.
- Spot-checked a generated placeholder image in a real browser: renders as an on-palette
  gradient with a letter watermark, served correctly from `/uploads/seed/...`.

**Licensing: a real constraint, not a formality.** Before wiring the files in, the official
`LICENSE.pdf` (bundled in the zip, identical wording to font.thmanyah.com/licenses) was read in
full. It explicitly permits web embedding "only as part of a compiled, packaged, or obfuscated
product," and separately prohibits "mak[ing] the Font Software available in any manner that
allows end users or third parties to extract, download, access, reuse, or redistribute the Font
Software independently as font files, including through web embedding." A plain self-hosted
`@font-face` setup — what this project does, and the only practical way to serve a custom
non-system font to a browser without a paid third-party webfont-obfuscation service — does not
meet that bar: anyone can retrieve the raw `.woff2` from `/fonts/thmanyah/...` or devtools. This
was raised to the project owner directly (not silently worked around, and not silently skipped
either); they reviewed the clause and explicitly chose to proceed anyway for this demo. If this
project moves past a demo into something with real restaurant customers, this should be
revisited — either by asking Thmanyah for an explicit web-use exception (the license itself
names `ask@thmanyah.com` for exactly this kind of case) or by switching to a licensed webfont
delivery service that doesn't expose raw files.

## Phase 3: Public menu (done)

Public menu at `/m/:slug`: restaurant header, sticky search + category bar with scroll-spy,
instant Arabic-aware search, a single shared item detail bottom sheet, unavailable-item state,
and a language switch that preserves scroll position. Lighthouse mobile scores:
**performance 97, accessibility 100, best practices 100, SEO 100** (report saved at
`docs/lighthouse-mobile-report.html`; started at 90/95/96/91 before the fixes below).

What was built:

- `src/prisma/`: `PrismaService`/`PrismaModule` (global), connecting/disconnecting with the Nest
  app lifecycle. Phase 2 only built the schema and a standalone seed script; this is the first
  place the running app itself talks to the database.
- `src/menu/`: `MenuController` (`GET /m/:slug`, 404 via `NotFoundException` if the slug doesn't
  exist) and `MenuService`, which loads a restaurant with its categories/items and maps them to
  a locale-resolved view model (picking `nameAr`/`nameEn` etc. based on the request's locale,
  formatting price as a fixed 2-decimal string, building `wa.me`/`instagram.com` URLs, and
  precomputing a normalized search string per item).
- `src/common/text/normalize-search-text.ts`: strips Arabic diacritics, folds alef/taa marbuta
  variants, lowercases. Computed once per item server-side at render time; `public/js/menu.js`
  re-implements the same normalization on the typed query (documented as needing to stay in
  sync, since they're necessarily two separate implementations — one Node, one browser).
- Templates: `views/layouts/menu.njk` (a second, leaner layout — no generic app header, since
  the restaurant's own header replaces it), `views/pages/menu.njk`, and two new components:
  `restaurant-header.njk` (logo, name, description, hours, WhatsApp/Instagram links) and
  `item-detail-sheet.njk` (one shared bottom sheet for all items, populated client-side by
  Alpine from a `data-item` JSON payload on each card — not one sheet per item, which would mean
  30+ hidden dialogs in the DOM for the cafe menu alone).
- `views/partials/head.njk`: the common `<head>` boilerplate (preloads, stylesheet, vendor
  scripts) factored out so `layouts/base.njk` and `layouts/menu.njk` can't drift apart. `title`
  and the new `meta_description` block stay directly in each layout, not in the partial — see
  "bugs found" below for why.
- `public/js/menu.js`: vanilla JS (not Alpine) for search filtering and category scroll-spy via
  `IntersectionObserver`. Deliberately not Alpine here: this runs over every item card on the
  page, and Alpine's reactivity overhead isn't worth it for a text filter and a scroll listener.
  The item detail sheet (low-frequency interaction) stays Alpine, consistent with the rest of
  the component system.
- `public/js/scroll-restore.js`: saves `scrollY` to `sessionStorage` (keyed by pathname) when a
  link carrying `data-preserve-scroll` is clicked, restores it once on the next load of that
  path. External file, not an inline `<script>` block — see "bugs found" below.
- Home page now lists the seeded restaurants with links to their menus (`HomeController` now
  queries `PrismaService`), since otherwise the public menu has no discoverable entry point.

### Bugs found and fixed while building this (worth knowing about)

Several of these were only catchable by actually loading the page in a browser and clicking
through it, or by running Lighthouse against the live server — not by reading the code, curling
routes, or a successful build.

- **Prices read backwards in Arabic: "ILS 18.00" instead of "18.00 ILS".** The Unicode
  bidirectional algorithm reorders a digit-run and an adjacent Latin-word-run relative to each
  other inside an RTL paragraph, even though neither run's own characters are reversed. Fixed by
  wrapping every price in `dir="ltr"`, which isolates it from the ambient RTL context. See the
  "Numerals" section of `docs/design-system.md`.
- **My own seed data violated the numeral-consistency rule I had just documented.** The Arabic
  working-hours strings in `prisma/seed/data.ts` used Arabic-Indic digits (٧، ١١، ١٢) instead of
  the Western digits the design system mandates everywhere. Caught only by reading the actual
  rendered page, not by writing the seed data itself. Fixed, and re-seeded.
- **Helmet's default `Referrer-Policy: no-referrer` silently broke the language switch.**
  `LocaleController` redirects back to `Referer` after setting the locale cookie; with no
  Referer header at all (Helmet's default), every language switch fell back to `/`, silently
  sending the user to the homepage instead of back to the menu they were reading. Fixed by
  setting `referrerPolicy: { policy: 'same-origin' }` in `main.ts` — still never leaks Referer
  cross-origin (more private than the browser's own default), while fixing our same-origin
  redirect. `LocaleController` also now re-validates the Referer's host against the request's
  own host before using it (defense in depth against it ever being trusted blindly) and strips
  any `lang` query param from the redirect target, since the cookie it just set is the new
  source of truth and `?lang=` is resolved with higher precedence — redirecting back to a URL
  that still carried the old `?lang=` would silently re-apply it and undo the switch.
- **The language switcher was unreachable mid-scroll, making "preserve scroll position" nearly
  pointless.** It originally lived in the restaurant header, which scrolls away with the rest of
  the page (only the search/category bar is sticky) — so reaching it at all required scrolling
  to the top first, which defeats a feature whose entire purpose is not losing your scroll
  position. Found while testing the scroll-restore feature itself: every test kept saving a
  scroll position of ~0 because reaching the switcher always meant scrolling to the top first.
  Moved the switcher into the sticky bar, where it's reachable from anywhere on the page.
- **`{% block %}` tags inside an `{% include %}`-ed template don't participate in the
  `{% extends %}` chain.** Nunjucks/Jinja2 block overriding only works through `extends`; a
  block defined inside a partial brought in via `include` is a separate, independent scope that
  a page template has no way to override. `views/partials/head.njk` only holds content with no
  blocks (preloads, stylesheet, vendor scripts); `title` and `meta_description` are declared
  directly in each layout file instead, where per-page `{% block %}` overrides actually work.
- **An inline `<script>` block in the scroll-restore implementation was silently blocked by
  CSP**, the same class of bug as the Alpine/CSP issue from Phase 1 (`script-src` has no
  `unsafe-inline`). Written straight to an external file (`public/js/scroll-restore.js`) instead
  before it ever shipped, once the Alpine precedent made the risk obvious.
- **Lighthouse (mobile) found a real, un-tested color-contrast failure**: `--color-secondary-text`
  on `--color-secondary-soft` (badges, the Instagram button) measured 4.41:1, below AA's 4.5:1 —
  `scripts/check-contrast.ts` had only ever checked that color against `--color-bg` and
  `--color-surface`, never against the tinted background it's actually paired with most often in
  real components. Fixed by darkening it slightly (`#A8501F` → `#A0481B`) and adding the missing
  pairing (plus the equivalent `primary`/`primary-soft` one) to the script so it can't recur
  silently.
- **Lighthouse also found three cheap, concrete performance/SEO gaps**: no response compression
  (Express sends no `Content-Encoding` by default; the menu page was ~91KB uncompressed, ~9.4KB
  gzipped — added the `compression` middleware), a missing `<link rel="preload">` for the
  Thmanyah Medium weight (used above-the-fold by category chips and buttons, but only Regular
  was preloaded, so the browser discovered and fetched it only after parsing CSS, adding a
  chained request to the critical path), and no `<link rel="icon">` (browsers auto-request
  `/favicon.ico`, which 404'd and showed up as a console error) or `<meta name="description">`.
  All four fixed; mobile performance went from 90 to 97 and SEO from 91 to 100.

### Decisions made

- `MenuService` resolves locale-specific fields and formats everything (price, tag labels,
  WhatsApp/Instagram URLs, search text) server-side, so templates and client JS only ever handle
  already-correct display strings — no locale or formatting logic duplicated in Nunjucks or JS
  beyond what's unavoidable (the search query normalization, which necessarily has to run
  client-side on what the user types).
- One shared `item-detail-sheet` populated via a `data-item="{{ item | dump }}"` JSON payload per
  card, instead of one static bottom-sheet instance per item. Nunjucks' `dump` filter HTML-escapes
  its JSON output by default (not marked `safe`), so it's already attribute-injection-safe; the
  browser decodes the HTML entities back to valid JSON before `JSON.parse` ever sees it.
- Scroll-spy and search use plain vanilla JS (`public/js/menu.js`), not Alpine, specifically
  because they operate over every item on the page (up to 30+ for the cafe) — kept per the
  brief's "minimal JS" and Lighthouse performance goals. The item detail sheet (one shared
  instance, low-frequency interaction) stays Alpine, consistent with every other overlay
  component built in Phase 1.
- Images stay simple `<img loading="lazy">` with explicit `width`/`height` and a
  `bg-muted-surface` placeholder behind them (no separate animated skeleton-loader JS): the
  colored placeholder is already visible before the (small, local, SVG) image paints, satisfies
  "no layout shift," and adding a second loading-state mechanism on top would be unjustified
  complexity for images this cheap to load.

### Verified

- `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, and `npm run contrast:check` all pass.
- Full production build + smoke test: home (AR/EN), both seeded menus, an unknown slug (404),
  `/styleguide`, and a generic unknown route (404) all return the expected status.
- Tested in a real browser, not just curl: search narrows results and hides empty categories
  and their chips correctly with real Arabic input (normalization verified against a word
  containing a taa marbuta); scroll-spy highlights the correct chip while scrolling and
  auto-scrolls the chip strip to keep it visible; the item detail sheet opens with the correct
  dynamic content (name, image, description, tags, price) and closes correctly; the unavailable
  item stays visible with a dimmed/"Currently unavailable" state rather than being hidden;
  language switch round-tripped with scroll position preserved exactly, verified against both
  seeded restaurants (ILS and JOD) in both languages.
- `npx lighthouse` run against the live `/m/bayt-al-zaytoun` page (mobile, simulated
  throttling): performance 97, accessibility 100, best practices 100, SEO 100. Report saved at
  `docs/lighthouse-mobile-report.html`.

### Known gaps / follow-ups

- No automated/scripted responsive-width check (e.g. a real 360px-viewport screenshot) is saved
  anywhere; verification was interactive browser testing during this session, not a persisted
  artifact. Consider adding a Playwright/Puppeteer screenshot script in a later phase if visual
  regression coverage becomes a priority.
- Category and item ordering is whatever `sortOrder` the seed script assigned (category/item
  insertion order); there's no admin reordering yet — that's Phase 4 (htmx-based drag/drop with
  an up/down-button fallback).

## Phase 3 fixes (requested before Phase 4)

- **Instagram icon was wrong.** The hand-typed SVG path in `restaurant-header.njk` didn't
  actually draw the camera body outline, just an incomplete fragment. Replaced both the
  WhatsApp and Instagram icons with the verified official glyphs from Simple Icons rather than
  hand-typing path data again — the same class of mistake as the earlier bidi/CSP bugs: anything
  copied or typed by hand should be checked by actually rendering it, not assumed correct.
- **Dish placeholder images redesigned.** The Phase 2 placeholder was a giant initial letter
  (e.g. "K" for Knafeh) on a gradient circle, which read as a crude avatar rather than a menu
  photo placeholder. `prisma/seed/placeholder-image.ts` now draws a fork-and-spoon glyph (Material
  Symbols' "restaurant" icon, Apache-2.0) for items and a storefront glyph for restaurant logos,
  both centered on the same soft gradient-circle background — closer to what food delivery apps
  use as a generic placeholder, still fully generated (no real photos), and legible at the small
  80x80 size item cards actually render it at. Re-seeded; verified both icons render correctly
  in a browser before committing, given the Instagram lesson above.
- **Category navigation style**: asked the user to choose between the current filled-pill chips,
  underline tabs, and minimal divider tabs (all keeping the same sticky/scroll-spy/horizontal-
  scroll mechanics from the brief, varying only visual treatment). Filled pills were kept as-is.

## Phase 4: Authentication and admin panel (done)

Session-based login (bcrypt + csrf-csrf double-submit cookies + in-memory rate limiting) and an
htmx-powered admin panel: rename/add/delete/reorder categories and items, inline price/name/
description/tag editing, one-tap availability toggle, image upload with validation, and a
confirm dialog before every destructive action. Verified end-to-end in a real browser against
the seeded Bayt Al-Zaytoun data, then the demo database was re-seeded to a clean state.

What was built:

- `src/auth/`: `AuthController` (`GET`/`POST /admin/login`, `POST /admin/logout`), session
  regeneration on login (fixes session fixation), bcrypt comparison against `AdminUser`,
  `LoginRateLimiter` (in-memory, 5 attempts / 15 min — documented as not viable across multiple
  app instances, acceptable for this single-process demo), `AdminAuthMiddleware` (redirects to
  `/admin/login?redirect=...` when unauthenticated), `AdminLocalsMiddleware` (exposes
  `adminName`/`restaurantSlug` to every admin template), `csrf.ts` (csrf-csrf double-submit-
  cookie setup, token tied to `req.session.id`), `csrf-view.middleware.ts` (exposes the current
  token to templates via `res.locals.csrfToken`).
- `src/admin/`: `DashboardController`, `CategoriesController`, `ItemsController`,
  `CategoryService`/`ItemService` (every mutation asserts restaurant ownership first, throwing
  `NotFoundException`/`ForbiddenException` on a tampered id — real defense even without a true
  multi-tenant UI), `admin-labels.ts` (resolves every i18n string server-side into one `labels`
  object — see "bugs found" below for why), `upload.config.ts` (Multer disk storage, 5MB limit,
  jpeg/png/webp whitelist).
- Templates: `views/layouts/admin.njk` (nav, logout form, `hx-headers` carrying the CSRF token
  for every htmx request on the page), `views/admin/login.njk`, and the reusable macro set in
  `views/admin/components/` — `category-block.njk` and `item-row.njk` each render an inline
  display/edit toggle (Alpine `x-show`, no server round-trip to start editing) with the actual
  save going through htmx; `admin-confirm-dialog.njk` + `delete-trigger.njk` are one shared
  dialog instance for every delete button on the page (mirrors the Phase 3 item-detail-sheet
  pattern), driven by `htmx.ajax()` from Alpine's click handler rather than static `hx-*`
  attributes, since the dialog doesn't know which row triggered it until the event fires.
- Reordering is up/down buttons only, not drag-and-drop: the approved stack has no drag library,
  and htmx/Alpine don't provide one. `CategoryService`/`ItemService` swap `sortOrder` with the
  nearest neighbor inside a transaction per click — a deliberate scope reduction from the
  brief's "drag and drop reordering," not an oversight.
- `HttpExceptionFilter` now detects `hx-request` and responds with an `HX-Trigger` toast header
  + empty body instead of a full error-page render, so a failed admin action surfaces a visible
  toast rather than htmx silently discarding the (non-2xx) response.

### Bugs found and fixed while building this

- **Nunjucks macros can't see the calling template's globals.** Verified empirically (a
  standalone `nunjucks` Node script) before writing any admin macro: a macro imported via
  `{% from %}` only sees what's passed as an explicit argument, and `{% set %}` inside an
  `{% include %}` doesn't leak back to the including template either. This is why every macro
  takes an explicit `labels` argument instead of calling `t()` directly — `admin-labels.ts`
  resolves the full translation tree once per request instead.
- **`req.csrfToken()`'s default `validateOnReuse=true` throws on any stale CSRF cookie.** The
  very first `GET /admin` crashed with a 500. Reading csrf-csrf's source showed the two-argument
  form (`req.csrfToken(false, false)`) silently reissues a token instead of throwing — needed
  since a leftover cookie from before a session existed is a completely ordinary case, not an
  attack.
- **The login form itself failed CSRF validation on every submit, even right after the fix
  above.** Root cause: `saveUninitialized: false` meant an anonymous visitor's session was never
  persisted, so express-session handed out a new, unstable `session.id` on every request — and
  csrf-csrf's token hash is tied to `session.id`. The id used to generate the token when the
  login page rendered never matched the id seen when the form posted back. Fixed by setting
  `saveUninitialized: true`, which establishes a stable cookied session from the very first
  request.
- **Still failing after both fixes above, with no useful stack trace.** csrf-csrf's exported
  error object is constructed once at module load time and reused for every validation failure,
  so its stack trace always points at that one `require()` call, not the actual request that
  triggered it — a complete red herring that took real time to rule out. Instrumenting
  `getSessionIdentifier` with a `console.log` showed it was never even being called for the
  failing `POST /admin/login`, which narrowed it to the *other* branch of csrf-csrf's check: the
  token embedded in the cookie vs. `getTokenFromRequest(req)`, which reads `req.body.csrf_token`.
  Nest's own default body-parser middleware is applied later than `main.ts`'s own `app.use()`
  calls (the same ordering issue noted below for `LocaleViewMiddleware`), so `req.body` was
  still `{}` when `doubleCsrfProtection` read it. Fixed by explicitly calling
  `app.use(express.urlencoded(...))` / `app.use(express.json())` early in `main.ts`, before
  session/CSRF middleware — confirmed with a `curl` cookie-jar repro before and after, isolating
  it from any browser-side flakiness.
- **The error page itself crashed ("Unable to call `t`") while debugging the CSRF issue above.**
  `doubleCsrfProtection` is applied via `app.use()` in `main.ts`, before Nest's module-managed
  `LocaleViewMiddleware` (applied via `consumer.apply().forRoutes('*')` in `AppModule`) ever
  runs — so when CSRF validation threw, `res.locals.t` was never set, and the global exception
  filter's own attempt to render the error template crashed too. Fixed by moving
  `LocaleViewMiddleware` to run directly and early in `main.ts` (`app.use(app.get(...))`),
  before session/CSRF setup, instead of leaving it to Nest's (later-running) middleware chain.
  Doing so meant `LocaleViewMiddleware` also had to stay registered as a plain `provider` in
  `AppModule` (not applied via `consumer.apply()`) purely so `main.ts` could `app.get()` an
  instance of it.
- **`validation.ts`'s server-side field-validation helpers were written but never wired into any
  controller** — found during final cleanup, not during feature work. Every create/update form
  already has HTML5 `required` and `min="0"` constraints, and the controllers' own inline
  `.trim()` checks already guard the server-side no-op path, so this was genuine dead code
  rather than a gap; removed rather than wired in, along with the unused bulk `reorder()`
  methods on `CategoryService`/`ItemService` (built anticipating drag-and-drop, never called
  once that was descoped to up/down buttons).

### Verified

- `npx tsc --noEmit`, `npm run lint`, and a full production build all pass.
- Logged in as the seeded Bayt Al-Zaytoun owner in a real browser and exercised every admin
  action: renamed a category, changed an item's price, toggled availability, moved items up/down
  (confirmed the reorder persisted and re-rendered in the new order), uploaded a replacement item
  image, deleted an item through the shared confirm dialog, and confirmed a toast fired for every
  action. Confirmed the public `/m/bayt-al-zaytoun` page reflected every change immediately —
  the core acceptance criterion for this phase.
- Re-seeded the database afterward (`npx prisma db seed`) to leave the demo data clean, and
  removed the test image left in `public/uploads/items/` (gitignored, but still filesystem
  litter).

## Phase 5: QR codes and printing (done)

The original spec text for this phase wasn't available in this session (only the phase title,
"QR/print", survived into the handoff summary from the prior conversation), so scope was
confirmed with the user before building rather than guessed: a QR code linking to the public
menu, a printable table-tent page carrying that QR, a print-friendly version of the public menu
itself, and per-table QR codes.

What was built:

- `prisma/schema.prisma`: new `RestaurantTable` model (`id`, `restaurantId`, `label`,
  `sortOrder`) — purely a label for which printed QR code is which, not a seating/ordering
  concept (this app has neither). Migration `20261001134531_add_restaurant_tables` created by
  hand via `prisma migrate diff --from-url ... --to-schema-datamodel` + `prisma migrate deploy`,
  since `prisma migrate dev` refuses to run in this non-interactive shell — see "bugs found"
  below for why the diff needed hand-editing before applying.
- `src/admin/table.service.ts`: CRUD + up/down `move()`, same ownership-assertion/sortOrder-swap
  shape as `CategoryService`/`ItemService` from Phase 4.
- `src/admin/qr-code.ts`: `buildMenuUrl(req, slug, tableLabel?)` builds the public menu URL from
  the request's own protocol/host (no configured base-URL env var to keep in sync across
  environments) with `?table=<label>` appended for a table-specific code; `generateQrSvg(url)`
  wraps the `qrcode` package (already a dependency, unused until now) to produce inline SVG
  markup rather than a PNG or a saved file — scales crisp at any print size and needs no
  upload-style lifecycle management for a handful of codes per restaurant.
- `src/admin/qr.controller.ts` (`/admin/qr`): a dashboard-style page with the general QR code,
  an htmx-driven table list (add/rename/reorder/delete, mirroring the categories-list pattern
  from Phase 4 exactly — same shared confirm dialog, same local-edit-mode macros), and
  `/admin/qr/print`, a separate printable page.
- `views/layouts/print.njk`: a second minimal layout with no admin nav/logout chrome, for pages
  meant to be printed directly rather than browsed.
- `views/admin/qr-print.njk`: a grid of cards (general QR + one per table), each with the
  restaurant name, the QR code, and a caption; `break-inside-avoid` so a card never splits across
  a page break, and a `window.print()` button that's itself `print:hidden`.
- Public menu (`src/menu/menu.controller.ts`, `views/pages/menu.njk`): an optional `?table=`
  query param renders a small "Table {label}" chip under the restaurant header — informational
  only, not persisted anywhere; scanning a table's QR is what sets it, each visit is independent.
- Print-friendly public menu: `print:hidden` on the sticky search/category bar, the table chip,
  and the (already-closed-by-default) item detail sheet, so printing `/m/:slug` directly (e.g.
  browser Ctrl+P as a paper backup menu) produces a clean, chrome-free page — no new stylesheet
  needed, just Tailwind's built-in `print:` variant, already available with zero config changes.

### Bugs found and fixed while building this

- **`prisma migrate dev` refuses to run at all**: "Prisma Migrate has detected that the
  environment is non-interactive, which is not supported" — this shell has no TTY for the
  migration-name prompt, and `CI=true` didn't change that. Generated the migration SQL instead
  with `prisma migrate diff --from-url <live db> --to-schema-datamodel prisma/schema.prisma
  --script`, then applied it with `prisma migrate deploy` (itself fully non-interactive).
- **That generated diff included `DROP TABLE "session"`.** The live database the diff ran
  against already had the `session` table that `connect-pg-simple` creates at runtime
  (`createTableIfMissing: true` in `main.ts`), but that table isn't part of `schema.prisma` at
  all — Prisma doesn't know it's supposed to exist, so a diff against the live database proposes
  dropping it. Caught by reading the generated SQL before applying it, not after; would have
  logged out every admin session (not destroyed any real data, since express-session just
  recreates the table on next request, but still the wrong migration to ship). Stripped that
  statement before running `migrate deploy`.
- **Stale session after reseeding broke every admin QR/table action with "Foreign key constraint
  violated" / "No Restaurant found".** Re-seeding (standard cleanup after browser-testing Phase
  4, and done again here) generates fresh `cuid()`s for every row, including the restaurant the
  logged-in session's `restaurantId` pointed at. The browser still had Phase 4's session cookie,
  now referencing a restaurant that no longer exists. Not a code bug — logging out and back in
  fixed it immediately — but worth noting because the failure mode (a 500 on every table
  mutation, right after a routine reseed) looked exactly like a real bug at first. Also: trying
  to "clear cookies" via `document.cookie` in the browser console does nothing to the session
  cookie, since it's `httpOnly` by design (see Phase 4's CSRF work) — the actual fix has to go
  through the real `/admin/logout` form, not a script-side cookie wipe.

### Verified

- `npx tsc --noEmit`, `npm run lint`, and a full production build all pass.
- Logged into the seeded Bayt Al-Zaytoun owner account and exercised the full QR/table flow in a
  real browser, in both languages: viewed the general QR code, added two tables ("5" and
  "Patio 2"), confirmed each got its own distinct QR encoding the correct `?table=` URL, reordered
  them, opened `/admin/qr/print` and confirmed both table cards and the general card rendered
  correctly, deleted both tables through the shared confirm dialog (toast fired each time), and
  confirmed the Arabic locale (`?lang=ar`) renders the admin page and the confirm dialog's text
  correctly in RTL. Visited the public menu with `?table=Patio%202` (and again in Arabic with
  `?table=5`) and confirmed the table chip decodes and displays correctly.
- Confirmed via a direct CSS check (not just visual inspection) that `print:hidden` and other
  `print:` utilities actually compiled into `public/css/app.css` under a `@media print` block,
  since a missing Tailwind variant would otherwise fail silently (the class just wouldn't exist,
  with no error anywhere).
- Production smoke test: home, public menu, public menu with `?table=`, and both new admin QR
  routes (redirecting to login when unauthenticated) all returned the expected status codes.
- Left no test data behind: both tables added during testing were deleted before finishing, and
  the general-QR/table-QR feature itself needs no seed data (it's generated from a restaurant's
  existing slug, not stored).

## Phase 6 (interrupted, partially done)

A second instruction arrived (the UX/new-features track below) while Phase 6 "Hardening" was
mid-flight, with a brief that stated Phases 0–6 were already complete. They weren't — only the
start of a dependency audit had landed. Recorded here so the gap is visible rather than silently
implied-done by the phase numbering.

- **Done:** applied `npm overrides` for three transitive CVEs pulled in via
  `@nestjs/platform-express` — `body-parser` 1.20.4→1.20.8, `qs` 6.14.2→6.16.0, and a
  platform-express-scoped override pinning its internal `multer` to 2.4.0 (matching the app's
  own direct dependency, which was already patched). Dropped `npm audit` from 24 to 22
  vulnerabilities; the remaining 22 are entirely in the `@nestjs/cli` dev-tooling chain
  (`@angular-devkit/*`, `webpack`, `tar`, `tmp`, `inquirer`, `glob`) — build-time only, never
  shipped or executed in the running app, left as-is rather than force-upgrading `@nestjs/cli`
  to a major version with no time budget to regression-test the switch.
- **Not done:** no automated test harness (Jest/`@nestjs/testing`/Supertest are installed but
  unconfigured, zero test files exist), no DTO/`class-validator` wiring (also installed, also
  unused — `ValidationPipe` was planned but not started), no systematic error-handling/edge-case
  pass.
- **Resolution:** the Jest+Supertest harness is a hard prerequisite for Phase 9's "tests passing"
  acceptance criterion, so it gets built there instead of being revisited as a standalone phase.
  The DTO/validation gap is tracked as finding P1-4 in `docs/ux/audit.md` instead of being fixed
  here.

## Phase 7: Skills report, research, and audit (done)

Second track begins: raise the UX to a professional level, remove AI-generated-looking design
patterns, and add new features (Packs A/B) over Phases 7–11. Phase 7 is research and audit only
— no product code changed.

**Step 0 (skills/tools):** checked `~/.claude/skills`, `~/.agents/skills`, and the skills listed
at the time, for anything relevant to frontend design, UX, accessibility, browser testing,
performance, or documentation. Initially none existed — the available skills were all
document/productivity-oriented (`docx`, `pdf`, `pptx`, `xlsx`, `google-workspace`, `docs` [the
Claude Docs artifact connector, not repo documentation], `morning`, `humanize`,
`import-memory`, `skill-creator`, `cv-hasan`) or unrelated tooling (`schedule`,
`artifact-capabilities`, `dataviz`, `claude-api`, etc.). **Correction, mid-phase:** a
`/reload-skills` run partway through this phase synced three newly-relevant skills into the
project-local (gitignored) `.agents/skills/` — `frontend-design`, `web-design-guidelines`
(fetches and applies Vercel's Web Interface Guidelines), and `ui-ux-pro-max` (a local searchable
UX-rule set), plus `design-mobile-apps` (a third-party paid design-generation API, unusable here
— no `SLEEK_API_KEY` configured, and not needed given Qaemati's own Phase 1 design system). All
four were read and the three relevant ones applied retroactively — see `audit.md`'s "skills that
became available mid-audit" addendum for what each contributed (confirmation on `frontend-
design`'s specific tell list, one new minor finding from `web-design-guidelines`, reinforcement
of the existing P0 nav finding from `ui-ux-pro-max`). Used own knowledge plus
`WebSearch` (web access confirmed available) for competitor/principles research, Playwright +
`@axe-core/playwright` (installed as new dev dependencies per the brief) for scripted
screenshot capture and accessibility scanning, and `npx lighthouse` (already used in Phase 3).

**Step 1 (research docs, all in `docs/ux/`):**
- `references.md` — Wolt/Talabat/Uber Eats, Toast/Square/Flipdish/Menu Tiger/Popmenu,
  Shopify mobile admin/Square Dashboard, Dishoom/Blue Bottle, grounded in actual `WebSearch`
  results (sourced and linked), not generic knowledge — each pattern paired with a concrete
  Qaemati adaptation and, where relevant, a named competitor weakness (Arabic-as-an-afterthought
  across every researched QR-menu platform is the standout one).
- `principles.md` — Nielsen's heuristics, Laws of UX, mobile ergonomics, WCAG 2.2 AA, Core Web
  Vitals, form design, state design, microcopy, and Arabic/bidi specifics, each rule paired with
  what it actually means for this codebase (e.g. "Fitts's Law → the existing `min-h-11` 44px
  touch-target convention", not just the law restated).
- `ai-tells.md` — 27-item checklist extending the brief's seed list (researched via `WebSearch`),
  each with a "what to do instead."
- `glossary.md` — locks one Arabic term per concept for every string the existing product
  already uses (pulled from the real `i18n/*/common.json` files, not invented) plus every new
  term Packs A/B will need, decided now so Phase 9/10 doesn't improvise terminology mid-build.
  One deliberate choice worth flagging: A1's "selection" list is labeled "طلبي" (my request) —
  considered and rejected "سلتي" (my basket/cart) as reading too much like e-commerce for a
  WhatsApp message that explicitly isn't an order.

**Step 2 audit (no fixes yet, those are Phase 8):**
- `scripts/ux-screenshots.js` (Playwright, one-off tool, not part of the app build): 36
  screenshots in `docs/ux/screenshots/before/` — 4 viewports (360/390/768/1280) × 2 locales for
  the public menu and admin dashboard, plus targeted states (empty search, item detail sheet,
  404, admin login error, category edit mode, QR page empty/populated, QR print page, delete
  confirm dialog).
- `scripts/ux-axe-audit.js`: axe-core against 8 pages (public menu AR/EN, admin login AR/EN,
  admin dashboard AR/EN, admin QR AR/EN) — **0 violations on every page.**
- Lighthouse (mobile) against the public menu (AR/EN) and the authenticated admin dashboard
  (AR): accessibility 100 on all three (already past Phase 8's ≥95 bar before any fixes),
  best-practices/SEO 100, performance 89–97 (raw JSON saved in `docs/ux/lighthouse/`).
- `audit.md`: every one of the 27 AI-tells items checked against the actual product (not
  assumed) — 2 genuine tells found (a uniform-card-weight pattern judged justified for a menu
  listing, logged P2; and the home page's literal "Welcome to Qaemati" headline, P1/AI-tell,
  fixed in Phase 8), the other 25 either absent or a legitimate non-default use. Two P0 findings
  (admin nav doesn't respond to phone width, admin item names truncate illegibly at 390px — both
  directly undercut the "owner manages the menu from a phone" use case the research in
  `references.md` says is central) and four P1 findings (the home headline; a measured
  Arabic-vs-English LCP gap on the public menu, 3.5s vs 1.8s, hypothesis noted but not yet
  diagnosed; a possibly-cosmetic bidi input-scroll artifact on the admin login error state,
  flagged unverified rather than guessed-and-fixed; and the known gap from Phase 6's interruption
  about create-form validation feedback).

### Bugs found and fixed while doing this (tooling, not product code)

- **Disk full (310MB free, then down to 310→1.2G→506M→479M across the session) blocked the
  Playwright Chromium download outright** (`ENOSPC`) on the first attempt. Not a problem with
  this task specifically — `df -h /` showed 100% usage system-wide. Cleared only
  `~/.cache/ms-playwright`'s own failed-download remnants (686MB, unambiguously this task's own
  mess) rather than touching anything else on the machine (Chrome's cache, pip, snap, Downloads)
  without asking — that bought enough headroom (1.2GB) to complete the install. Flagged the
  broader disk-space situation to the user rather than continuing to silently scavenge space.
- **The screenshot script's reused single `page` object crashed Chromium consistently at the
  same spot** (`page.goto: Page crashed`) after roughly 9 navigations in a row, in this
  memory-constrained environment (~700MB free RAM alongside several other Chrome instances and
  stale `nest start --watch` processes left running from earlier phases in other terminals —
  left those alone since they weren't started by this session and might still be in use).
  Fixed by closing and recreating the Playwright `page` (same browser context, so the admin
  login session cookie persists) before every single screenshot instead of reusing one page for
  the whole run.

### Verified

- `npx tsc --noEmit`, `npm run lint`, and a full production build all pass (only `docs/ux/`,
  two new one-off scripts, and `package.json`'s dependency overrides/additions changed — no
  product code touched, per this phase's own acceptance criterion).
- All three research documents and `audit.md` are specific to Qaemati throughout — grounded in
  real screenshots, real axe/Lighthouse output, real grep results against the actual codebase,
  and real `i18n/*.json` content, not generic UX advice with Qaemati's name substituted in.

### Known gaps / follow-ups

- Lighthouse performance numbers were measured under shared-machine background load; worth a
  clean re-run once Phase 8 lands for a trustworthy before/after comparison, per `audit.md`'s P2
  notes.
- The Arabic LCP regression (P1 in `audit.md`) has a hypothesis (font-loading priority) but
  wasn't profiled down to a root cause in this pass — Phase 8 needs to actually diagnose it
  before fixing it, not guess.
- The bidi input-scroll artifact (P1-3 in `audit.md`) is explicitly unverified — needs
  interactive confirmation (focus/cursor behavior, not just a static screenshot) before deciding
  whether it's a real bug or just how the screenshot happened to capture an unfocused field.

## Phase 8: UX fixes and AI-tells cleanup (done)

Fixed every P0 and P1 finding from `docs/ux/audit.md`, plus the one real AI-tell (#20, the
generic home headline). All fix details, verification method, and before/after evidence are
inline in `audit.md` itself (each finding now has a `✅ Fixed` note) rather than duplicated here
— this entry covers what's notable about *how* they were found and fixed.

What was fixed:

- **P0-1 (admin nav not responsive at phone width):** `views/layouts/admin.njk` now shows nav
  links + logout inline from the `sm` breakpoint up; below it, a single hamburger/close toggle
  button (`aria-label`, `aria-expanded`, `aria-controls`) reveals a stacked full-width mobile
  panel. Verified both visually (screenshots) and interactively (Playwright: clicked the toggle,
  confirmed `aria-expanded` flips and the panel's links render).
- **P0-2 (admin item names illegible at phone width) — turned out to be two separate bugs, not
  one.** The audit's working theory was a bidi-direction truncation bug (mixing an LTR English
  run and an RTL Arabic run on one `truncate` line inside an RTL document cuts from the wrong
  side). Fixing *that* alone (splitting into two `dir`-tagged lines) was step one — but
  re-screenshotting to verify caught a second, independent cause: the *English*-locale
  screenshot was just as badly truncated, which the bidi theory doesn't explain at all. The real
  second cause was spatial: the row's action-button column (move ×2, toggle, edit, delete) left
  only ~120px for the name regardless of text direction. Fixed by restructuring
  `item-row.njk` to stack vertically below `sm` (name gets the full row width, actions wrap onto
  their own row beneath) and stay side-by-side above it. Worth noting as a reminder that a
  screenshot-driven audit's first hypothesis for *why* something looks wrong isn't automatically
  the whole story — re-verifying after the "fix" is what caught the second bug.
- **P1-1 (Arabic LCP regression):** root-caused, not guessed. The original audit pass used
  `--only-categories=performance`, which drops Lighthouse's diagnostic/insight audits — re-ran
  with the full audit and found `network-dependency-tree-insight` showing two Bold-weight
  Thmanyah webfonts discovered only *after* `app.css` parses (not preloaded), each adding a full
  round trip neither the already-preloaded Regular/Medium nor English's Inter ever pay. Confirmed
  both Bold files are genuinely used above the fold before preloading them (not a blind
  preload-everything fix). The AR/EN performance gap closed from 7-8 points to ~1 point on a
  clean before/after comparison.
- **P1-2 (generic home headline):** `home.title`/`subtitle`/`description` rewritten in both
  locales to describe what the page does (a picker into the demo's seeded restaurants) instead
  of greeting the visitor.
- **P1-3 (email field appearing to lose its first character) — confirmed as a real bug, not a
  screenshot artifact.** A Playwright check of the focused field's computed style showed
  `direction: rtl` on an input holding an email address, inherited from `<html dir="rtl">` with
  no override. Fixed at the shared `input.njk` macro: `email`/`password`/`tel`/`url`/`number`
  inputs now force `dir="ltr"` regardless of UI locale, covering every current and future caller,
  not just the login form that surfaced it.
- **P1-4 (silent validation failures on create forms):** the category/item/table "add" endpoints
  previously just re-rendered the unchanged list with zero feedback when server-side validation
  rejected a submission. Now they fire a specific `danger` toast (reusing the existing bilingual
  `common.admin.form.required`/`invalidPrice` strings). Field-level (per-input) error display is
  explicitly deferred to Phase 9, when A2/A4's more complex forms will actually need it.

### Verified

- `npx tsc --noEmit`, `npm run lint`, and a full production build all pass.
- axe-core re-run: still 0 violations across all 8 pages tested (no regression from the fixes).
- Lighthouse re-run: accessibility/best-practices/SEO hold at 100 across public menu (AR/EN) and
  authenticated admin dashboard; the AR/EN performance gap on the public menu closed from
  7-8 points to ~1 point.
- `docs/ux/screenshots/after/` holds the same 36-shot matrix as `before/`, re-captured post-fix;
  spot-checked the admin dashboard (both locales, 390px), the login error state, and the
  desktop nav (1280px, confirming no regression there) directly.
- Interactively verified (not just visually) that the new mobile nav toggle actually works:
  `aria-expanded` flips on click, the panel becomes visible, and its links render correctly.
- Production smoke test caught its own false alarm: starting the server with
  `NODE_ENV=production` locally makes session/CSRF cookies `Secure`-only, which don't survive
  over plain HTTP — produced a misleading "invalid csrf token" 500 that looked like a Phase 8
  regression but was just the smoke-test command's own flag; restarting without it confirmed
  everything worked. Not a code bug, logged so the same red herring doesn't cost time again.

### Known gaps / follow-ups

- P2 items from `audit.md` (uniform card/row visual weight, spacing/icon-style spot-checks not
  exhaustively re-verified, the `item-detail-sheet.njk` image missing explicit `width`/`height`
  attributes) remain unfixed by design — logged as polish, not required for this phase's
  acceptance bar.
- Field-level inline validation errors (vs. the toast-level fix shipped here) deferred to
  Phase 9, where A2 (variants/add-ons) and A4 (branding) introduce forms complex enough to need
  it.

## Phase 9: test infrastructure + Pack A (in progress)

Second track continues: Pack A features (A1–A5), each required to ship with bilingual UI,
RTL/LTR correctness, empty/loading/error states, accessibility, a migration where needed, and
tests for its critical flow. Before any feature work: built the Jest+Supertest harness flagged
as a prerequisite back in the Phase 6 interruption notes, since Phase 9's acceptance criterion
("tests passing") has nothing to run against without it.

### Test infrastructure

- **Dedicated `qaemati_test` database**, separate from dev data, with its own `.env.test`
  (`.env.test.example` tracked, `.env.test` itself gitignored, matching the existing
  `.env`/`.env.example` pattern) and migrations applied via `prisma migrate deploy`.
- **`src/bootstrap.ts`**: extracted everything `main.ts` did to the app instance (helmet,
  compression, body-parsing order, the locale/session/CSRF middleware sequencing that took real
  debugging effort in Phase 4) into a `configureApp()` function, so e2e tests exercise the exact
  same middleware stack production does instead of a thinner approximation that could silently
  drift from it. `main.ts` now just calls it and `listen()`.
- **`jest.config.js`** (unit, colocated `*.spec.ts`) and **`test/jest-e2e.json`** (e2e,
  `*.e2e-spec.ts`), matching Nest CLI convention. `test/utils/test-app.ts` provides
  `createTestApp()` (boots a full app via `configureApp()`), `createTestRestaurant()`/
  `deleteTestRestaurant()` (a minimal fixture independent of `prisma/seed.ts`'s larger demo
  dataset, unique slug per test file so files don't clobber each other), and `loginAsAdmin()`
  (logs in through a real HTTP round trip — GET the login page for a CSRF token, POST
  credentials — rather than forging a session, matching the project's "test through the real
  stack" approach).
- `npm run test:e2e` runs with `--runInBand` (tests share one database) and `--forceExit`
  (connect-pg-simple's raw `pg.Pool` for the session store isn't a Nest provider, so
  `app.close()` doesn't close it — a one-line, well-understood tradeoff, not a bug).

### Two real bugs found while building the harness, not by inspection

- **Every Arabic-locale toast crashed its request with a 500.** `triggerToast()` and
  `HttpExceptionFilter` both set the `HX-Trigger` response header to `JSON.stringify({ toast:
  {message, variant} })` — but HTTP header values must be Latin-1/ASCII, and Node's `http`
  module throws `ERR_INVALID_CHAR` on anything outside that range. Any Arabic message (this
  app's default locale) crashed outright. Invisible in every manual browser test across Phases
  4–9 so far: Chrome's `Accept-Language: en` header always won locale resolution for the htmx
  calls that fire toasts (no `?lang=` query param on those requests, and no `qaemati_locale`
  cookie set unless the language switcher was actually clicked), regardless of what language the
  *page* was displayed in. Real users with an Arabic-preferring browser — i.e. the actual target
  audience — would have hit this on every single admin action. Fixed by `encodeURIComponent`-ing
  the message before it goes in the header, and `decodeURIComponent`-ing it in `toast.njk`'s
  client-side handler (a no-op on already-ASCII text, so plain English toasts are unaffected).
  Added `test/admin-crud.e2e-spec.ts` as permanent regression coverage, asserting both locales
  roundtrip correctly.
- **Nest defaults every `@Post()` handler's status to 201**, even when the handler uses the raw
  `@Res()` escape hatch and never creates anything — and Express's `res.render()` doesn't reset
  an already-set status code. Every failed login attempt (`AuthController.login`'s `renderError`
  path) was returning `201 Created` for a page that created nothing. Harmless to a browser (it
  doesn't surface HTTP status to the user) but wrong, and exactly the kind of thing an
  HTTP-level e2e assertion catches that visual browser testing structurally can't. Fixed with an
  explicit `res.status(200)` before `res.render()`.
- Along the way, also gave `HttpExceptionFilter` a fallback for non-`HttpException` errors that
  still carry a `.statusCode` (the shape `csrf-csrf`'s `ForbiddenError` uses) — without it, a
  legitimate CSRF rejection (a stale tab, an expired session, not just an actual attack) surfaced
  as a generic 500 instead of a 403, caught by `auth.e2e-spec.ts`'s "no CSRF token" test.

### Verified

- 12 unit tests, 13 e2e tests, all passing. `npx tsc --noEmit`, `npm run lint`, and a full
  production build all pass.
- Re-verified the Arabic-toast fix against the actual running dev server with `curl` (not just
  the test suite) before trusting it.

### A1: "My selection" list with WhatsApp send (done)

Customer-side tap-to-build list, localStorage-backed (no account), with an optional note and a
"Send on WhatsApp" button that opens a pre-filled `wa.me` link. Hidden entirely — not just
disabled — when the restaurant has no WhatsApp number.

What was built:

- **`public/js/selection.js`**: a global Alpine store (`Alpine.store('selection', ...)`), not a
  per-component `x-data`, since the item cards' `+` buttons, the floating bar, and the summary
  sheet are independent DOM subtrees that all need to read/write the same state. Persists to
  `localStorage` under a restaurant-slug-scoped key (`qaemati:selection:<slug>`, read from
  `document.body.dataset.restaurantSlug`), so switching between the two demo restaurants in one
  browser doesn't mix their selections — verified directly (added an item, reloaded, switched
  restaurants, confirmed it reset).
- **`src/common/text/build-whatsapp-message.ts`** (unit tested, 11 cases) + its client-side
  mirror `public/js/whatsapp-message.js`: builds the plain-text message (restaurant name, table
  number if present, itemized list, note, total, and an explicit disclaimer that this is a
  WhatsApp message, not an online order or a payment — the brief's own wording, not
  paraphrased). Same server/client duplication tradeoff already established for
  `normalize-search-text.ts`/`menu.js`, documented the same way.
- **`src/menu/menu-labels.ts`**: resolves every selection-related string server-side into one
  `labels` object, same reasoning as `admin/admin-labels.ts` (a macro imported via `{% from %}`
  can't see the calling template's `t` global).
- `views/components/menu-item-card.njk`: root changed from a single `<button>` to a `<div>` so a
  separate `+` button can sit beside the existing "open details" button without nesting one
  button inside another. Both the card's `+` and the item-detail-sheet's "Add to selection"
  button are gated on `hasWhatsapp && item.available` — hidden server-side (not rendered at all)
  when there's no WhatsApp number, not just disabled.
- `views/components/selection-bar.njk`: the floating bar (shown once the selection has ≥1 item)
  and its bottom sheet — quantity +/- per item, a note field, the total, the disclaimer, and the
  "Send on WhatsApp"/"Clear selection" buttons. Entirely Alpine-driven against the global store;
  no server round trip for anything in this feature.

### Bugs found and fixed while building this

- **Alpine's CDN build starts via a queued microtask right after its own script executes, not
  on `DOMContentLoaded`.** `public/js/selection.js` registered its store via
  `document.addEventListener('alpine:init', ...)`, loaded as a `<script defer>` *after*
  `alpine.min.js` in document order — the pattern every other script on this project's pages
  already followed. That turned out to be too late: Alpine's own script, once it finishes
  executing (itself a deferred task), immediately queues a microtask to call `start()`, which
  runs before the browser even gets to the *next* deferred script, let alone
  `DOMContentLoaded`. Every `$store.selection.*` reference threw `Cannot read properties of
  undefined`. Fixed by loading `whatsapp-message.js`/`selection.js` before `alpine.min.js` in
  the HTML — which, mechanically, meant injecting them from `views/layouts/menu.njk` *before*
  its `{% include "partials/head.njk" %}` line (the include is where `alpine.min.js` actually
  lives), not from `views/pages/menu.njk` via a block.
- **That fix's first attempt didn't work, for a reason specific to this codebase**: a `{% block
  pre_alpine_scripts %}` defined *inside* `partials/head.njk` (an included partial) is not
  reachable by `{% block %}` overrides from `pages/menu.njk`, even though `pages/menu.njk`
  extends `layouts/menu.njk` which includes that partial. Verified empirically (rendered output
  simply didn't contain the override) rather than assumed — this project already has one
  documented Nunjucks scoping surprise (macro imports can't see caller globals, from Phase 4);
  this is a second, different one: a block's reachability depends on the direct `extends` chain,
  not on what an ancestor template happens to `{% include %}`. Resolved by injecting the script
  tags directly in `layouts/menu.njk`'s own markup instead of through a block.
- **A toast fired by the `+` button visually overlapped the selection sheet's own Send/Clear
  buttons.** Both the toast host and the sheet's action buttons dock to the bottom of the
  viewport (`bottom-4`); tapping `+` then immediately opening the sheet (very plausible — that's
  the obvious next action) showed the "Added to your selection" toast sitting on top of the
  real buttons for its full 4-second lifetime. Found visually (a screenshot comparison), not by
  a failing test — the buttons were still present and clickable underneath, just visually
  obscured, which no DOM-presence check would catch. Fixed by moving the shared toast host from
  `bottom-4`/`z-50` to `bottom-24`/`z-[60]`, clearing the floating bar and the sheet's bottom
  button area in the common case (a lesser residual overlap remains if a user adds several items
  in rapid succession, stacking multiple toasts — acceptable, not fixed further given it's a
  secondary/rare path).

### Verified

- Unit: 11 new `build-whatsapp-message` tests (message formatting, table-line
  presence/absence, note trimming, multi-item listing, URL encoding including Arabic text) —
  31 unit tests total now, all passing.
- E2E: `test/selection.e2e-spec.ts` covers what an HTTP-level test actually can for a
  client-side feature — the scripts and add-button markup are present when a WhatsApp number
  exists, absent (not just hidden) when it doesn't, load in the correct order relative to
  Alpine, and the Arabic labels render under the Arabic locale.
- Interactive (Playwright, both locales): added an item via a card's `+` button, opened the
  floating bar, adjusted quantity, added a note, confirmed the generated `wa.me` link's
  decoded message text was correctly formatted (table number, itemized list, note, total,
  disclaimer) in both English and Arabic; confirmed the feature is completely absent (no
  scripts loaded, no `+` buttons rendered) when a restaurant's WhatsApp number is cleared, then
  restored the seed data afterward.
- axe-core: 0 violations on the selection sheet (Arabic/RTL, with items added and the sheet
  open) against WCAG 2.0/2.2 A+AA tags.
- `npx tsc --noEmit`, `npm run lint`, `npm run contrast:check`, and a full production build all
  pass; demo data re-seeded clean after testing.

### A2: Variants and add-ons (done)

Sizes with their own full price (not a delta), plus optional multi-select extras, handled in
the admin item form and the public item detail sheet.

What was built:

- **Migration** (`20261004085807_add_item_variants_and_addons`): `ItemVariant` and `ItemAddon`
  models, each with its own `restaurantId` (not just reachable via `itemId` → `categoryId` →
  `restaurantId`) per the brief's rule, `nameAr`/`nameEn`/`price`/`sortOrder`, cascading delete
  from `Item`. A variant is an absolute price ("Small 10 ILS, Large 15 ILS"), not a delta —
  simpler for an owner to enter correctly and a customer to read than "+5 ILS for Large".
- **Admin** (`ItemService.update`): variants/addons are replaced wholesale on every item save
  (delete all, recreate from the submitted list) rather than diffed row-by-row, since the form
  submits its whole current list as a flat indexed array
  (`variants[0][nameAr]`, `variants[1][nameAr]`, ...) with no stable per-row identity to diff
  against. `views/admin/components/options-editor.njk`: one shared Alpine-driven macro renders
  either list (parameterized by field-name prefix), used twice in `item-row.njk`'s edit form.
  `items.controller.ts`'s `parseOptions()` reconstructs the list server-side, dropping a row
  with no name on either side (an empty trailing "add row" left unused, not submitted
  intentionally) — unit tested directly (7 cases: parsing, empty-row dropping, partial names,
  missing/negative price defaulting, whitespace trimming, non-object input).
- **Public menu**: an item with variants shows "From {cheapest price}" on its card instead of a
  single price, and its quick `+` button opens the detail sheet instead of quick-adding (there's
  no single price to add at). In the sheet: a radio list for variants (one required, "Add to my
  selection" stays disabled with an explanatory hint until one is picked) and a checkbox list
  for addons, with the displayed price recomputed live as either changes. Adding to the
  selection (A1) composes one flat line item — name becomes `"Arabic Coffee (Large) + Extra
  cardamom"`, price becomes the sum — rather than teaching A1's cart model about nested
  modifiers; the cart key includes the chosen variant/addon ids, so different combinations of
  the same base item become separate, independently-adjustable cart lines.

### Verified

- Unit: 7 new `parseOptions` tests (in `items.controller.spec.ts`) — 27 unit tests total.
- E2E: `test/variants.e2e-spec.ts` — saves variants/addons through the real PATCH endpoint and
  confirms they persist correctly in the database; confirms a second save *replaces* the list
  rather than appending to it (submitting addons as empty cleared the previous save's addon);
  confirms the public menu shows the "From" price once an item has variants.
- Interactive (Playwright, both admin and public sides): added two variants and one add-on to a
  real item through the admin UI, reopened the edit form and confirmed the values reloaded
  correctly; on the public menu, confirmed "Add to my selection" is disabled until a size is
  picked, confirmed the live price recomputes correctly when selecting "Large" (15) + "Extra
  cardamom" (+2) → 17.00, and confirmed the resulting cart line read exactly
  `"Arabic Coffee (Large) + Extra cardamom — 17.00 ILS"`.
- axe-core: 0 violations on the item detail sheet with the variant/addon UI open.
- `npx tsc --noEmit`, `npm run lint`, `npm run contrast:check`, and a full production build all
  pass; migration applied to both the dev and test databases; demo data re-seeded clean after
  testing.

### A3: Specials and schedules (done)

A "Today's special" banner, time-gated categories (e.g. a Breakfast section only shown
07:00-11:00), and a live "Open now / Closes at" badge, all computed in Asia/Hebron time.

What was built:

- **Migration** (`20261004090948_add_specials_and_schedules`): `Restaurant.openTime`/`closeTime`
  (structured "HH:MM" daily hours, separate from the existing free-text `workingHoursAr`/`En`
  display string, since free text can't be parsed back into a live computation),
  `Category.availableFrom`/`availableTo` (optional daily window), `Item.isTodaysSpecial`
  (owner-toggled boolean, not date-scoped — there's no "which day" concept in this app).
- **`src/common/open-status.ts`**: pure, unit-tested (16 cases) functions —
  `computeOpenStatus(openTime, closeTime, nowMinutes)` (same-day *and* overnight ranges, e.g.
  "20:00-02:00"), `isCategoryAvailableNow(...)`, and `nowInHebronMinutes()` (uses
  `Intl.DateTimeFormat` with `timeZone: 'Asia/Hebron'` — no new date library needed; verified
  Node's ICU build resolves the zone correctly, including the midnight-as-"00:00"-not-"24:00"
  edge case). Mirrored client-side in `public/js/open-status.js` for the live-ticking badge
  (same duplication tradeoff as `normalize-search-text.ts`/`menu.js`) — deliberately re-queries
  Asia/Hebron time on every tick rather than the browser's own local timezone, so a diner
  viewing from outside Palestine still sees the status the restaurant itself would recognize.
- **`MenuService`**: categories outside their availability window are filtered out of the
  response entirely (not shown-but-disabled) — matches the real-world pattern of e.g. a
  breakfast menu disappearing from an ordering app after 11am. `todaysSpecials` is built from
  items actually visible after that filter, not every `isTodaysSpecial` row in the database — an
  item whose category is currently hidden never appears in the banner either, even if flagged,
  since showing a "special" the diner can't actually reach anywhere else would be misleading.
- **Admin**: `CategoryService`/`CategoriesController` validate availability as both-or-neither —
  a one-sided time left blank by mistake is treated as "always available," not a window that
  never opens or never closes. `ItemService`/`ItemsController` add the "Today's special"
  checkbox alongside the existing availability toggle. Both show a small indicator in their
  collapsed (non-editing) row — the time range for a category, a gold badge for a special item —
  consistent with the existing variants/addons count badges from A2.
- **Public menu**: `restaurant-header.njk` shows the open/closed badge (a 60-second client tick,
  not just the value from page load) right under the working-hours text; a horizontally-
  scrolling "Today's special" strip sits above the sticky search bar when any items qualify,
  reusing the same shared item-detail-sheet as the regular listing (tapping a special opens it
  exactly like tapping a normal card, so "add to selection" works identically from either path).

### Verified

- Unit: 16 new `open-status` tests (same-day ranges, overnight ranges, boundary minutes,
  category-window edge cases, a `nowInHebronMinutes` sanity check against a known UTC instant) —
  42 unit tests total.
- E2E: `test/specials.e2e-spec.ts` — the open/closed badge renders when structured hours are
  set; an always-available item appears in the specials banner; a non-special item does not; a
  category outside its window is absent from the response entirely; a special item whose
  category is hidden is correctly excluded from the banner too (the "filter before building
  todaysSpecials" ordering, covered directly).
- Interactive (Playwright + direct `curl`, both demo restaurants): confirmed the Breakfast
  category (07:00-11:00) was correctly absent from the menu at the actual time of testing
  (mid-afternoon) while the open/closed badge correctly read "Open now, closes 23:00"; confirmed
  Al-Sanabel's noon-to-midnight hours exercise the overnight-range branch of the computation, not
  just the same-day one; tapped a "Today's special" banner card and confirmed it opens the same
  shared detail sheet as a normal item; reopened the Breakfast category's edit form and confirmed
  its saved `07:00`/`11:00` values reloaded correctly.
- axe-core: 0 violations on the menu page with the specials banner and open-status badge both
  rendered (Arabic/RTL).
- `npx tsc --noEmit`, `npm run lint`, `npm run contrast:check`, and a full production build all
  pass; migration applied to both the dev and test databases; demo data re-seeded clean after
  testing.

### Bugs found and fixed while building this (test-script bugs, not app bugs — logged since they
cost real debugging time before being ruled out)

- An e2e assertion checked for the literal string `"Today's special"`, but Nunjucks
  HTML-escapes the apostrophe to `&#39;` in its output — confirmed via a direct `curl` request
  before touching the test, not assumed. Not an app bug (the escaping is correct and expected);
  fixed the assertion to match the actual escaped output.
- A second assertion counted every occurrence of an item's name across the whole page and got 5
  instead of the expected 1 — the name legitimately appears multiple times (its own category
  row's visible text, plus that row's embedded JSON `data-item` payload used for the detail-sheet
  dispatch). Fixed by scoping the check to the banner section's own markup specifically.

### A4: Branding settings, white-label (done)

An admin "Branding" page covering restaurant details, logo/cover image uploads, a primary-color
picker that live-checks WCAG AA contrast, and a currency code -- plus wiring the saved color
through to actually change the public menu's palette per restaurant, not just store it inertly.
`src/styles/tokens.css`'s own header comment ("Exposed on :root so a restaurant can later
override `--color-primary`...") already anticipated this from Phase 1.

What was built:

- **Migration** (`20261004133432_add_branding_fields`): `Restaurant.coverImagePath`,
  `Restaurant.primaryColor` (nullable hex; null means "use the default Zaytoun palette", the
  same convention as every other optional field in this schema), `Restaurant.currency` (defaults
  to `"ILS"`, used as the new-item form's default rather than a hardcoded literal).
- **`src/common/color.ts`** (new, unit-tested, 17 cases): `hexToRgb`, `contrastRatio`,
  `meetsPrimaryColorContrast` (contrast against white >= 4.5:1 -- the design system's
  `--color-on-primary` stays fixed white rather than flipping per restaurant, so the constraint
  is "which primary colors stay readable with white text," not "pick readable text for this
  color"), `darken`/`lighten` (for the hover/soft shades a chosen color needs, mirroring how the
  default pair relates). `scripts/check-contrast.ts` (the Phase 1 palette gate) was refactored to
  import this instead of keeping its own copy of the same luminance/contrast math -- one
  canonical implementation instead of two silently drifting apart.
- **`RestaurantService`** (new): re-validates the color server-side (`meetsPrimaryColorContrast`)
  even though the form's own JS already blocks a bad submission client-side -- the form can be
  bypassed, and a failing color would make every button label unreadable for every diner, not
  just a cosmetic nit. Same both-or-neither validation for `openTime`/`closeTime` as A3's
  category windows.
- **`BrandingController`** (new, `/admin/branding`): a details-save endpoint and two image-upload
  endpoints (logo, cover), reusing `itemImageMulterOptions`'s rules (jpeg/png/webp, 5MB cap) via a
  new `restaurantImageMulterOptions` writing to its own `public/uploads/restaurants/` directory
  rather than mixing with item photos.
- **Public menu**: `MenuService` derives `primaryColorCss` ("R G B" triplets for `--color-primary`
  / `-hover` / `-soft`) from the restaurant's hex when set; `layouts/menu.njk` injects them as an
  inline `:root` override scoped to that one page load, so every other restaurant's menu keeps
  the Zaytoun default untouched. `restaurant-header.njk` renders the cover image as a banner above
  the existing logo/name block when set.
- **Admin dashboard**: the "add item" form's currency field now defaults to the restaurant's own
  `currency` (threaded through `buildAdminLabels`'s new optional third argument) instead of a
  hardcoded `"ILS"` literal, so a JOD restaurant's admin isn't quietly fighting the form every
  time they add an item.
- **Live contrast check**: `public/js/color-contrast.js` mirrors `src/common/color.ts`'s formula
  client-side (same duplication tradeoff as A3's `open-status.js`) so the branding form shows a
  pass/fail ratio as the owner drags the color picker, before ever submitting.

### Verified

- Unit: 17 new `color` tests (hex parsing/formatting, contrast ratio against known values, the
  AA threshold boundary, darken/lighten) -- 59 unit tests total.
- E2E: `test/branding.e2e-spec.ts` -- saving valid details and a passing color persists and
  returns a success toast; a color too light for white text is rejected with a danger toast and
  does *not* overwrite the previously-saved valid color; a one-sided open/close time is rejected;
  the saved color actually appears as a `--color-primary` override on the public menu response; a
  non-image file upload for the logo is rejected with 400.
- Interactive (Playwright, both demo restaurants): logged into Al-Sanabel's admin, confirmed the
  branding page's live contrast indicator correctly flips from pass to fail as the color input
  changes (tested with a pastel color, ratio 1.41:1); confirmed the server independently rejects
  that same bad color on submit; confirmed a real detail change (WhatsApp number) and a real logo
  upload (PNG) both persisted correctly to the database; confirmed Al-Sanabel's seeded brand color
  (`#1E5F74`) renders as the actual button/badge color on its public menu while Bayt Al-Zaytoun
  (no `primaryColor` set) correctly keeps the default Zaytoun green -- proving the override is
  scoped per restaurant, not global.
- axe-core: 0 violations on the branding admin page (Arabic and English) and on both restaurants'
  public menus after the cover-image and color-override changes.
- `npx tsc --noEmit`, `npm run lint`, `npm run contrast:check`, and a full production build all
  pass; migration applied to both the dev and test databases; demo data re-seeded clean after
  testing (including re-uploading Al-Sanabel's seed logo, which a manual upload test had
  temporarily overwritten with a throwaway test PNG).

### Bug found during the axe-core pass (fixed before commit)

- The branding page's two file-upload inputs and its primary-color hex text input had no
  accessible label (axe: `label`, critical, "Form elements must have labels") -- the visible
  `<label>` text sat as a sibling with no `for`/`id` association for the file inputs, and the hex
  input had no label at all (only the adjacent color swatch did). Fixed by adding `id`/`for`
  pairs to the file inputs and an `aria-label` to the hex input; re-ran axe-core afterward and
  confirmed 0 violations in both languages.

## Pack A complete (A1-A5)

### A5: Demo mode (done)

A `DEMO_MODE`-gated "Try the admin panel" panel on the home page (credentials + a one-click link
to the real login screen, not a bypass login), a "Reset demo data" action that restores both
seeded restaurants to their clean sample state, and a skippable 4-step guided tour shown once on
an admin's first login.

What was built:

- **`src/common/demo-mode.ts`**: `isDemoModeEnabled()` reads `process.env.DEMO_MODE === 'true'`
  exactly -- unit tested to confirm it's not fooled by `'1'` or `'TRUE'`. Gates both the home
  page's demo panel and the `/demo/reset` endpoint (which throws 403 when disabled, re-checked
  server-side even though the panel that links to it is itself hidden).
- **Seed logic moved into `src/`**: `tsconfig.build.json` excludes the whole `prisma/` directory
  from the Nest build, so the running app couldn't import the seeding logic while it lived at
  `prisma/seed/data.ts`+`prisma/seed.ts`. Moved the actual logic to
  `src/prisma-seed/run-seed.ts` (`runSeed(prisma)`, now returning a summary instead of only
  logging it) plus `seed-data.ts`/`placeholder-image.ts`; `prisma/seed.ts` (the path Prisma's own
  CLI config requires) is now a thin wrapper that imports from `src/` and supplies its own
  standalone `PrismaClient`. One implementation either way calls, instead of a second copy
  reachable only from the app.
- **`DemoController`** (`POST /demo/reset`, new): calls `runSeed` through the app's own
  `PrismaService` rather than shelling out to `npx prisma db seed` as a child process. Wipes and
  recreates *every* restaurant, not a scoped single-tenant reset -- deliberate, since this
  endpoint only exists in a demo environment to begin with, and "reset" there means "back to the
  clean two-restaurant demo state."
- **Home page**: `HomeController` now also fetches each restaurant's first admin's email (only
  when demo mode is on) and exposes the shared `DEMO_ADMIN_PASSWORD` constant; the panel links to
  the real `/admin/login` screen rather than a shortcut session-creating endpoint, so trying the
  demo exercises the actual login flow (rate limiting, CSRF, session regeneration) like anyone
  else would.
- **`AdminUser.hasSeenTour`** (migration `20261004135144_add_has_seen_tour`): checked once at
  login (`AuthController`) and cached on the session (`AdminLocalsMiddleware`'s existing
  "resolve once per login, not per request" pattern for `restaurantSlug`/`adminName`) rather than
  queried on every admin page load.
- **`views/admin/components/guided-tour.njk`**: a 4-step sequential dialog (categories/items,
  specials/variants, QR codes, branding) rather than a spotlight overlay pinned to specific
  page elements -- simpler to keep correct as the admin UI evolves, and inherently
  keyboard/screen-reader accessible as just another dialog, reusing
  `admin-confirm-dialog.njk`'s `role="dialog"`/focus pattern. Wrapped in a server-side `{% if
  showTour %}` (not just an Alpine `x-show`) so a dismissed tour's markup -- and its "Welcome to
  your menu" text an e2e test checks for -- isn't shipped to every admin page load at all, not
  merely hidden.
- **`TourController`** (`POST /admin/tour/dismiss`, new): updates both the DB (stays dismissed on
  the next login, weeks later) and the session (doesn't reappear on the very next page load in
  the same session without a fresh login re-reading the DB).

### Verified

- Unit: 3 new `demo-mode` tests (enabled, unset, and non-`'true'` values like `'1'`/`'TRUE'`) --
  62 unit tests total.
- E2E: `test/demo.e2e-spec.ts` (home page shows the panel; reset actually wipes an unrelated
  throwaway restaurant and recreates exactly the two demo restaurants; the success banner and
  demo credentials render after the redirect) and `test/guided-tour.e2e-spec.ts` (tour markup
  present on a fresh login; dismissing persists to the DB and stops showing it in the same
  session without a new login; a subsequent fresh login still doesn't show it) -- 36 e2e tests
  total.
- Interactive (Playwright): clicked through every tour step (Next x3, Done), confirmed the
  dismiss request fires and the tour stays gone after a page reload within the same session;
  confirmed `hasSeenTour` flips to `true` in the database; ran the actual "Reset demo data"
  button including its native confirm() dialog, confirmed the redirect, the success banner, and
  that both restaurants came back with `hasSeenTour` reset to `false` on their admin accounts
  (proving it's a real from-scratch reseed, not a partial patch).
- axe-core: 0 violations on the home page (with the demo panel visible) and on the tour dialog
  (open, mid-flow) in both languages.
- `npx tsc --noEmit`, `npm run lint`, `npm run contrast:check`, and a full production build all
  pass, including confirming the moved seed logic (`src/prisma-seed/`) actually compiles into
  `dist/` where the running app can reach it -- the whole point of the move. Migration applied to
  both the dev and test databases; demo data re-seeded clean after testing.

### Bugs found while testing (both test-script bugs, not app bugs)

- The first interactive tour check used `?lang=en` on the login page's URL and expected the
  post-login dashboard to render in English, but got Arabic -- the query param only sets the
  locale for that one request, not a persistent cookie, so it doesn't survive the redirect to
  `/admin`. Same root cause as two similar false negatives in A3/A4's testing; fixed by setting
  the `qaemati_locale` cookie directly instead.
- An e2e assertion for "the tour doesn't show again" initially failed even after a correct
  dismiss, because the tour's full 4-step markup was always present in the server-rendered HTML
  regardless of `showTour` (only hidden via Alpine's `x-show`, which Alpine applies client-side,
  not something `supertest`'s raw HTML response reflects). Not a bug in the dismiss logic itself
  -- fixed properly by wrapping the whole component in a server-side `{% if showTour %}` (see
  above), which is also strictly better than what was there before: a dismissed tour's markup no
  longer ships to the browser at all.

## Phase 10: admin customization extensions + known-gaps closure (done)

Two parts, same continuous session. First, more white-label/admin-UX work on top of Pack A's A4
(branding) and the category/item reorder buttons: drag-and-drop reordering, a real live preview
on the branding page, a new "corner style" customization, and a visual pass on buttons/choices.
Second -- once asked whether to start a new feature pack or close out what was already on the
books -- closing the two concrete items `docs/ux/audit.md` had explicitly deferred rather than
fixed: P1-4's field-level inline validation (deferred from Phase 8 to "once A4's more complex
forms actually need it," which they now do) and the P2 `item-detail-sheet.njk` image
`width`/`height` attributes.

### Admin customization extensions

What was built:

- **Drag-and-drop reorder**: `CategoryService.reorder`/`ItemService.reorder` (new, bulk
  `sortOrder` rewrite in a transaction, silently dropping any id that doesn't belong to the
  requesting restaurant/category rather than erroring -- the dragged list only ever came from
  that restaurant's own render, so a mismatch only happens via a stale client or a tampered
  request) plus `POST /admin/categories/reorder` and `POST /admin/categories/:id/items/reorder`.
  `public/js/sortable-admin.js` wires SortableJS onto `[data-sortable]` containers via a drag
  handle, debounced via `onEnd`'s index check; the existing keyboard-accessible up/down buttons
  stay as-is, not replaced, since SortableJS has no keyboard path of its own.
- **Live branding preview**: `views/admin/partials/branding-preview.njk` is an iPhone-style
  frame around an `<iframe>` of the *real* `/m/:slug` page, not a hand-built mockup -- so it's
  pixel-identical by construction. "Live" means the iframe's `src` carries the current, unsaved
  form state as `preview*` query params (`MenuController.show`, debounced ~250ms), which
  `MenuService.getMenu`'s new `MenuPreviewOverrides` only honors when the request's own session
  `restaurantId` matches the restaurant being viewed -- without that check this would be a plain
  unauthenticated reflected-input defacement vector on the public menu. A separate `embed=1`
  param (unauthenticated, purely cosmetic) adds an `embed-frame` class that hides the iframe's
  own scrollbar via `scrollbar-width`/`::-webkit-scrollbar` without touching `overflow`.
- **Corner style** (new restaurant field, `rounded` | `sharp`, migration
  `20261005103453_add_corner_style`): same "CSS custom-property override, scoped to one page
  load" mechanism as `primaryColor`/`fontTheme`, overriding `--radius-sm/md/lg` so it reaches
  every `rounded-sm/md/lg` class already in the public menu's markup for free.
  `views/components/choice-card.njk` (new, built on the `has-[:checked]` CSS variant) replaces
  plain radio+label rows for typeface/density/corner-style with card-style "swatch" choices --
  the common theme-editor pattern (Shopify, Stripe dashboards), more scannable than a radio list
  once a setting has more than one or two options.
- **Layout/polish**: admin sidebar is now `sticky`; `views/components/button.njk` (shared
  site-wide) gained shadows and a press animation; `layouts/admin.njk`'s `<main>` width became
  an overridable `{% block mainWidth %}` (was hardcoded `max-w-3xl`, which squeezed the branding
  page's new two-column form+preview layout into ~700px -- found from a user screenshot showing
  a squashed form and a cut-off phone, not caught by automated checks since nothing here
  regressed a test).

### Known-gaps closure

- **Field-level inline validation (A4's branding form).** `RestaurantService`'s color-validation
  error codes are now field-specific (`INVALID_PRIMARY_COLOR` /
  `PRIMARY_COLOR_CONTRAST_TOO_LOW` vs. the `SECONDARY_` equivalents -- previously one shared
  `INVALID_COLOR`/`COLOR_CONTRAST_TOO_LOW` pair couldn't tell the controller which input was
  actually wrong). `BrandingController.update` maps each code (plus the pre-existing
  `OPEN_CLOSE_BOTH_REQUIRED` and a bare `nameAr`/`nameEn` required check) to a `fieldErrors: {
  [name]: message }` object passed to the re-rendered form alongside the existing toast, not
  instead of it. `views/components/input.njk` (previously only used by the login form) gained an
  optional `dir` param so it could be reused for `nameAr`/`nameEn`/`openTime`/`closeTime` instead
  of hand-rolling the same error-display markup a third time; the composite primary/secondary
  color inputs (swatch + hex + reset button) keep their custom markup but get the same
  `aria-invalid`/red-border/inline-message treatment by hand. `openTime`/`closeTime` and
  `nameAr`/`nameEn` moved into the branding page's shared Alpine scope (`x-model`) so a rejected
  save's typed-but-not-yet-saved value survives the htmx swap instead of snapping back to the
  last-saved DB value right next to its own "required" error -- which would otherwise look
  contradictory now that the field is visibly flagged.
- **P2: `item-detail-sheet.njk` image `width`/`height`.** Added (`400`/`192`, matching the
  `h-48 w-full` box the CSS already fixes) to match the letter of the Web Interface Guidelines
  finding from the Phase 7 audit addendum -- confirmed inert for actual layout shift, since CSS
  already reserves the exact box before the image loads either way, same conclusion the audit
  itself reached.

### Verified

- `npx tsc --noEmit`, `npm run lint`, and a full production build all pass.
- E2e: extended `test/branding.e2e-spec.ts` with 4 new cases -- a malformed primary-color hex
  rejected distinctly from a too-light one (different toast text, same `fieldErrors.primaryColor`
  anchor); a blank `nameEn` flags only `field-nameEn-error`, not `field-nameAr-error`; the
  existing too-light-color and one-sided-hours cases now also assert the right (and only the
  right) field's error anchor is present in the response HTML. 38 e2e tests total, all passing.
- Interactive (Claude-in-Chrome): dragged a category and an item to confirm the new order
  persists (then dragged back); toggled corner style live and confirmed `--radius-sm/md/lg`
  actually change in the preview iframe's rendered HTML; typed an invalid hex into the primary
  color field in the real browser UI and confirmed the inline "Enter a valid color." message
  renders directly under the field (red border, same text as the toast), then fixed it and saved
  to confirm the stale error clears.
- Confirmed via `curl` (authenticated session) that `MenuPreviewOverrides` only applies when the
  session's `restaurantId` matches the restaurant being viewed, and that `cornerStyleCss`'s
  `--radius-*` overrides appear in the rendered `/m/:slug` HTML when requested.

**Addendum (same session):** the primary/secondary color field error's staleness noted above was
fixed immediately after, not left as a gap -- `branding.njk` gained
`primaryColorErrorDismissed`/`secondaryColorErrorDismissed` (default `false`, so the
server-rendered error still shows on load), set `true` by the same `x-on:input`/reset-button
handlers that already call `recomputeContrast()`/`recomputeSecondaryContrast()`. The static
error `<p>` is now `x-show="!xDismissed"`, so it disappears the moment the admin actually edits
the field again instead of waiting for the next save round-trip.

### Known gaps / follow-ups

- Pack B (a second feature pack, referenced in Phase 7's "Phases 7-11" framing alongside Pack A)
  was deliberately not started this phase -- its scope was never written down in this repo (only
  in whatever the original brief said), and the choice this phase was explicitly to close known
  gaps instead of guessing at or re-deriving that scope.

## Phase 11: item photo UX + a deeper theme editor (done)

Requested directly (not from the audit backlog): item photos needed to be easier to manage, and
the admin needed more control over the public menu's look than color/font/density/corner-style
already gave. Asked first which specific gaps to close rather than guessing -- the answer was
"surface the upload control outside edit mode" (not multiple photos) and "a fuller theme editor:
colors, spacing, shadows, button shape" (not per-category colors or a layout/section editor).

### What was built

- **Item photo upload, redesigned.** The 56px thumbnail in `item-row.njk` is now itself the
  upload control (a `<label>` wrapping a hidden file input) instead of a separate file input
  shown only in edit mode -- tapping the thumbnail opens the file picker directly, with an
  always-visible camera badge in the corner (not a hover reveal, which a phone-first admin would
  never discover) and a plain image-outline placeholder instead of a blank box when empty. The
  old edit-mode-only upload control was removed as redundant.
- **Three new restaurant-level theme fields** (migration `20261005111847_add_theme_editor_fields`),
  following the exact pattern primaryColor/fontTheme/cornerStyle already established (validated
  service-side, overridden as scoped `:root` CSS custom properties on the public menu only, wired
  through the branding live preview's debounced query params):
  - **`backgroundColor`** (nullable hex) overrides `--color-bg`. New `meetsBackgroundContrast` in
    `src/common/color.ts` checks it against `DEFAULT_TEXT` (tokens.css's fixed, non-customizable
    `--color-text`) at the same 4.5:1 AA bar the other color fields use -- there's only one text
    color to stay readable against here, not a derived palette.
  - **`cardStyle`** (`flat` | `raised`) toggles `--shadow-raised` on `.menu-item-card` via the
    same `body[data-X]` CSS-attribute pattern `menuDensity` already uses.
  - **`buttonShape`** (`rounded` | `pill`) overrides a new `--radius-button` token (default
    `var(--radius-md)`, so it already tracks a `sharp` cornerStyle for free) consumed by the
    menu's CTA-style buttons specifically -- the WhatsApp/Instagram links
    (`restaurant-header.njk`) and the selection sheet's send/cancel buttons (`selection-bar.njk`).
    Deliberately **not** applied to icon-only circular buttons or the already-pill floating
    selection bar, which aren't "buttons" in the sense this setting means.
- **Admin UI**: a background-color picker (same swatch+hex+reset+live-contrast pattern as
  primary/secondary, including the same field-level error treatment from Phase 10) and two more
  `choice-card.njk` groups (card style, button shape) alongside the existing three.

### Verified

- Unit: 3 new `meetsBackgroundContrast` cases (the Zaytoun default, white, and a dark background
  the fixed body text would disappear into) -- 72 unit tests total.
- E2e: `test/branding.e2e-spec.ts` gained 2 cases -- saving backgroundColor/cardStyle/buttonShape
  and confirming all three appear correctly in the public menu's rendered HTML
  (`--color-bg`, `--radius-button: 9999px`, `data-card-style="raised"`), and a too-dark background
  rejected with a field-level error that doesn't overwrite the previously-saved valid one. 40 e2e
  tests total.
- Interactive (Claude-in-Chrome): confirmed the new camera-badge thumbnail is clickable outside
  edit mode on the real dashboard; toggled card style and button shape live in the branding
  preview and confirmed (zoomed screenshots) the WhatsApp/Instagram buttons actually went pill-
  shaped and the item card actually gained a visible shadow; caught and corrected an accidental
  misclick during this same pass (a coordinate drifted after the page reflowed from an earlier
  click, briefly setting an unintended accent/background color) before saving over it.
- `npx tsc --noEmit`, `npm run lint`, `npm run contrast:check`, and a full production build all
  pass. Migration applied to both the dev and test databases.

## Phase 12: category separators + a patterned/photo background (done)

Requested directly, continuing the same theme-editor track: "enrich the choices" and add
separators between categories plus a background pattern or static image option.

### What was built

Three more restaurant-level fields (migration
`20261005112853_add_dividers_and_background_style`), same validated/scoped-CSS/live-preview
pattern as every customization field before it:

- **`categoryDivider`** (`none` | `line` | `dashed`) adds a `border-top` (plus matching padding)
  between `[data-category-section]` elements on the public menu -- that attribute already existed
  on each category's `<section>` (`views/pages/menu.njk`), so no markup change was needed, only
  the new `body[data-category-divider]` CSS rule.
- **`backgroundStyle`** (`solid` | `pattern` | `image`) with two dependent fields:
  - **`backgroundPattern`** (`dots` | `grid` | `diagonal`) when `pattern` -- three CSS
    `background-image` rules (radial-gradient, crossed linear-gradients, repeating-linear-gradient)
    tinted with `rgb(var(--color-primary) / alpha)`, not a fixed gray, so the texture reads as
    branded and automatically follows a restaurant's own primary color.
  - **`backgroundImagePath`** when `image` -- an uploaded photo (new
    `POST /admin/branding/background`, `RestaurantService.setBackgroundImage`, same
    `restaurantImageMulterOptions` as logo/cover), applied as an inline `background-image` style
    on `<body>` (scroll-position `cover`/`top center`, deliberately **not**
    `background-attachment: fixed`, which has a well-known rendering bug on mobile Safari --
    this app is mobile-first per every prior phase's research).
- **Admin UI**: two more 3-option `choice-card.njk` groups (category separators; background
  style), with the pattern sub-choice and the background-photo upload control both shown only
  when relevant (`x-show`, same shared Alpine scope) rather than always-visible-but-irrelevant.
  The background-photo upload (a separate htmx request, not part of the save-that-reloads-the-
  preview flow the other fields use) now dispatches a `qaemati-preview-refresh` window event on
  completion so the live preview iframe picks up a freshly uploaded photo immediately instead of
  only on the next full save.

### Verified

- E2e: `test/branding.e2e-spec.ts` gained 2 cases -- saving categoryDivider/backgroundStyle/
  backgroundPattern and confirming all three as `data-*` attributes in the public menu's rendered
  HTML; uploading a background image and confirming the resulting `background-image: url(...)`
  inline style appears. 42 e2e tests total (unit tests unchanged at 72, no new pure-function logic
  this phase).
- Interactive (Claude-in-Chrome): toggled background style to "Pattern" and confirmed the
  dependent pattern sub-choice appeared/disappeared reactively; selected "Diagonal" and confirmed
  (zoomed screenshot) the tinted stripe texture actually renders in the live preview's card gaps;
  reset every changed field back to its default and saved before finishing.
- `npx tsc --noEmit`, `npm run lint`, `npm run contrast:check`, and a full production build all
  pass. Migration applied to both the dev and test databases.

## Phase 13: section spacing, closing out the theme editor's original scope (done)

Phase 11's scoping question for "a fuller theme editor" was answered as "colors, spacing,
shadows, button shape" -- colors/shadows/button-shape landed in Phase 11, categoryDivider/
background in Phase 12, but spacing was deliberately deferred as its own dimension rather than
conflated with menuDensity (which controls item-card sizing, a different axis). This phase adds
it: `sectionSpacing` (migration `20261005140601_add_section_spacing`), `cozy` | `comfortable`
(default, the original `gap-8`/`py-6`) | `spacious`, overriding the gap between
`[data-menu-sections]` category sections and the page's vertical padding via the same
`body[data-section-spacing]` CSS-attribute pattern every prior spacing/style toggle uses. Full
pipeline (service validation, controller, menu service/controller preview override, admin
choice-card UI, live preview wiring) follows the exact established shape -- no new mechanism.

Verified: extended the Phase 12 e2e case with `sectionSpacing` assertions (72 unit + 42 e2e tests,
unchanged counts since this reused an existing test rather than adding a new one); confirmed
interactively that "Spacious" visibly widens the gap between category sections in the live
preview (screenshot comparison) without affecting item-card spacing; reset to default and saved.
`npx tsc --noEmit`, `npm run lint`, `npm run contrast:check`, and a full production build all pass.

## Phase 14: Pack B scoped, B1 built -- dietary tags, allergen note, filter (done)

Pack B's scope was never written down (flagged as a known gap since Phase 10) -- found it,
instead of guessing: `docs/ux/glossary.md` (Phase 7) had already coined terminology for four
not-yet-built feature groups ("New terms needed for Phases 9–11"), none of which existed in the
codebase (verified by grep before trusting it): dietary tags + filter (B1), analytics (B2), bulk
tools (B3), share + PWA (B4). Confirmed the breakdown and build order with the user; B1 first as
the smallest/lowest-risk, extending the existing tag system directly rather than introducing new
infrastructure (view-tracking, CSV parsing, a service worker) like B2–B4 would.

### What was built

- **Four new `ItemTag` values** (migration `20261005143025_add_dietary_tags_and_allergen_note`):
  `VEGAN`, `GLUTEN_FREE`, `CONTAINS_NUTS`, `CONTAINS_DAIRY`, using the glossary's exact locked
  Arabic terms. `src/common/tags.ts`'s three lookup maps (`TAG_VARIANT`/`TAG_I18N_KEY`/
  `ALL_TAGS`) are the single source every tag-rendering surface already read from (item cards,
  the detail sheet, admin checkboxes, and now the filter sheet) -- extending them was the whole
  change; no surface needed its own new tag-handling logic. `CONTAINS_NUTS`/`CONTAINS_DAIRY` get
  the existing `'warning'` badge variant (a caution, not a selling point like `VEGAN`/
  `VEGETARIAN`'s `'primary'`) -- which `item-detail-sheet.njk`'s hand-duplicated tag color map
  (noted in its own header comment as a client-side duplicate of `badge.njk`) was missing
  entirely before this, so `CONTAINS_NUTS`/`CONTAINS_DAIRY` would have rendered unstyled there.
- **Allergen note** (`Item.allergenNoteAr`/`allergenNoteEn`, same migration): optional free text
  for anything the fixed tags can't express (e.g. "fried in the same oil as shellfish"), editable
  in the admin item form next to description, shown on the public item detail sheet when set.
- **Filter sheet** (`views/components/menu-filter-sheet.njk`, new): a checkbox list of all 8
  tags, reusing `bottom-sheet.njk`'s open/close chrome. Deliberately plain checkboxes, not
  Alpine-bound -- same reasoning `public/js/menu.js`'s own header comment already gives for the
  search box (it runs over every item card; Alpine's reactivity overhead isn't worth it there).
  `menu.js`'s search handler became a combined `applyFilters()`: an item must match both the
  search text AND (if any tags are checked) at least one checked tag -- multi-select-within-the-
  filter is OR, composed with search via AND, the standard filter-UI convention. A small count
  badge on the filter button updates from the same pass. `MenuItemView` gained a plain
  `tagCodes` string (comma-joined `ItemTag`s) for the filter to read off each card's
  `data-tags` attribute, parallel to the existing `data-search-text`.

### Verified

- E2e: new `test/dietary-tags.e2e-spec.ts` -- the four new tags and an allergen note save
  through the real item PATCH endpoint and persist; the public menu reflects the tag badges, the
  `data-tags` attribute, and the allergen note text; all 8 tags appear as filter checkboxes. 45
  e2e tests total (72 unit, unchanged -- no new pure-function logic this phase).
- Interactive (Claude-in-Chrome): opened the filter sheet on the real public menu, checked "New"
  and confirmed the menu instantly narrowed to only new items across every category (chips for
  categories with no matches hid too); clicked "Clear filters" and confirmed the full menu
  returned; closed the sheet cleanly.
- `npx tsc --noEmit`, `npm run lint`, `npm run contrast:check`, and a full production build all
  pass. Migration applied to both the dev and test databases.

### Known gaps / follow-ups

- B2 (analytics), B3 (bulk tools), and B4 (share + PWA) remain unbuilt -- scoped (see above) but
  not started, each its own phase given the new infrastructure each needs.

## Phase 15: Pack B2 -- menu + item view analytics (done)

### What was built

- **`MenuView` table** (new model, new migration): one row per view event. A null `itemId` is a
  whole-menu page load (`GET /m/:slug`); a set `itemId` is an item detail sheet open. Both
  `Restaurant` and `Item` cascade-delete their `MenuView` rows, so a deleted item never leaves
  orphaned analytics rows for `AnalyticsService.topItems()` to filter out defensively.
- **`AnalyticsService`** (`src/admin/analytics.service.ts`): `recordMenuView`/`recordItemView`
  (the latter validates the itemId actually belongs to the given restaurant before writing,
  since its public endpoint is unauthenticated) and `getStats()` -- counts for the last 7/30
  days plus a top-5 most-viewed-items list per window via `groupBy`.
- **Owner exclusion**: neither a whole-menu view nor an item view is recorded when the viewer's
  admin session belongs to that exact restaurant (`req.session.restaurantId === restaurant.id`,
  the same `isPreviewOwner` check the branding live-preview already relied on) -- an owner
  browsing or testing their own menu doesn't inflate their own analytics. Caught as a real
  inconsistency during manual verification: the item-view beacon initially skipped this check
  entirely (only the whole-menu view had it), which would have let an owner's own item clicks
  skew "most viewed" even though their own page loads were correctly excluded. Fixed and covered
  by a dedicated e2e case.
- **Item-view beacon** (`GET /m/:slug/items/:itemId/view`, `MenuController`): deliberately GET,
  not POST -- `doubleCsrfProtection` (applied globally in `bootstrap.ts`) ignores GET/HEAD/
  OPTIONS by default, so a plain `fetch(..., { keepalive: true })` from
  `item-detail-sheet.njk`'s `open-item-sheet` handler needs no CSRF plumbing, same as any other
  page-view pixel/beacon. 204, no body, fire-and-forget (errors swallowed client-side).
- **`/admin/analytics` page** (new controller + `views/admin/analytics.njk`): two stat cards
  (menu views, last 7/30 days) and two "most viewed" lists, each with the item's bilingual name
  and a pluralized view count ("1 view" / "N views"). Added to the sidebar nav between
  Categories and QR & print, using the glossary's locked terms (`الإحصائيات`, `مشاهدات القائمة`,
  `الأكثر مشاهدة`).

### Verified

- E2e: new `test/analytics.e2e-spec.ts` (5 cases) -- anonymous menu loads and item-view beacons
  are recorded; an admin session viewing or opening an item on their own restaurant records
  nothing (both the whole-menu and the item-view case, the latter added after the bug above was
  found); a beacon for an item belonging to a different restaurant than the slug is silently
  ignored; the admin analytics page renders the recorded counts and the most-viewed item. 50 e2e
  tests total (72 unit, unchanged).
- Interactive (Claude-in-Chrome): opened an item on the real public menu (confirmed the beacon
  fires via direct `fetch` from the page's own JS console, since Chrome's `keepalive: true`
  requests don't surface correctly through the extension's network-request inspector --
  independently confirmed with `curl` that the endpoint itself returns a clean 204), then
  logged in as that restaurant's own admin and confirmed the view count held steady across a
  repeat visit/item-open, demonstrating the owner-exclusion fix.
- `npx tsc --noEmit`, `npm run lint`, `npm run contrast:check`, and a full production build all
  pass. Migration applied to both the dev and test databases.

### Known gaps / follow-ups

- B3 (bulk tools) and B4 (share + PWA) remain unbuilt -- scoped, not started.
- Analytics has no CSV export or date-range picker beyond the fixed 7/30-day windows; not
  requested, and B3's "bulk tools" scope is a separate, already-named place for export-style
  features if wanted later.
