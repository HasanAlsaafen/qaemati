# Qaemati: project overview

This file is a full description of the project, written so it can be pasted into another chat or handed to a new developer as context. It was compiled on 2026-10-12 from the code, `README.md` and the files in `docs/`. The detailed history is in `docs/progress.md` (phases 0 to 17), `docs/implementation-log.md` (everything after) and `docs/decisions.md` (65 numbered decisions).

## What it is

Qaemati is a multi-tenant SaaS for digital restaurant and cafe menus, aimed at businesses in Palestine. A restaurant gets a public menu page at `/m/<slug>`, reached by QR code. The page is Arabic first (right to left) with English as a second language. The owner manages the menu and branding in an admin area. Guests who open the menu from a table's QR code can send their order to a live staff screen, call the waiter and ask for the bill. Guests who open it any other way send their selection as a WhatsApp message. The platform operator (the person who runs the business) manages restaurants, plans and payments in a separate area at `/super`.

Roles in the system:

- Guest: reads the menu, filters by dietary tag, picks dishes, sends an order, follows its status live.
- Owner: full admin for one restaurant.
- Cashier and kitchen staff: limited accounts that only see the orders screen.
- Platform operator: runs all restaurants, plans, payments and ready-made themes.

## Tech stack

- NestJS 10 with Express, TypeScript in strict mode, server-rendered MVC.
- Nunjucks templates in `views/`, Tailwind CSS, htmx and Alpine.js for interactivity, SortableJS for drag ordering.
- PostgreSQL with Prisma 5. Sessions (connect-pg-simple), rate limit counters and realtime events between instances (LISTEN / NOTIFY) all live in Postgres, so no Redis is needed.
- Socket.IO for the live staff screen and live order tracking, sharing the normal login session.
- nestjs-i18n for Arabic and English. Arabic is the default.
- nodemailer through Gmail SMTP for mail. csrf-csrf, helmet with a CSP, bcrypt, class-validator with a strict global ValidationPipe, multer for uploads, the qrcode library.
- Tests: Jest unit tests next to the code (318 at last count) and Supertest end-to-end tests in `test/` (543 at last count, against a separate `qaemati_test` database), plus axe-core accessibility checks.
- Deployment: Dockerfile, `docker-compose.prod.yml` with Caddy for automatic HTTPS, backup and restore scripts, GitHub Actions CI in `.github/workflows/ci.yml`.

Code layout: `src/` has one module per area (`admin`, `auth`, `menu`, `pos`, `super-admin`, `tenancy`, `signup`, `billing-notices`, `reports`, `suggestions`, `mail`, `home`, `seo`, `team`, `provisioning`, `prisma-seed`, `common`, `config`). `views/` holds templates, `i18n/` the translations, `prisma/` the schema and 37 migrations, `public/` static files, fonts and demo photos, `docs/` the written record, `scripts/` the operator tools.

## Data model (Prisma)

Everything a restaurant owns carries its `restaurantId`. The main models are Restaurant (branding, contact, location check settings), AdminUser (with a role of owner, cashier or kitchen), Menu (with serving hours), Category, Item with ItemVariant and ItemAddon, RestaurantTable (QR key, occupancy), Order and OrderItem, WaiterCall, MenuView (analytics), BulkOperationLog, ItemPairing and SuggestionAdd (suggestions), Plan, Subscription, Payment, SuperAdmin, AuditLog, PasswordResetToken, RateLimitBucket, NotificationLog, SignupRequest and BrandTheme.

## What is done

Everything below is built and covered by tests unless the "unverified" list further down says otherwise.

### Public menu

- Bilingual menu page with language switcher, search, sticky category bar with an All chip and category pictures, dish cards, a detail sheet, dietary tags with a filter, allergen notes, dish sizes (variants) and extras (add-ons), specials, and an open/closed status.
- Several menus per restaurant with serving hours (for example Breakfast and All day). A menu outside its hours is closed everywhere: marked on its tab, dishes shown unavailable, table orders for them refused by the server, and never suggested.
- Contact details, address, tagline, phone, Facebook, map link, share tags, SEO metadata, sitemap, robots, JSON-LD, PWA manifest, service worker and an offline page.
- "My selection" list that builds a WhatsApp message. Outside a table, the guest must give name, phone and location, which are remembered only in their own browser.
- Dish suggestions in layers: owner-chosen pairings, dishes often ordered together in real table orders, then popular dishes from sections the guest has not picked from.

### Branding and look

- Wide set of choices stored per restaurant and validated against fixed lists: colors with contrast checks, 7 typefaces (Tajawal and IBM Plex Sans Arabic plus Cairo, Almarai, Noto Naskh, Playfair with Amiri, all self-hosted open fonts), corners, card style and layout, photo shape, category marker, logo shape, cover height, price style, heading alignment, dividers, page background colors, patterns and photos, and a live preview in a shared iPhone frame.
- Browser-side image editor (move, zoom, rotate, crop) before every upload.
- Ready-made themes (Classic, Ramadan, Eid Al-Fitr, Eid Al-Adha, Olive harvest, Summer, Winter, Evening) with SVG decoration bands. Themes are database rows the operator edits at `/super/themes`. A theme only fills the owner's form.

### Owner admin

- Dashboard, categories, dishes (drag ordering, duplicate, per-dish photo removal), menus, tables and QR codes (single and print sheets), branding, analytics (7 and 30 day views, top dishes, owner views excluded), reports, bulk tools (CSV import and export, percent price changes, with an undo log), team page, billing page, and a first-login guided tour.
- Admin works on a phone: 44px touch targets, skip links, zero axe violations at 375px.

### Table ordering and the POS

- QR codes carry a random table key. A guest from a table sends an order, calls the waiter, sees "My bill" and can ask for the bill. Orders are priced on the server from the database and store their own copy of names and prices.
- Optional location check (guest phone against the restaurant position and a radius).
- Live staff board at `/admin/pos` over Socket.IO: New, Preparing, Ready, served list, waiter calls with a repeating alarm, sound toggle, tab-title counter, reconnect handling, and a Tables section with free, occupied and bill requested plus a Check out button.
- Guests follow their order live with a four step progress bar.
- Roles: owner, cashier (orders screen, sees prices) and kitchen (no prices, no waiter calls, no cancel). Staff are denied every other admin page by default.
- Reports for owners: orders, revenue, average order, busiest hours and tables, top dishes, waiter call response time, and a CSV download that defuses formula injection. These cover table orders only, because WhatsApp orders never reach the restaurant.

### SaaS and platform

- Self sign up at `/signup` with email confirmation, honeypot, minimum fill time and rate limits. Creates the restaurant, first menu, trial subscription and owner.
- Plans with price, billing period, limits and feature flags. Subscriptions with trial, active, grace and blocked states. When a subscription ends, the public menu goes offline after the grace period and the admin turns read only. Nothing is ever deleted.
- Manual payment ledger with receipts and voiding. Hourly renewal reminders and receipt emails, claimed in the database so there are no duplicates across servers.
- Platform area at `/super`: overview with revenue figures, restaurants, plans, payments, themes, reports, activity log. Operator security: TOTP authenticator app (required in production), recovery codes, password reset that never bypasses the authenticator, optional IP allowlist.
- Tenant isolation test suite proving one restaurant cannot read or change another's records.

### Security and operations

- Validated environment at startup, with production refusing weak secrets. CSRF on every write, helmet and CSP, login and write rate limits stored in Postgres, password reset with hashed single use links, JSON logging with an access log, `/health` endpoint, "remember me" on staff sign in.
- Demo mode: two fictional bilingual businesses (Bayt Al-Zaytoun, a cafe in ILS, and Al-Sanabel, a restaurant in JOD) seeded with real freely licensed photos from Wikimedia Commons (credits in `public/demo-photos/CREDITS.md`), drawn logos, three weeks of fake orders and views, and live tables. The landing page has a live iPhone demo and a four-tab tour of the whole system, shown only when `DEMO_MODE` is on.

## Current state of the repository

Branch: `refactor/human-ui-and-production-prep`. The last commit is `d1a22fe` (branding image editor and many menu look options). The following work is staged in git but not yet committed (153 files, about 5,100 lines added): table occupancy, bill request and checkout (migration `20261020000000_table_occupancy`), ready-made themes and decorations (migrations `20261021000000_theme_decor` and `20261022000000_brand_themes`), four new typefaces, the demo photos and richer demo data, the landing page tour, "remember me", and the dirty-form guard and password toggle scripts. Also new and untracked: `.agents/skills/caveman` and a symlink `.claude/skills/caveman` for the caveman terse-reply skill.

Last recorded verification (before the final staged changes): lint and type-check clean, 318 unit and 543 e2e tests passing.

## What is left

### Must do before a real launch

1. Commit the staged work, rerun the full suite (`npm run lint`, `npx tsc`, `npm test`, `npm run test:e2e`), and merge the branch to `main`.
2. Build and run the Docker image on a real server. It has never been built or run in the environment where it was written, and the Caddy certificate step is untested. The CI workflow has also never run on GitHub.
3. Go through the deployment checklist in `docs/deployment.md`: DNS, working Gmail app password, first backup, a rehearsed restore, backups copied off the server, landing page contact set, signup open or closed, first operator created with two step verification.
4. Have a native Arabic speaker review all Arabic copy (decision 9).
5. Confirm the Thmanyah web license for the landing page fonts before setting `THMANYAH_WEB_LICENSED=true`. The license forbids hosting the files for download unless thmanyah grants it.
6. Production environment: strong `SESSION_SECRET` and `CSRF_SECRET`, `PUBLIC_BASE_URL`, `DEMO_MODE=false`, `TRUST_PROXY` set correctly behind the proxy.

### Checked only by code, not in a real browser

The browser extension was not connected for several late features, so these were verified by tests and rendering SVGs but not by looking at them in Chrome: table occupancy and checkout flow, the theme decoration bands, the six new background patterns and four separators, and the new typefaces. A visual pass in a browser at 375px and 1280px, in both languages, is the next quick win.

### Known gaps and bugs to fix

- A guest holding an old table QR link can see the next party's bill if the table is reused, because the code identifies the table and not the visit.
- Suggestions are not shown in the order tracking view, and the popular fallback ignores time of day.
- No per restaurant switch for the "ask name, phone and location" WhatsApp rule.
- Fonts: weights 500 and 600 fall back to 400 or 700 for the four new typefaces. The photo editor has no filters.
- Blank required fields on the category and item add forms still show a toast and not a message under the field. Variants and add-ons are validated by a parser and not by nested DTOs. A CSRF failure shows the 500 page with a 403 status.
- User-reported just now: a "Could not establish connection. Receiving end does not exist." console error on `/admin/bulk` when duplicating items. It comes from a Chrome extension, not the app, but whether the duplicate itself worked was not confirmed. The plan item limit (`assertCanAdd`) is one possible cause of a real failure.

### Features not built

- Online payments. Payment is a manual ledger today. The seam for a provider is `PaymentsService.record`, which needs webhook verification, idempotency on the reference, and refunds.
- Custom domains and subdomains. The seam is the slug lookup in `MenuController.show` and `MenuService.getMenu`, plus `getBaseUrl` in `src/seo/seo.ts`.
- Object storage and image resizing on the server. Uploads are local files on a volume, which limits the app to one server for uploads.
- Support "sign in as owner" for the operator, and per plan branding limits.
- Table ordering extras: kitchen printers, payment at the table, bill splitting, a separate waiter role, notifications when no staff screen is open, and a stronger proof of presence than the phone position (for example a daily changing code on the table).
- Real orders from outside a table. WhatsApp orders never reach the restaurant's system, so reports cannot count them.
- A CAPTCHA and terms of service for sign up, and an email to the operator when someone signs up (add a CAPTCHA if bots get through).
- Moving from Gmail (about 500 messages a day) to a transactional email provider when volume grows, and from Postgres rate limits to Redis if write traffic grows a lot. Both are one swap each (`MailService` transport, `RateLimitStore`).
- Language in its own URL (the cookie and query parameter remain), and third party analytics events for selection sends.

## How to run it

Needs Node 20+, npm and Docker.

```
npm install
cp .env.example .env
docker compose up -d
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

Open `http://localhost:3000`, or a menu directly at `/m/bayt-al-zaytoun` or `/m/al-sanabel`. Every seeded account (`admin@<slug>.example.com`, `super@qaemati.example.com`) shares the demo password `Qaemati@Demo123`. The seed wipes data, so never run it in production. E2E tests need `.env.test` and a `qaemati_test` database (see `README.md`). The first platform operator is created with `npm run super:create -- you@example.org "Your Name"`. Production steps are in `docs/deployment.md`.

## Where to read more

- `README.md`: setup, scripts, demo data.
- `docs/decisions.md`: every product and engineering decision with its reason.
- `docs/saas-architecture.md`: tenants, plans, subscriptions, payments, sign up, reminders, operator security.
- `docs/table-ordering.md`: the POS, roles, location check, live updates, safeguards.
- `docs/deployment.md`: server setup, backups, restore, go-live checklist.
- `docs/design-system.md`: tokens, colors, type, components.
- `docs/implementation-log.md` and `docs/progress.md`: the build history, bugs found and how they were fixed.
- `docs/conversion-roadmap.md`: ordered list of the remaining seams to turn the demo into a production service.
