# Front-end audit report

Audit only. No existing file was changed. This report is the single added file.

Audited state: branch `refactor/human-ui-and-production-prep` at HEAD, which already contains my earlier targeted fixes (commits cf42c40, c7e2622, 6c5208f, plus one screenshot housekeeping commit). Findings below are what remains after those fixes. The earlier, smaller `docs/frontend-audit.md` is untouched and is superseded by this report.

## 1. Executive summary

- The project is not a raw AI demo. It has a documented token system, a considered type pairing (Thmanyah plus Plex Arabic and Inter), logical RTL handling, per-restaurant theming, a designed admin, error pages, PWA and a prior AI-tells cleanup. Most of the brief's visual and copy tells are already absent.
- The weakest area is the admin on phones, and the second weakest is production readiness behind the front end.
- Five biggest problems:
  1. Admin pages break at 375px: `/admin/bulk` and `/admin/branding` scroll horizontally (419px and 430px wide), and the CSV import button is clipped off screen.
  2. Admin tap targets: 37 move up and move down buttons are 36px on the dashboard, and the bulk page has 64 controls under 44px.
  3. No server-side input validation layer. `class-validator` and `class-transformer` are installed but not used anywhere, and there is no `ValidationPipe`.
  4. The restaurant model has no address, phone, map link or structured hours, so "call", "directions" and a full JSON-LD `Restaurant` are impossible without schema work.
  5. Images are stored as uploaded (up to 5 MB), with no resizing, no modern formats and no `srcset`. The PWA manifest ships only an SVG icon, with no PNG icons or apple-touch-icon.
- AI-look score: **3 / 10** (1 is clearly hand designed). Justification: no gradients, glass, emoji, fake social proof or marketing filler remain. What still reads as generated is smaller: copy that uses `--` as a dash stand-in (7 strings per locale), one stock error sentence, a tidy but uniform admin card look, and the centered error pages.

## 2. Stack and baseline results

| Item | Finding |
| --- | --- |
| Framework | NestJS 10 on Express, TypeScript strict |
| Views | Nunjucks, configured directly on Express in `src/common/view/nunjucks.ts` (no Nest adapter), files in `views/` |
| CSS | Tailwind 3.4, tokens as `R G B` CSS variables in `src/styles/tokens.css`, compiled to `public/css/app.css` (gitignored build output, 50 KB) |
| Client JS | htmx 2, Alpine 3, SortableJS, all self-hosted in `public/js/vendor` via `scripts/copy-vendor-js.js`, plus 8 small scripts in `public/js` (575 lines) |
| Fonts | Thmanyah Sans and Serif Display (licensed), IBM Plex Sans Arabic, Inter variable, all self-hosted woff2 with `font-display: swap` |
| Icons | Hand written inline SVG, 7 sidebar icons as partials, no icon library |
| Data | Prisma 5 on PostgreSQL, 9 models, seed in `src/prisma-seed` |
| i18n | nestjs-i18n, `i18n/ar` and `i18n/en`, 276 keys each, no missing keys either way, Arabic default |
| Security | helmet with CSP (`unsafe-eval` for Alpine), CSRF (csrf-csrf), session in Postgres, login limiter, POST limiter, compression |
| Static | `useStaticAssets(public)` in `src/bootstrap.ts`, fonts cached one year |

Baseline at HEAD:

| Check | Result |
| --- | --- |
| `tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `jest` unit | 84 of 84 pass |
| `npm run test:e2e` | 66 of 66 pass (last full run, after the final code change) |
| Starts and serves | Yes, dev server on :3000 and a production build on :3100 were both exercised earlier |
| `npm audit --omit=dev` | Reports advisories (not triaged in this pass) |
| axe 4.x, WCAG 2 A, AA and 2.2 AA, 375px | See category E |
| Headless browser | Playwright is available. Screenshots saved outside the repo, see section 3 |

Screenshots (Arabic, 375, 768 and 1280px, full page) are in the session scratchpad at `/tmp/claude-1000/-home-hasan-Projects-qaemati/619544ad-a8d0-44b1-bc5c-1f35677e0a5b/scratchpad/audit-shots/`: `home`, `menu`, `404`, `login`, `admin-dash`, `admin-branding`, `admin-bulk`, each as `<name>-ar-<width>.png` (21 files). They were not added to the repository because this audit may only add one file. Earlier committed screenshots exist in `docs/ux/screenshots/`.

## 3. Route and view inventory

Public and system routes

| URL | Controller method | View | Data passed |
| --- | --- | --- | --- |
| `GET /` | `HomeController.index` (`src/home/home.controller.ts:23`) | `pages/home` | `restaurants[]`, `demoMode`, `demoAdminPassword`, `demoResetSucceeded`, `seo` |
| `GET /offline` | `HomeController.offline` (`:17`) | `pages/offline` | none |
| `GET /m/:slug` | `MenuController.show` (`src/menu/menu.controller.ts:17`) | `pages/menu` | `menu`, `seo`, `tableLabel`, `embed`, `labels` (menu view model from `MenuService.getMenu`) |
| `GET /m/:slug/items/:itemId/view` | `MenuController` (`:96`) | none (204 beacon) | none |
| `GET /m/:slug/manifest.webmanifest` | `MenuController` (`:120`) | none (JSON) | name, icon, theme color |
| `GET /lang/:code` | `LocaleController` | redirect | cookie `qaemati_locale` |
| `POST /demo/reset` | `DemoController` | redirect | reseeds, demo mode only |
| `GET /styleguide` | `StyleguideController` | `pages/styleguide` | none |
| `GET /robots.txt`, `/sitemap.xml`, `/health` | `SeoController` | none | text, XML, JSON |
| 404 and 500 | `HttpExceptionFilter` | `pages/errors/404`, `500` | status, locale |

Admin routes (all behind `AdminAuthMiddleware`, except login)

| URL | Controller | View |
| --- | --- | --- |
| `GET/POST /admin/login`, `POST /admin/logout` | `AuthController` | `admin/login` |
| `GET /admin` | `DashboardController` | `admin/dashboard` (includes `components/categories-list`) |
| `POST/PATCH/DELETE /admin/categories...`, `reorder`, `:id/move` | `CategoriesController` | partials `categories-list`, `category` |
| `POST/PATCH/DELETE /admin/items...`, `availability`, `image`, `move`, `reorder` | `ItemsController` | partials `category`, `item` |
| `GET/PATCH /admin/branding`, `POST logo, cover, background` | `BrandingController` | `admin/branding`, partials `branding-form`, `branding-images`, `branding-preview` |
| `GET /admin/qr`, `GET /admin/qr/print`, table CRUD | `QrController` | `admin/qr`, `admin/qr-print`, partials `tables-list`, `table-row` |
| `GET/POST /admin/bulk...` (duplicate, price-change, import, undo, `export.csv`) | `BulkController` | `admin/bulk` |
| `GET /admin/analytics` | `AnalyticsController` | `admin/analytics` |
| `POST /admin/tour/dismiss` | `TourController` | none |

Other front-end assets

| Kind | Inventory |
| --- | --- |
| Layouts | `base`, `menu`, `admin`, `print` |
| Shared components | 23 macros in `views/components` (button, input, select, textarea, toggle, badge, card, modal, bottom-sheet, toast, skeleton, empty-state, confirm-dialog, menu-item-card, item-detail-sheet, selection-bar, restaurant-header, category-chip, filter sheet, and others) |
| Admin components | 9 in `views/admin/components`, 7 sidebar icons |
| Stylesheets | `src/styles/app.css`, `tokens.css`, `fonts.css` |
| Client scripts | `menu.js`, `selection.js`, `whatsapp-message.js`, `pwa.js`, `open-status.js`, `color-contrast.js`, `sortable-admin.js`, `scroll-restore.js`, `sw.js` |
| Images | `public/favicon.svg`, `public/uploads/seed` (generated SVG placeholders for 51 items, 2 logos), `public/uploads/restaurants` (runtime uploads, gitignored) |
| Largest templates | `item-detail-sheet.njk` 229, `item-row.njk` 215, `branding-form.njk` 277, `layouts/admin.njk` 169, `selection-bar.njk` 169 lines |

## 4. Findings

Severity: High, Medium, Low. "Fix" is a recommendation only.

### A. AI-design fingerprints (visual)

| ID | Sev | Location | Evidence | Fix |
| --- | --- | --- | --- | --- |
| A1 | Low | `views/pages/menu.njk:68`, `views/admin/partials/branding-form.njk:273` | `sticky ... bg-bg/95 backdrop-blur` | Legitimate use over scrolling content. Keep, or drop blur since the bar is already 95% opaque |
| A2 | Low | `views/components/button.njk:9` | `active:scale-[0.97]`, `transition-all` | Press feedback is acceptable. Replace `transition-all` with the specific properties |
| A3 | Low | `views/components/skeleton.njk:6,11,13` | `animate-pulse` | Functional loading cue, already covered by the reduced-motion rule in `tokens.css:90` |
| A4 | Low | `src/styles/app.css:86,91,96` | `radial-gradient`, `linear-gradient`, `repeating-linear-gradient` | These are admin-selectable background patterns, not decoration. No action |
| A5 | Medium | `views/pages/errors/404.njk:6`, `500.njk:6`, `offline.njk:6` | `rounded-xl ... p-8 text-center shadow-sm` | Three identical centered card pages. `rounded-xl` and `shadow-sm` are stock Tailwind values that bypass the radius and shadow tokens. Use tokens, align to reading direction, give each state its own content |
| A6 | Low | `views/pages/home.njk:4,32`, `views/admin/login.njk:9` | `rounded-xl ... shadow-sm` / `shadow-raised` | Same token bypass. Admin and home look like one card template repeated |
| A7 | Low | `src/common/tags.ts:10-33`, `views/components/menu-item-card.njk` | `NEW`, `POPULAR` tags | These are owner-assigned dietary or highlight tags, not automatic badges. Acceptable. Consider hiding NEW after N days so it carries information |
| A8 | Low | Admin shell (`layouts/admin.njk`) | Same sidebar plus card list on every admin screen | Expected for CRUD. Analytics and QR already differ by task. No action |
| A9 | Low | `public/uploads/seed/items/*.svg` | Generated gradient placeholders | Honest placeholders, clearly not photos. Replace with real photography per tenant when available |
| A10 | n/a | whole `views/`, `src/styles` | No purple gradients, gradient text, blobs, glow shadows, emoji, dark mode toggle, landing template, stats, testimonials found | Verified by grep. No action |

### B. AI-design fingerprints (copy)

| ID | Sev | Location | Evidence | Fix |
| --- | --- | --- | --- | --- |
| B1 | Medium | `i18n/en/common.json:11,141,256,257,315,319,321` and the same lines in `i18n/ar/common.json` | `"... credentials below -- no account needed."`, `"Optional -- for anything ..."` | A double hyphen used as a dash stand-in, in 7 strings per locale and visible in the UI (screenshot `home-ar-375`). Rewrite as two sentences or a colon |
| B2 | Low | `i18n/en/common.json` `errors.serverErrorBody` | `"Sorry for the inconvenience, we are working on fixing it."` | Stock apology line. Say what the visitor can do (retry, call the venue) |
| B3 | Low | `i18n/en/common.json` `errors.notFoundBody` | `"Sorry, the page you are looking for does not exist."` | Stock phrasing. Point to the menu |
| B4 | Low | `src/prisma-seed/seed-data.ts:55,354,61,361` | `+970599000111`, `admin@baytalzaytoun.example.com` | Fictional data on reserved domains and obviously fake numbers. Acceptable for a demo, but keep out of production seeds |
| B5 | Low | `i18n/ar/common.json` (home, admin tour) | `قائمتا طعام نموذجيتان، لتوضيح شكل قائمة مطعمك الخاصة على قائمتي.` | Reads as translated from English ("built to show what ... looks like"). Needs a native review pass over the home and tour strings. The rest of the Arabic sampled reads naturally |
| B6 | n/a | `views/`, `i18n/` | No "Elevate", "Seamless", "Unlock", "Welcome to", lorem ipsum, fake stats or testimonials, no em or en dashes in `views`, `i18n`, `src` | Verified by grep |

### C. AI-design fingerprints (code)

| ID | Sev | Location | Evidence | Fix |
| --- | --- | --- | --- | --- |
| C1 | Low | `views/layouts/menu.njk:95` | `style="background-image: url('{{ menu.backgroundImageUrl }}'); ..."` | Only inline style in the app. Move to a CSS custom property set on the body |
| C2 | Low | `views/partials/head.njk:38` | `[x-cloak] { display: none !important; }` | Standard Alpine idiom. Keep. The other `!important` uses are the reduced-motion reset (`tokens.css:94-97`) and are justified |
| C3 | Medium | `views/admin/components/item-row.njk:111,123`, `category-block.njk:35,47`, `options-editor.njk:64` | `inline-flex h-9 w-9 ... rounded-full` repeated | The same 36px icon button written five times by hand, and it is the cause of the tap target failures (D5). Use the existing `icon-button` macro with a 44px size |
| C4 | Low | `views/admin/partials/branding-form.njk` (277 lines), `item-detail-sheet.njk` (229), `item-row.njk` (215) | Long templates with repeated field blocks | Extract per-section partials and loop over a field list |
| C5 | Low | `views/components/item-detail-sheet.njk:93`, `bottom-sheet.njk:31`, `modal.njk:30`, `selection-bar.njk:81`, `admin/partials/branding-preview.njk:23-26` | Magic sizes: `h-[85vh]` x4, `w-[3px]` x3, `w-[360px]`, `h-[760px]` | Name them as tokens or utilities |
| C6 | Low | `public/js/menu.js:10`, `public/js/whatsapp-message.js` | "Mirrors src/common/text/normalize-search-text.ts. Keep both in sync." | Two implementations kept in sync by hand. Add a test that runs both against the same cases |
| C7 | Low | `src/styles/app.css` | 0 `focus-visible` rules, focus styling is repeated per element as utility classes | Add one global `:focus-visible` rule so a new element cannot forget it |
| C8 | Low | `package.json` | `class-validator`, `class-transformer` installed, unused in `src` | Use them (see H2) or remove them |
| C9 | n/a | `views/` | 0 section-label HTML comments, `lang` and `dir` present on all layouts, `<html lang dir>` verified | No action |

### D. UX problems

| ID | Sev | Location | Evidence | Fix |
| --- | --- | --- | --- | --- |
| D1 | High | `views/admin/bulk.njk:58` | Import form `flex items-center gap-2` is 389px wide inside a 375px viewport, so the "Import CSV" button is cut off (see `admin-bulk-ar-375.png`). Page width 419px | Stack the file input and button on small screens, `flex-wrap` |
| D2 | High | `views/admin/partials/branding-images.njk:14,37,69` | Page scrolls horizontally at 375px (container 430px). Offenders: file inputs and a `flex items-center gap-3` row | Allow wrap, `min-w-0`, constrain the native file input width |
| D3 | Medium | `views/admin/bulk.njk:82-107` | 5 column table on a phone: names wrap to 3 lines, price and "ILS" wrap, duplicate button crowded | Switch to a card list under `sm`, or hide the category column on mobile |
| D4 | Medium | `views/admin/login.njk:25-31` | Plain form post, submit button has no pending or disabled state, no inline field validation | Add `hx-disabled-elt` or a small submit handler for a pending state, keep `required` messages accessible |
| D5 | High | `views/admin/components/item-row.njk:109-124`, `category-block.njk:35,47`, `options-editor.njk:64` | 37 "Move up" and "Move down" buttons measured 36x36 at 375px on the dashboard | Raise to 44px (see C3) |
| D6 | Medium | `views/pages/errors/404.njk:12`, `500.njk:12` | Home link is `px-4 py-2 text-sm`, about 36px high, hand styled instead of `button` macro | Use the `button` macro at the 44px size |
| D7 | Medium | `views/layouts/admin.njk:114` | Mobile header brand link is 73x28 | Add padding so the target is 44px high |
| D8 | Medium | `prisma/schema.prisma` (Restaurant fields) | Contact data is only `whatsapp`, `instagramHandle`, free-text hours. No address, phone, map URL | Add `address`, `phone`, `mapUrl` (or lat and lng). The menu header then gets Call and Directions actions, the brief's "one tap away" |
| D9 | Medium | `grep hx-indicator` returns nothing | htmx saves in admin give no in-flight feedback beyond the toast after completion | Add `hx-indicator` or `hx-disabled-elt` on buttons that write |
| D10 | Low | `views/admin/qr-print.njk:18,26` | Print page starts at `<h2>`, no `<h1>` | Promote to `h1` |
| D11 | Low | `views/pages/home.njk:38-50` | Demo credentials shown on a public page when `DEMO_MODE` is on | Intended for the demo. Ensure `DEMO_MODE` is off in production (it is gated, but add a startup warning when `NODE_ENV=production` and demo mode is on) |
| D12 | n/a | public menu | Sticky search and category chips, scroll position restore, filter sheet, dietary tags, price per item with variants, WhatsApp selection list, empty state, offline page, designed 404 and 500, 0 controls under 44px at 375px, no horizontal scroll | Strengths. No action |

### E. Accessibility

axe (wcag2a, wcag2aa, wcag22aa) at 375px on 15 page and locale combinations. 13 had zero violations.

| ID | Sev | Location | Evidence | Fix |
| --- | --- | --- | --- | --- |
| E1 | High | `views/admin/bulk.njk:59,82,101` | axe `label`, 31 nodes: `<input type="file" name="file">` and the per-row `<input type="checkbox" name="itemIds">` have no accessible name | Add `aria-label` (row checkbox: item name) and a `<label>` for the file input |
| E2 | Medium | `views/pages/errors/404.njk:7` | axe `color-contrast` 4.09:1: `text-secondary` (#c4622d) on white, 14px | Use a darker secondary text token for small text (`--color-secondary-text`) |
| E3 | Medium | `views/layouts/base.njk`, `admin.njk`, `print.njk` | Skip link exists only in `layouts/menu.njk`. No skip link on base or admin | Add "Skip to content" to the other layouts |
| E4 | Low | `views/layouts/*` | 0 `<footer>` landmarks. `menu.njk` and `print.njk` layouts have no `<main>` of their own (the menu page template supplies `<main>`) | Add landmarks where missing, or document the split |
| E5 | Low | `restaurant-header.njk:12,23`, `menu-item-card.njk:36`, `item-detail-sheet.njk:115` | All images use `alt=""` | Correct for item images beside their name. For the logo, use the restaurant name as alt if it is not repeated in adjacent text |
| E6 | Low | `grep aria-live/role=status` | 3 live regions | Check that filter result counts and "added to selection" are announced |
| E7 | n/a | menu, home, login, admin in both locales | Heading order H1 then H2, no violations, focus visible, `aria-expanded` and `aria-controls` on the admin nav button | Strengths |

### F. RTL and i18n

| ID | Sev | Location | Evidence | Fix |
| --- | --- | --- | --- | --- |
| F1 | Medium | `views/pages/home.njk:44-49` | `<p dir="ltr">` wraps both the Arabic label and the Latin value, so the label and colon render in the wrong order (screenshot `home-ar-375.png`: ":البريد الإلكتروني" and "كلمة المرور :Qaemati@Demo123") | Keep the paragraph in the page direction and put `dir="ltr"` only on the `<span>` value |
| F2 | Low | `views/admin/partials/branding-preview.njk` | `left-[2px]`, `right-[2px]`, `left-1/2` physical offsets | Switch to `start` and `end` utilities if mirrored behavior is wanted. Verify in RTL |
| F3 | Low | `views/admin/analytics.njk:13-59`, `bulk.njk:104-107` | Many scattered `dir="ltr"` for numbers and English names | Introduce one `bidi` macro or `<bdi>`, and wrap prices consistently |
| F4 | Low | `i18n` | Only `ar` and `en`, locale list in `src/common/middleware/locale-view.middleware.ts:6` | Adding a language needs a code change plus a new JSON. Fine for now |
| F5 | n/a | `src/styles`, `views` | No physical `margin-left`, `padding-right`, `text-align:left`, `float` in CSS or JS. Templates use `text-start`. Strings are fully externalized, 276 keys in sync | Strengths |

### G. Performance and SEO

| ID | Sev | Location | Evidence | Fix |
| --- | --- | --- | --- | --- |
| G1 | High | `src/admin/upload.config.ts:8`, no `sharp` in `package.json` | Uploads are stored as sent, up to 5 MB, no resize, no WebP or AVIF | Add a resize and re-encode step on upload and generate 2 or 3 widths |
| G2 | Medium | `views/components/menu-item-card.njk:34-37`, `restaurant-header.njk:10-23` | `<img>` has `width`, `height` and `loading="lazy"` on cards, but no `srcset` or `sizes`. The header logo and cover are not lazy, which is correct above the fold | Add `srcset` once G1 exists. Add `fetchpriority="high"` to the cover |
| G3 | Medium | `src/menu/menu.controller.ts:132-147`, `public/favicon.svg` | Manifest has one icon, an SVG, or the restaurant's own `sizes: 'any'` upload. No 192 and 512 PNG, no `apple-touch-icon`, favicon is SVG only | Generate PNG icon sizes (G1 pipeline) and add `apple-touch-icon` |
| G4 | Medium | `views/partials/head.njk:14-24` | 5 font preloads (Inter plus four Thmanyah faces) on every page, about 370 KB of woff2 | Preload only the 2 or 3 faces used above the fold per locale |
| G5 | Low | `public/css/app.css` | 50 KB minified, single file, includes admin and print rules | Acceptable. Consider splitting admin CSS from the public bundle |
| G6 | Low | `src/bootstrap.ts` static options | `app.css` and scripts are served with a 1 hour cache and no content hash | Add hashed filenames or a version query so CSS can be cached long |
| G7 | Medium | `views/pages/offline.njk`, `views/layouts/base.njk` | Canonical and Open Graph exist on home and menu only. Error pages and offline page have none (fine) but `og:image` is absent on home | Add a default share image |
| G8 | Low | `src/seo/seo.ts` | JSON-LD has name, description, image, telephone (from WhatsApp), hasMenu, sameAs. No `address`, `openingHoursSpecification`, `servesCuisine`, `priceRange` | Needs D8 data |
| G9 | Low | `/m/:slug` | No `hreflang` alternates for ar and en because the locale is a cookie or query parameter, not a separate URL | Decide whether language gets its own URL (see section 9) |
| G10 | n/a | `public/js`, `package.json` | No duplicated libraries, 575 lines of own JS, vendor JS 153 KB total, no unused vendor files | Strength |

### H. Conversion readiness

| ID | Sev | Location | Evidence | Fix |
| --- | --- | --- | --- | --- |
| H1 | n/a | `prisma/schema.prisma`, `src/menu/menu.service.ts` | Restaurant, Category, Item, ItemVariant, ItemAddon, RestaurantTable, AdminUser, MenuView, BulkOperationLog exist and are tenant scoped. Menu view model is built in one service. Content is not hardcoded in templates | Strong seam. No action |
| H2 | High | `grep ValidationPipe, class-validator` returns nothing in `src` | Controllers take untyped `@Body('field') value: string` parameters (for example `src/admin/branding.controller.ts:43-60`, 15+ fields) and validate by hand in services | Introduce DTOs with `class-validator` and a global `ValidationPipe` |
| H3 | High | `src/bootstrap.ts:117`, `src/auth/csrf.ts:12` | `process.env.SESSION_SECRET ?? 'change-me-in-production'`, same for `CSRF_SECRET` | Fail startup in production when either is unset or still the default |
| H4 | Medium | `src/app.module.ts` | `ConfigModule.forRoot({ isGlobal: true })` with no schema. `process.env` is read directly in 8+ files | Validate env once at startup and inject typed config |
| H5 | Medium | `src/menu/menu.service.ts` | Tenant resolved by `/m/:slug` only. No domain or subdomain resolution | Add host based tenant lookup for custom domains (roadmap step 5) |
| H6 | Medium | `src/menu/menu.service.ts:140+`, `src/styles/tokens.css` | Theme is limited to presets: 2 font themes, corner style, a few enums, 2 colors, background. No arbitrary font or full palette | Enough for self serve. A per-tenant design token JSON would allow agency level control |
| H7 | Medium | `src/auth/login-rate-limiter.ts`, `src/common/middleware/rate-limit.ts` | In memory, per process | Shared store (Redis or Postgres) before running more than one instance |
| H8 | Medium | `public/uploads` | Uploads written to local disk | Move to object storage before horizontal scaling |
| H9 | Low | `src/seo/seo.controller.ts:41` | `/health` checks the database only | Add a readiness distinction if deployed on an orchestrator |
| H10 | Low | `src/admin/analytics.service.ts` | Menu and item views only, no event for selection sent or WhatsApp opened | Add events before choosing a third party tool |
| H11 | n/a | `bootstrap.ts`, `http-exception.filter.ts`, `common/logging` | helmet, CSRF, compression, exception filter with designed pages, JSON logger, access log, POST rate limit, `TRUST_PROXY` | Already in place |

## 5. Top 10 quick wins

| # | Win | Effort | Findings |
| --- | --- | --- | --- |
| 1 | Fix horizontal overflow on `/admin/bulk` and `/admin/branding` at 375px | S | D1, D2 |
| 2 | Label the bulk page checkboxes and file input | S | E1 |
| 3 | Replace the five hand rolled 36px icon buttons with the `icon-button` macro at 44px | S | C3, D5 |
| 4 | Rewrite the 7 `--` strings per locale | S | B1 |
| 5 | Fix the home page credential block bidi | S | F1 |
| 6 | Use the `button` macro and a darker secondary for the 404 and 500 pages | S | A5, D6, E2 |
| 7 | Refuse to start in production with default secrets | S | H3 |
| 8 | Add skip links to the base and admin layouts | S | E3 |
| 9 | Add one global `:focus-visible` rule | S | C7 |
| 10 | Preload only the above the fold font faces | S | G4 |

## 6. Proposed design direction

Because the current identity is already coherent (olive and warm cream, Thmanyah), these are directions for evolving it, not replacements.

| Option | Palette logic | Fonts | Layout character |
| --- | --- | --- | --- |
| 1. Keep and tighten (Zaytoun) | Olive primary, terracotta used only for one accent (offers, specials), warm neutrals. Fix the small text contrast of the accent | Thmanyah Serif Display for names and headings, Thmanyah Sans for body, Inter for numerals | Menu first, start aligned, one card style. Error and home pages lose the centered card |
| 2. Printed menu | Near black text on paper cream, a single deep brand color used for rules and prices, no tinted chips | A serif display for category titles, a quiet sans for dish text | Dense typographic list with leaders between name and price, photos optional and small, strong category headings. Suits cafes with short menus |
| 3. Photo led | Neutral surfaces so photography carries the color, brand color only on actions | Thmanyah Sans throughout, bold weight for dish names | Large image cards, two columns on phones, hero cover image. Needs real photography and the G1 image pipeline |

Recommendation: Option 1 now. It is already built, passes contrast checks, and the remaining work is removing token bypasses and the centered error pages. Offer Option 2 as a selectable `cardStyle` and Option 3 only after the image pipeline exists, because without real photos it would expose the placeholders.

## 7. Proposed target architecture

Most of this exists. Gaps are marked new.

```
src/
  config/            new: typed env schema, one place for process.env
  tenants/           new: TenantResolver (slug now, host later), RestaurantService
  menu/              existing: MenuService builds the view model
  content/           new: view-model builders and format helpers (price, hours, open now)
  admin/             existing controllers, add dto/ for class-validator
  media/             new: upload, resize, format conversion, storage driver interface
  seo/               existing, extend with address and hours
  common/            existing: middleware, logging, filters, rate limit (store interface new)
views/               existing, split long templates into partials
i18n/                existing ar and en, add a lint script comparing key sets
prisma/              add address, phone, mapUrl, structured hours, themeTokens Json
```

- Content model: keep Prisma as the single source. Add `address`, `phone`, `mapUrl`, `hoursJson` to `Restaurant`, and `themeTokens Json?` for per-tenant overrides.
- i18n: keep nestjs-i18n JSON for UI strings. Keep restaurant content as `nameAr` and `nameEn` columns, and decide before a third language whether to move to a translations table.
- Theming: keep CSS variables injected in `layouts/menu.njk`. Validate all values server side (the contrast check in `src/common/color.ts` is the model). Extend the same injection to the admin shell if tenants want branded admin.
- Seams: storage driver, rate limit store and tenant resolver as interfaces so each can be swapped without touching controllers.

## 8. Proposed execution plan

| Phase | Scope | Files likely to change | Effort | Risks and what could break |
| --- | --- | --- | --- | --- |
| 1. Mobile admin fixes | D1 to D3, D5 to D7, C3, E1, E3 | `views/admin/bulk.njk`, `admin/partials/branding-images.njk`, `admin/components/*`, `layouts/admin.njk`, `layouts/base.njk` | S | Layout regressions on desktop tables. e2e tests assert some strings and markup, rerun them. Sortable handles depend on button markup |
| 2. Copy and error states | B1 to B5, A5, E2, F1 | `i18n/*.json`, `pages/errors/*`, `pages/home.njk` | S | e2e specs assert some English strings (the guided tour one already did). Update tests with the copy. Arabic needs a native read |
| 3. Validation and config | H2, H3, H4, C8 | new `config/`, `dto/`, controllers, `bootstrap.ts` | M | Stricter validation can reject input that currently passes. Preserve inline htmx error rendering. Add tests per controller before switching |
| 4. Contact data | D8, G8 | `schema.prisma` and a migration, `menu.service.ts`, `restaurant-header.njk`, `seo.ts`, `branding-form.njk` | M | Migration on existing rows (all nullable, low risk). Branding form grows, check mobile layout |
| 5. Image pipeline | G1 to G3 | new `media/`, `upload.config.ts`, item and branding controllers, `menu-item-card.njk`, manifest | M to L | Adds a native dependency (`sharp`). Existing uploaded files must keep working, so keep the original path as a fallback |
| 6. Performance polish | G4 to G7, C7 | `partials/head.njk`, `bootstrap.ts`, `src/styles/app.css` | S | Asset hashing needs a build step change |
| 7. Multi-instance readiness | H5, H7, H8 | rate limiters, upload storage, tenant resolver | L | Needs infrastructure decisions (Redis, object storage) |
| 8. Design option work | Section 6 option choice | `tokens.css`, card macros, `menu-item-card.njk` | M | Per-tenant theme options already ship, new card styles need contrast checks in `color.ts` |

Each phase should be its own commit set, verified with `tsc`, lint, unit, e2e and the axe script before moving on.

## 9. Decisions needed from the owner

1. Scope of Phase 1: fix admin mobile now, or treat admin as desktop only for the demo? Recommended default: fix it, the staff phone is the most likely admin device.
2. Add address, phone and map link to the restaurant model? Recommended default: yes, nullable fields, shown only when set.
3. Does each language need its own URL (for example `/ar/m/slug`) for SEO? Recommended default: no for now, keep the cookie and query parameter, revisit when you have organic traffic goals.
4. Which design option from section 6? Recommended default: Option 1.
5. Image storage target for production (local disk, S3 compatible, other)? Recommended default: S3 compatible behind a driver interface, local disk for development.
6. Should production refuse to boot with default secrets or demo mode on? Recommended default: refuse on default secrets, warn on demo mode.
7. Keep `class-validator` as the validation approach? Recommended default: yes, it is already installed and Nest native.
8. Who reviews the Arabic copy? Recommended default: a native speaker review of the home page, tour and error strings before launch.
9. Is the hidden `/styleguide` route allowed in production? Recommended default: gate it behind admin auth or disable it when `NODE_ENV=production`.
10. Are the demo credentials on the public home page acceptable for any public deployment? Recommended default: no, require `DEMO_MODE=false` outside a clearly labeled demo host.
