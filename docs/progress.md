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
