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
