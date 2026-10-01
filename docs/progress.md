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
