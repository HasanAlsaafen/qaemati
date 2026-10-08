# Implementation log

Branch `refactor/human-ui-and-production-prep`. Two phases from the approved audit, then Phase C requested mid session (`docs/frontend-audit-report.md`). Decisions applied are in `docs/decisions.md`.

## Results at a glance

| Check | Before | After |
| --- | --- | --- |
| Type-check | pass | pass |
| Lint | pass | pass |
| Unit tests | 84 pass | 149 pass after Phase E (65 new, none changed) |
| E2E tests | 66 pass | 120 pass after Phase E (54 new net, none weakened) |
| axe nodes, 17 pages at 375px (WCAG 2 A, AA, 2.2 AA) | 64, all serious or critical | 0 |
| Pages with horizontal scroll at 375px | 4 | 0 |
| Interactive controls under 44px | 257 | 0 |
| Contrast script | pass | pass, with 4 new pairs |

## Phase A: security and validation (commit cb9eca6, follow-up below)

What changed
- Configuration: `ConfigModule` now validates the environment at startup (`src/config/env.validation.ts`). Production refuses to start when `SESSION_SECRET` or `CSRF_SECRET` is missing, shorter than 16 characters, or contains "change-me". It also rejects an unknown `DEFAULT_LOCALE` or a missing `DATABASE_URL` in every environment. Outside production a weak secret logs one warning and uses an insecure built in value. The old silent `?? 'change-me-in-production'` fallbacks are gone from `bootstrap.ts` and `auth/csrf.ts`. `.env.example` is documented line by line.
- Validation: global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and `transform`. 58 raw `@Body('field')` parameters in 6 controllers are replaced by DTOs (`src/admin/dto/*`, `src/auth/dto/login.dto.ts`). DTO messages are short keys translated per locale from a new `validation` group in both i18n files.
- Rendering errors back: a failed validation returns 422 with a message per field. The login form is re-rendered by the server with the message under the field and the typed email kept (a password is never echoed). htmx forms do not swap on a 4xx, so the typed values stay on screen and the new `public/js/form-errors.js` marks each field with `aria-invalid`, `aria-describedby` and the message, moves focus to the first one, and clears each message as the user edits. A toast covers anything the script cannot place. Verified in a real browser.
- Branding form follow-up: a rejected save used to re-render from the saved row and lose typed text fields. It now merges what was typed into the re-render, with a new e2e test.
- Exception filter: `HttpExceptionFilter` keeps the designed 404 and 500 pages for browsers and the htmx toast path, and now answers clients that prefer JSON with JSON. 5xx responses never carry an internal message, and stack traces go to the log only.
- Hardening: the POST rate limiter now covers PATCH, PUT and DELETE (it only matched POST, so every admin edit and delete was unthrottled).

What was already fine (checked, not changed)
- helmet with a CSP, compression, secure and httpOnly session cookie, sessions in Postgres, login rate limiting per IP and email, the 3 per minute limit on `/demo/reset`, the 120 per minute write limit, `TRUST_PROXY` support, CSRF middleware mounted globally before every route, `GET` routes that only read or record a view beacon, and the JSON access log in production.

Files touched
- New: `src/config/env.validation.ts`, `src/common/validation/*` (4 files), `src/admin/dto/*` (6 files), `src/auth/dto/login.dto.ts`, `public/js/form-errors.js`, `docs/decisions.md`.
- Changed: `src/app.module.ts`, `src/bootstrap.ts`, `src/auth/csrf.ts`, `src/auth/auth.controller.ts`, `src/admin/{categories,items,branding,qr,bulk}.controller.ts`, `src/common/filters/http-exception.filter.ts`, `views/admin/login.njk`, `views/layouts/admin.njk`, `i18n/{ar,en}/common.json`, `.env.example`.

Tests
- Unit: `src/config/env.validation.spec.ts` (9), `src/admin/dto/dto.spec.ts` (24, run through the real pipe).
- E2E, `test/validation.e2e-spec.ts` (8): an invalid price returns 422 with a message per field in English and in Arabic and creates nothing; an undeclared field is rejected; the login form is re-rendered with its message and typed email; a wrong CSRF token on an htmx write returns 403 and changes nothing; a sweep that builds the list of every POST, PUT, PATCH and DELETE route from Nest's controller metadata (more than 25) and confirms each refuses a request with no CSRF token; JSON clients get JSON with no stack; browsers get the designed 404 page. Plus one test in `test/branding.e2e-spec.ts` for preserved values.
- Manual: a production build refuses to start with placeholder secrets and with no secrets, starts with strong ones, and serves `/health`. Development logs the warning.
- No existing test was edited.

Design note: what the DTOs check
- DTOs check type, length, format and allowed values. "Required" rules and domain rules (color contrast, one sided hours) stay in the controllers and services that already point at the field, because existing tests pin that behavior, for example an empty category name still answers 201 with a danger toast.

Left undone in Phase A
- Blank required fields on the category and item add forms still report with a toast, not under the field. They did before this work too.
- Item variants and add-ons (indexed rows) are passed through with `@Allow()` and still validated by `parseOptions`, not by nested DTOs.
- Enum choices on the branding form (font theme and similar) are still checked by `RestaurantService`, not duplicated in the DTO.
- A generic 403 page. A CSRF failure still renders the 500 template with a 403 status.
- Image processing. Decisions.md item 3 says "see Phase B", but Phase B as written has no image work, so it was not started.

## Phase B: admin mobile and accessibility (commit dbd7606)

What changed
- Overflow: `/admin/bulk` and `/admin/branding` fit 375px. Bulk: the five column table is now a list, the import form stacks, and the CSV button is fully visible. Branding: the cause was the live preview frame, a fixed 360px box that widened its grid column and dragged the sticky save bar 17px past the edge. The frame is now `max-w-[360px]` and the grid column is `minmax(0, 1fr)`. Its side buttons and notch use logical positions.
- Shared file input macro (`views/components/file-input.njk`): the browse button is 44px and the control shrinks with its container. Used by the three branding uploads and the CSV import.
- Touch targets: every admin icon button is 44px (item, category and table move up and down, remove option, sidebar collapse, drag handles, the brand link in both admin headers, the QR link). Bulk row Duplicate buttons, import, apply and select all are 44px.
- Accessible names: the bulk file input and percent input have visible labels. Each row checkbox sits in a 44px label with a visually hidden "Select {name}" text. Select all is a labelled 44px target.
- Contrast: the 404 number now uses `secondary-text` (6.1:1, was 4.09:1). While checking pairs I touched, `text-warning` on its own tint measured 3.8:1 (the bulk import message), so there is a new `--color-warning-text` token (6.3:1 on the tint). `scripts/check-contrast.ts` gains four pairs: success, danger and warning text on their tints, and secondary text on the surface. Success and danger already passed (4.7 and 4.8).
- Skip link: new `views/partials/skip-link.njk`, included by the base, admin, menu and print layouts. Each layout's main landmark has `id="main-content"` and `tabindex="-1"`. It is hidden until focused, then a 44px high button with a visible focus outline. Translated in both languages.

Correction to the audit: finding E3 said a skip link existed on the menu layout. That was a false match on the word "Skipped" in a comment. There was no skip link on any page.

Files touched
- New: `views/partials/skip-link.njk`, `views/components/file-input.njk`, `scripts/admin-mobile-check.js`, `test/admin-a11y.e2e-spec.ts`.
- Changed: `views/layouts/{base,admin,menu,print}.njk`, `views/pages/menu.njk`, `views/pages/errors/{404,500}.njk`, `views/admin/{bulk,qr,branding}.njk`, `views/admin/partials/{branding-images,branding-preview}.njk`, `views/admin/components/{item-row,category-block,options-editor,table-row}.njk`, `src/styles/tokens.css`, `tailwind.config.js`, `src/admin/admin-labels.ts`, `scripts/check-contrast.ts`, `docs/design-system.md`, `i18n/{ar,en}/common.json`.

axe before and after (375px, 17 pages: the original 15 plus the Arabic 404 and the print page)

| Page | Before | After |
| --- | --- | --- |
| bulk (English and Arabic) | `label` critical, 31 nodes each | none |
| 404 (English and Arabic) | `color-contrast` serious, 1 node each | none |
| every other page | none | none |
| Total nodes | 64 | 0 |

375px verification (`node scripts/admin-mobile-check.js`)

| Measure | Before | After |
| --- | --- | --- |
| Horizontal scroll | branding 463px (both languages), bulk 422px and 419px | none anywhere |
| Controls under 44px | dashboard 59 per language, bulk 64 per language, branding 3 per language, 404 1 per language, analytics 1, QR 2 (257 total) | 0 |
| Keyboard: Tab, then Enter on the skip link | no skip link | first Tab lands on a visible 44px skip link on home, menu, login, 404 (Arabic), admin and print pages, Enter focuses `main#main-content` |
| Visual check | | bulk and branding screenshots reviewed, the CSV button is fully visible |

The branding page measured 463px here, not the 430px in the audit, because the development database has more content than the audit run saw. The audit numbers for dashboard targets (37) were counted differently: the script now counts every undersized control per page, 29 move up and 29 move down plus others.

Remaining violations: none. Zero serious or critical violations.

Left undone in Phase B
- The print page has no `h1` (starts at `h2`), audit finding D10. Not in the Phase B list.
- Admin screens were checked at 375px only in the pages listed. Item edit and add forms inside an open category, the guided tour and the confirm dialog were not measured in their open states, because axe and the target scan run on the page as loaded.
- Dark overlays and the preview iframe interior are outside the scan.

## Phase C: menus like the reference, plus admin management (commits 0aabb31, fa753e8, b89aa4c)

Scope came from the reference menu (qr.befoundonline.ps/menu/haddoota, read through a page summarizer, so details may be off) and the owner approved all four offered items, with existing categories moved into a named Main menu.

Step 1, contact, address and social
- Admin Branding page gains a "Contact and location" card: tagline (Arabic and English), phone, Facebook, address (Arabic and English) and a map link. Each invalid value is flagged on its own field and nothing is saved.
- Public menu: tagline under the name, a Call button in the header, and a footer with address, map link, hours, phone, WhatsApp, Instagram and Facebook. The footer renders nothing when no detail is set. Structured data gains a real telephone, a `PostalAddress` and both social profiles.
- Validation is shared by the form and the page in `src/common/contact.ts`: phone shape, a Facebook handle or a facebook.com https link, an https map link.
- Migration `20261007000000_add_contact_and_location`, seven nullable columns.

Step 2, multiple menus with hours
- New `Menu` table (restaurant id, names, optional serving window, order) and `Category.menuId`, nullable. Migration `20261007010000_add_menus` creates a Main menu per restaurant and assigns every existing category to it. Verified on the dev database: 7 and 6 categories assigned.
- Public: tabs per menu (plain links, so each menu has an address), a sentence under the tabs such as "This menu is served from 07:00 to 12:00 only." plus "It is closed right now." when it is. The page opens the first menu being served now. Tab links keep the table label. A menu id from another restaurant is ignored.
- Admin dashboard: a menus panel to add, rename, set hours, reorder and delete menus. New categories land in the menu on screen, a category can be moved to another menu from its edit form, and the category arrows stay inside one menu. Deleting a menu moves its categories and dishes to another menu. The last menu cannot be deleted. Overnight windows such as 22:00 to 02:00 work.
- Admin middleware now loads the restaurant's menu list once per admin request so every partial that renders a category block can offer "move to menu".
- Seed: the cafe has Breakfast (07:00 to 12:00) and All day, the restaurant has one Main menu.

Step 3, All chip and logo between dishes
- The category bar starts with an All chip, active at the top, scrolls back to the start when tapped, and the first category is no longer pre-selected.
- New branding choice "Between dishes": nothing, or the restaurant logo shown small between dishes, with live preview. The divider sits inside each dish row, so search hides it with the dish and the last visible dish of a section never shows one. Nothing is drawn without a logo. Migration `20261007020000_add_item_divider`.

Files touched (main ones)
- New: `src/common/contact.ts`, `src/admin/menus.service.ts`, `src/admin/menus.controller.ts`, `src/admin/menus-view.service.ts`, `src/admin/dto/menu.dto.ts`, `views/admin/components/menus-panel.njk`, `views/admin/partials/menus-panel.njk`, `views/components/restaurant-footer.njk`, `views/components/menu-switcher.njk`, three migrations.
- Changed: `prisma/schema.prisma`, `src/admin/{restaurant,category}.service.ts`, `src/admin/{categories,branding,dashboard}.controller.ts`, `src/admin/dto/{branding,category}.dto.ts`, `src/menu/menu.{service,controller}.ts`, `src/seo/seo.ts`, `src/auth/admin-locals.middleware.ts`, `src/prisma-seed/*`, `views/pages/menu.njk`, `views/components/{restaurant-header,menu-item-card,category-chip}.njk`, `views/admin/{branding,dashboard}.njk`, `views/admin/partials/branding-form.njk`, `views/admin/components/{categories-list,category-block,delete-trigger}.njk`, `public/js/menu.js`, both i18n files, `README.md`.

Tests
- Unit 139 pass (22 new: contact helpers, structured data).
- E2E 117 pass (34 new, none changed): `test/contact.e2e-spec.ts` (5), `test/menus.e2e-spec.ts` (21), `test/menu-extras.e2e-spec.ts` (8). The CSRF sweep from Phase A picks up the four new menu routes automatically.
- Menu tests build their serving windows from the real clock (an hour ahead for a closed menu), so they do not depend on the time of day.
- Lint and type-check pass, `contrast:check` passes.

Verification at 375px
- `node scripts/admin-mobile-check.js`: 17 pages, 0 axe nodes, 0 pages with horizontal scroll, 0 controls under 44px, same as after Phase B.
- The two-menu cafe page (tabs, hours note, footer, dividers) in Arabic and English, both menus: 0 axe nodes, no horizontal scroll, no control under 44px.
- Driven in a real browser: add a menu with hours, rename it, delete it through the confirm dialog (the panel swaps back to another menu), no console errors. Scrollspy: All active at the top, a category after scrolling, All again after tapping it. Searching leaves no divider under the last visible dish.
- A footer link caught at 42px wide in the first pass and a phone number written like (02) 2220111 that the first pattern rejected were both found by these checks and fixed before the commit.

Left undone in Phase C
- CSV import still finds a category by its English name across the whole restaurant. Two menus that each have a category with the same English name make the import ambiguous, so keep names unique until the import learns about menus.
- Search and the filter work inside the menu on screen, not across menus.
- The offline notice from the reference already exists (offline banner and offline page), so nothing was added.
- No QR code per menu, and the sitemap lists restaurants only, each menu page points its canonical link at the restaurant page.
- Item level hours and per-menu photos are not part of this.
- The admin page title still says "Categories" although the page now manages menus too.

Dev database changes made while verifying (not part of the code)
- All three migrations were applied to the dev and test databases.
- On the dev database I set the demo contact details on both restaurants, split the cafe into Breakfast and All day menus the way the seed does, and turned on the logo divider for it. The two restaurants' other data, uploads and branding were not touched. `npm run prisma:seed` recreates the same state from scratch.

## Phase D: match the reference design (this session, after Phase C)

The owner asked that the design match the reference menu. I opened the page in a browser, read its computed styles and DOM, and rebuilt the public menu to follow it. Nothing was copied from the page: no images, logos, font files or text.

What was taken from the reference
- Tokens: page `#F2F9FA`, cream white surface `#FFFDFA`, muted fill `#DCECEF`, border `#CFE4E8`, text `#0F2A30`, muted text `#4F6E75`, blue primary and orange accent defaults, 20px card radius, no card shadow. Admin pages share the tokens.
- Type: Tajawal for interface text, headings and prices, IBM Plex Sans Arabic as fallback. Self-hosted, 400, 500 and 700, Arabic and Latin files with their license, preloaded per language.
- Layout: full width cover, then a header row with the logo, name and tagline at the start and an AR | EN pill at the end; pill menu tabs; a full width rounded search with filter and share buttons; round category chips with photos and a ringed active state, "All" first; section titles with a primary bar; a two column grid (three on large screens) of image first dish cards with the price in the primary color and the currency symbol after the number; a centered detail card with a big photo, a dark round close button, name, price, category and description; a centered footer with the address and map pin, hours, and an icon row for phone, WhatsApp, Instagram and Facebook.
- Placeholders: a dish or category without a photo shows the restaurant logo (or a fork and knife icon). A category chip uses the first photographed dish of that category.

Changes beyond the visuals
- Removed the Phase C "between dishes" divider and its column (migration `20261007030000_drop_item_divider`), since the reference's logo was a placeholder picture, not a divider. No release had included it.
- Header call and WhatsApp buttons moved to the footer, matching the reference.
- Currency symbols from `Intl` (`src/common/currency.ts`, tested): ₪ for ILS, code kept for JOD in English.
- New `primary-text` token, derived per restaurant, so tag badges read on any brand color (found by axe on the cafe's teal: 3.84:1 before, 4.5:1 or better after). The secondary text derivation moved from a 35% to a 40% darkening because the default orange failed on its own tint in the branding preview (4.24:1).
- The item sheet close button is translated now (it was hard coded English).

Files touched (main ones)
- New: `public/fonts/tajawal/*`, `src/common/currency.ts` and spec, migration `20261007030000`.
- Rewritten: `views/components/{restaurant-header,language-switcher,menu-switcher,category-chip,menu-item-card,restaurant-footer}.njk`, `views/pages/menu.njk`.
- Changed: `src/styles/{tokens,fonts,app}.css`, `tailwind.config.js`, `views/partials/head.njk`, `views/layouts/menu.njk`, `views/components/{item-detail-sheet,menu-filter-sheet}.njk`, `public/js/menu.js`, `public/js/color-contrast.js`, `src/menu/menu.service.ts`, `src/common/color.ts`, `scripts/check-contrast.ts`, `docs/design-system.md`, seed placeholder colors, favicon.

Tests
- Unit 146 pass (2 new for the derived text color, 5 for currency symbols), e2e 117 pass.
- Two existing specials tests located the banner by a CSS class that the restyle removed. I added a `data-todays-specials` hook and pointed them at it. The second one would have passed vacuously on an empty slice, so it now also asserts the banner is found. The All chip tests were updated for the new chip markup. No assertion was weakened.
- New tests: currency symbol, logo placeholder for a dish and for a category, category chip from the first photo, active language in the pill, translated close button.

Verification
- axe at 375px on all 17 pages plus the two menu cafe page in both languages and both menus: 0 violations, no horizontal scroll, no control under 44px.
- `contrast:check` passes with the new palette. Looked at in a real browser: Arabic and English at 375px, Arabic at 1280px, the detail card, the footer, and the selection bar after adding a dish.

Left undone
- Search is not sticky (see decisions).
- The reference's item cards have no description, tags or add button. Ours keep them because they carry information and features the owner relies on.
- I read the reference at one point in time and only its public page. Other states (its admin, its English version) were not seen.

Dev database changes made for this phase: the cafe's saved olive colors were reset to the seed's teal and its old background color cleared, and the seeded placeholder pictures were regenerated in the new palette. `npm run prisma:seed` recreates this.

## Phase E: full test in Chrome (after Phase D)

A real Chrome session (not an emulator) against the running app: the public menu in Arabic and English, menu tabs, search, the dietary filter, category chips and the All chip, the detail card, the selection panel and its WhatsApp link, then the admin (dashboard, adding, editing, toggling and deleting a dish, adding and deleting a menu, the branding form with a validation error, Bulk, QR, Analytics), the 404, offline and logged-out paths, the manifest, robots, sitemap and health. Test data created along the way (one dish, one menu) was deleted again and the database was checked afterwards.

Bugs found and fixed
1. Stale stylesheet after any deploy (High). The service worker served `/css/app.css` cache first under a fixed cache name, and a comment wrongly called the file content hashed. A returning visitor kept the old stylesheet against new HTML: in this session the cover image rendered 485px tall and the search icon fell out of its field. Fixed by making the worker network first for the stylesheet, bumping the cache to v2, and adding a version string (file modified time) to every CSS and JS URL through a new `asset()` template helper (`src/common/view/asset-url.ts`). Chrome, still running the old worker, recovered by itself on the next load.
2. "Add to Home Screen" squeezed the search field to about 110px with its placeholder cut off, whenever Chrome offered the install prompt. It now has its own row.
3. The filter and selection sheets stretched across the whole screen on desktop, and so did the floating selection bar. They are now capped at a readable width.
4. The selection bar and panel showed "ILS" while every price on the page showed the shekel sign. They now show the symbol (the WhatsApp message keeps the code).
5. The close button of the filter sheet and the selection panel was announced as "Close" in English on the Arabic page. Both are translated now.
6. The admin had no language switcher, so an owner could not change the admin language after login, and htmx updates came back in whatever language a cookie from elsewhere held, mixing English and Arabic on one screen. The AR | EN pill is now in the admin sidebar and in the mobile header.

What passed in Chrome
- Language pill, menu tabs with hours note and the "closed now" sentence, search (Arabic), the dietary filter with its count badge, category chips with the active ring, All chip returning to the top, detail card, add to selection, quantity and note, the WhatsApp message text (`1x قهوة تركية: 11.00 ILS`), the single menu restaurant without a cover image, the footer links.
- Admin: add dish, availability switch with its toast, edit, delete with the confirm dialog, add menu with overnight hours and its tab on the public page, delete menu, the branding validation error with the typed value kept and nothing saved, Bulk, QR, Analytics.
- 404 page (HTML and JSON), offline page, logged-out redirect to the login page, CSRF refusal, health, robots, sitemap, manifest. No JavaScript or CSP errors from the app. The only console errors came from a Chrome extension.

Limits of this test
- The browser window could not be made narrower than the desktop viewport, so phone widths were not re-tested in Chrome. They were verified earlier with an emulated 375px browser, and again after these fixes (0 axe violations, no horizontal scroll, no control under 44px).
- I did not log out of the admin session, because it belongs to this Chrome profile, and did not send a real WhatsApp message.

New tests: versioned asset URLs and the worker strategy (`test/seo.e2e-spec.ts`), translated close labels and the selection symbol (`test/menu-extras.e2e-spec.ts`), `asset-url.spec.ts`. Totals: 149 unit, 120 e2e, all passing.

## Phase F: category pictures

Each category can now have its own picture, shown in the round chip of the public category bar.
- Order of use: the category's picture, then the restaurant logo, then a built in image (`public/images/category-fallback.svg`). The earlier behavior of borrowing the first dish photo was removed, and a test covers that a dish photo is never used.
- Admin: the round thumbnail at the start of each category header opens the file picker, a remove button appears once a picture is set, and the edit form explains the fallback. Uploads reuse the dish photo rules (JPEG, PNG or WebP, 5 MB) in their own folder, `public/uploads/categories`, and only the owner restaurant can change a category.
- Data: `Category.imagePath` (migration `20261007040000_add_category_image`). The seed gives every demo category a generated picture, and the same was applied to the dev database.
- The category header wraps its action buttons under the title on phones, which the extra button made necessary.
- Tests: `test/category-image.e2e-spec.ts` (upload, remove, bad file, another restaurant's category, control on the dashboard) and three fallback tests in `test/menu-extras.e2e-spec.ts`. Totals: 149 unit, 127 e2e.

## Phase G: multi tenancy and the platform area (SaaS)

Requested mid session: make the system a SaaS, with a super admin to manage subscriptions and payments. Choices made with the owner: manual payment ledger, grace period then menu offline, plans with price, limits and feature flags, path slug URLs. Design and rules are in `docs/saas-architecture.md`.

What was built
- Isolation first. `test/tenant-isolation.e2e-spec.ts` (27 cases) has one restaurant's admin attack another's records through every route that takes an id, plus a control that the same routes work on its own records. Nothing leaked. One soft spot was fixed: duplicating a foreign dish was silently ignored and now answers 404.
- Data: Plan, Subscription, Payment, SuperAdmin, AuditLog (migration `20261008000000_add_saas_billing`). A backfill gives every existing restaurant an active subscription on an internal unlimited plan, verified on the dev database.
- Enforcement: one pure function decides ok, trial, grace or blocked. Blocked restaurants answer 503 on the public menu (also out of the sitemap, manifest 404), their admin turns read only (402), with a banner during the last week, the grace period and after. Plans cap menus, categories, dishes and owner accounts on every create path, and switch bulk tools, analytics and the WhatsApp selection list on or off.
- Owners get a Subscription page: plan, dates, usage against limits, included features, payments and printable receipts.
- Platform area under `/super`: overview, restaurants (create, suspend, cancel, reactivate, change plan, dates, owner accounts, password reset), plans, the payment ledger with receipts and voiding, and an activity log. `npm run super:create` makes a real operator, the demo seed adds plans, an operator and billing history.
- The admin mobile menu was missing Analytics and Bulk tools, so both menus now come from one list.

Bugs found on the way
- The demo reset button asked for confirmation with an inline handler, which the page's CSP blocks, so the destructive reset ran without asking. It now uses Alpine, with a test.
- Nunjucks has no `min` filter, found by the first test with a plan limit.
- A real Chrome run of the new restaurant form showed that a validation failure kept only the offending field, so the owner retyped everything else. The validation pipe now keeps the whole submitted form (secrets still dropped), with unit and e2e tests.

Verification
- 164 unit tests and 215 e2e tests pass. The e2e suites for this work are `tenant-isolation` (27), `subscription-enforcement` (19) and `super-admin` (43): login separation, creating a restaurant (invalid, reserved and taken addresses, owner email, keeping what was typed), suspend and reactivate against the live menu, plan changes and archived plans, owner accounts and their limit, payment date arithmetic (early, late, lapsed, suspended), refused amounts and dates, sequential receipts, voiding, ledger filters, receipts per owner, plans, metrics, search and the audit trail. The CSRF sweep from Phase A covers every new route automatically.
- axe at 375px on all admin pages and every super page (overview in both languages, restaurants, new restaurant, restaurant page in both languages, plans, new plan, payments, new payment, receipt, activity log, billing in both languages): 0 violations, no horizontal scroll, no control under 44px.

Left undone
- Two factor sign in, emails (renewal reminders, receipts, first password), support sign in as an owner, a provider integration and custom domains. All are listed with their seams in the architecture doc.
- Restaurants created through tests have no subscription row and count as unlimited. A real restaurant always gets one from the platform area.

## Phase H: email, password reset and invitations

Gmail SMTP (app password) through a small `MailService`. Owners can reset their own password from `/admin/forgot`, and a restaurant the operator creates now emails its owner a link to choose a password.

- New table `PasswordResetToken` (migration `20261009000000_add_password_reset`), hash only, single use, expiring.
- Anti abuse: identical answer for known and unknown addresses, at most 5 mails per address and 20 requests per IP per 15 minutes, all sessions of the account are ended on a successful reset, a new request cancels the older link.
- Tests: 13 e2e (known and unknown address, hashed storage, one use, session end, short and mismatched passwords, expired and malformed links, replaced link, rate limit, Arabic mail, invitation and operator reset) and 3 unit.
- Not verified against real Gmail, because that needs the owner's app password. The transport is the standard nodemailer Gmail SMTP setup. Send yourself a reset mail after setting the two variables.

## Phase I: rate limits in Postgres

The login, password reset and POST limiters counted in memory, so a restart cleared a lockout and several instances each allowed the full number. They now count in a `RateLimitBucket` table through one `RateLimitStore` interface (migration `20261010000000_add_rate_limit_bucket`).

- One upsert counts and starts a fresh window, using the database clock, so simultaneous requests never lose a hit and servers with different clocks agree. Expired rows are purged every 10 minutes.
- If the database cannot be reached the limiter lets the request through and logs, since a sign in needs that database anyway.
- Tests use an in memory store per app, because they hammer limits on purpose and a database counter would carry over between runs. The database store has its own e2e suite: counting, sharing between instances, 25 simultaneous hits counted exactly, window expiry, reset, purge.
- Checked by hand on a real process: six wrong sign ins on port 3111 locked the account, and after killing and restarting the process it was still locked.

## Phase J: deployment, backups and CI

Dockerfile (runs migrations on start, health check, non root, uploads volume), `docker-compose.prod.yml` (app, Postgres not exposed, Caddy with automatic HTTPS), `.env.production.example`, `scripts/backup.sh` and `scripts/restore.sh`, a GitHub Actions workflow (lint, types, build, contrast, unit, migrations, e2e) and `docs/deployment.md` with the first deployment, updates, nightly backup, restore rehearsal and a pre launch checklist.

- Verified: a real backup of the dev database restored into a scratch database with identical counts for restaurants, dishes, payments, owners and subscriptions; retention kept only the newest N; the restore refuses without typing the confirmation; the compose file renders; shell syntax and the CI YAML parse.
- Not verified: the image build, the running container and the certificate step (no Docker daemon access here), and the CI run on GitHub. The first real build may need a small fix.

## Phase K: platform operator security

- Authenticator app (TOTP, RFC 6238, checked against the RFC test vectors) with single use codes, 10 hashed recovery codes, encrypted secret, lockout after five wrong codes, and enforcement in production.
- Forgot and change password for operators (12 character minimum, link separate from the owner link, never bypasses the authenticator, change ends every session).
- IP allowlist for `/super` (plain 404 for others), `--reset-2fa` for a locked out operator.
- Migration `20261011000000_super_admin_security`: authenticator fields on `SuperAdmin`, reset tokens now belong to exactly one kind of account (database check).
- Bug found by the new tests: pages rendered from a POST handler answered 201 (Nest default) instead of 200, the same quirk the owner login documents.
- Tests: 22 e2e (setup, wrong first code, hashed recovery codes, password then code, replay, recovery use once, lockout, required mode, disable, renew codes, password change ending sessions, reset links, allowlist) and 16 unit (RFC vectors, drift window, replay, encryption, tamper, allowlist ranges). axe at 375px clean on the new pages.
- Not covered: signing the operator out of other devices when 2FA is turned on or off, and a notification email on operator sign in.

## Phase L: landing page

The home page is now a bilingual marketing page for the product: hero with a phone sketch, how it works, nine features, pricing from the active plans, FAQ, a closing call to action and a footer. A demo section with sample menus and logins appears only in demo mode. The earlier page listed every restaurant in the database, which on a real deployment would publish the customer list, so that is gone outside demo mode.

- Type: Thmanyah Sans and Serif Display on the landing page only, behind a license gate (see decision 43). The gate is `THMANYAH_WEB_LICENSED`; off in production by default, the page then uses Tajawal and the font files answer 404.
- Contact buttons use `LANDING_CONTACT_WHATSAPP`, else `LANDING_CONTACT_EMAIL`, else owner sign in, so there is never a dead button. `LANDING_DEMO_SLUG` picks the "see a live menu" target.
- SEO: title, description, canonical, Open Graph and `SoftwareApplication` structured data with the plans as offers.
- Tests: 14 e2e (both languages, plans and archived plans, structured data, what is named in demo and real mode, contact fallbacks, font gate in development, production off, production confirmed, other pages unaffected) and 6 unit. axe is clean at 375px and 1280px in Arabic and English, no horizontal scroll, no control under 44px.
- Found on the way: Nunjucks does not allow a chained inline `if ... else ... if`, and a crashed test run left a fixture restaurant in the test database that blocked the next run (removed by hand).
- Not done: a real product photo or screenshot (the phone is drawn from the page's own colors), a contact form, and a public sign up. The contact buttons are the only way in until you decide on self signup.

## Phase M: landing page rework

- The phone is an iPhone drawn at real proportions (390 x 844 screen, bezel, Dynamic Island, status bar, side buttons, home indicator) around an iframe of an existing live demo menu in the visitor's language. On desktop it is interactive, below 1024px a link covers it so a tap opens the real menu and the page keeps scrolling. It appears only when the chosen menu exists, has a menu and is not switched off, so it is never faked. `public/js/landing.js` reloads the frame if its first navigation is dropped (seen when a service worker takes over the page as it loads).
- AI-tells audit of the landing page against `docs/ux/ai-tells.md`, and fixes: gradient hero (removed), 9 icon cards in a grid (now a definition list), 3 identical step cards with number circles (now a ruled list), three plan cards with a "Most popular" badge that had no data behind it (now a price list, no badge), check mark bullets and an eyebrow pill (now one plain sentence), generic headlines and unverifiable claims such as "built with restaurant owners" (rewritten), a gradient on the phone frame (flat), blur on the header (solid), shadows on buttons (gone), and the same section padding everywhere (varied, with a two column header layout).
- Gradients removed from the seed placeholder images too (flat color now, the existing local seed files were flattened in place). The dot, grid and stripe background options in `app.css` use gradient syntax only to draw flat repeating lines, so they stay.
- " -- " used as a dash in older admin copy was replaced in both languages.
- "Try it yourself" section removed, with the demo logins and reset button on the home page. The reset endpoint still exists (for the demo host) and is tested.
- Tests: landing e2e is 21 cases (phone is live, localized, left to right in Arabic, absent when there is nothing real to show or the restaurant is suspended, framing allowed only by the same origin, no template tells in either language, no gradient anywhere in the page, no demo section in any mode) plus a seed placeholder unit test.

## Phase N: table orders, POS and waiter calls

Built from the request: when the menu is opened from a table the order goes to the cashier or kitchen screen instead of WhatsApp, staff change its status, a guest can call the waiter with a sound on the staff side, and an order from a table must come from inside the restaurant. Behavior, safeguards and limits are in `docs/table-ordering.md`.

- Data (migrations `20261012000000_add_table_orders`, `20261012000001_recovery_codes_no_default`, `20261013000000_internal_plan_table_ordering`): `Order`, `OrderItem` (copies of names and prices), `WaiterCall`, a random key on each table (existing tables backfilled), a position, radius and switch on the restaurant, and an atomic order counter.
- Guest side: `POST /m/:slug/orders` and `/waiter-calls` (JSON, CSRF header), the menu in table mode (send to the kitchen, call waiter, location prompt), the table QR codes now carry the key.
- Staff side: `/admin/pos` board, status buttons, waiter call handling, the location settings form, a live websocket with sound, tab title count and connection indicator.
- Found and fixed on the way: the selection sheet's quantity buttons were 36px (now 44px), staff POST routes that render answered 201 (the same Nest quirk as before).
- Tests: 57 e2e for orders, pricing, tampering, tables, location, plans, abuse limits, waiter calls, staff transitions, races and tenant isolation, 9 for the websocket (own restaurant only, id only payload, no session, wrong origin, signed out, cannot choose a room), 10 for the menu in table mode and the QR codes, and 26 unit tests (distance, location rules, line keys and cents, event bus).
- Browser check: a staff window and a guest window against a real server: staff showed Live, the guest's order arrived without a reload, moved New to Preparing to Ready, a waiter call raised the open call count and On my way cleared it, a guest 100 km away was refused with a message, and a guest who denied location was asked for it. axe clean at 375px and 1280px in Arabic and English for the POS screen and the table menu, including the open selection sheet.
- Not verified by ear: I cannot listen to the sounds here. The tones are generated with the Web Audio API and the logic that starts and repeats them is exercised, but check them on a real device.

## Phase O (1/5): the guest follows their order

Order status for the guest, the first of five follow ups (guest status, staff roles, renewal reminders, self signup, reports).

- Each order has a private random token (migration `20261014000000_order_public_token`). `GET /m/:slug/orders/:token` returns the number and status only, and a websocket namespace `/track` pushes changes to whoever holds that token. Both are rate limited, tenant scoped and answer 404 for anything else.
- The menu shows a progress panel in the selection sheet, a pill to reopen it, remembers the order across reloads, and clears it when the guest taps Done after served or canceled. Arabic and English.
- Bug found in the browser: Alpine's object spread (`...tableOrderState()`) copies a getter's value once instead of keeping it live, so status text never updated. The state uses methods instead of getters.
- Tests: status endpoint (private token, status only, follows staff changes, rejects ids/guesses/other restaurants, Arabic), `/track` websocket (initial status, live change, status only, other orders not heard, bad tokens, other origin, other restaurant staff cannot move it), and the menu wiring. Browser check with a guest phone and a staff screen in English and Arabic: live update, reload, finish, axe clean.

## Phase O (2/5): cashier and kitchen accounts

- Migration `20261015000000_staff_roles` adds `AdminUser.role` (OWNER default, so every existing account stays an owner).
- `AdminRoleMiddleware` restricts cashier and kitchen sessions to the orders screen, sign out and the tour dismiss, by default deny. Dot segments and percent encoded dots are refused so a prefix cannot be walked out of (found by a unit test).
- Orders screen by role: the kitchen sees no prices, no waiter calls and no cancel or serve buttons; cashiers see prices and calls but not the location settings; the websocket sends waiter calls to owners and cashiers only. The server refuses the same actions, tested.
- New Team page (`/admin/team`) for owners: add (generated password shown once plus invitation mail), change role, reset password, remove, with the plan limit, last owner and self protections, and sessions ended on change. "Owner accounts" is now "Team accounts" in the plan screens.
- The admin sidebar, mobile menu, billing banner, preview link and first login tour are hidden from staff. Seed: each demo restaurant has cashier@ and kitchen@ accounts with the demo password.
- Tests: 31 e2e (sign in routing, access matrix, forbidden writes with a valid token, what each role sees and can change, floor versus kitchen sockets, the team page, limits, isolation) and 9 unit. Browser: cashier redirected from billing, kitchen board has no prices, axe clean on the team page at 375px in both languages and 1280px.

## Phase O (3/5): renewal reminders and receipt emails

- Migration `20261016000000_notification_log`. Pure rules in `notice-rules.ts` (8 unit tests), bilingual emails, `BillingNotifier.runReminders(now)`, an hourly scheduler, receipts on every recorded payment, and an "Emails sent to the owners" list on the platform restaurant page.
- Tests (15 e2e): owner only recipients, each notice once, concurrent runs, the full sequence over time, trials, nothing for suspended or canceled or far off plans, a renewal starting fresh reminders, retrying when nobody could be reached, links and contact when configured, the receipt, and a failed email never undoing a payment.
- Not verified against real Gmail, like the other mail.

## Phase O (4/5): self sign up

- Migration `20261017000000_signup_request`. `TenantProvisioner` extracted from the platform's create (its 44 tests still pass), `SignupService`, form, sent and confirm pages in both languages, a slug suggestion script, landing page buttons that go to the form while it is open, and a robots rule for the confirmation links.
- Found by the tests: two people confirming at the same moment both passed the claim step, so one got a "taken" error instead of "link used". The claim now deletes by id and only the one that removed the row proceeds.
- Tests: 33 e2e (form and plans, closing it, production without email, validation with kept values, taken and reserved addresses, replaced requests, known emails answered identically with no leak, creation, sign in afterwards, single use under concurrency, expired and malformed links, an address taken meanwhile, bots, rate limits per device and per inbox, CSRF). Browser: the form, the emailed link, confirming and landing in the admin with the tour, axe clean at 375 and 1280 in both languages.
- Not done: a CAPTCHA, terms of service, and an email to you when someone signs up.

## Phase O (5/5): reports

- `/admin/reports` and `/admin/reports/export.csv` (`src/reports`): range parsing that refuses impossible dates, reversed or over a year ranges and SQL in the query (unit tested), aggregations done in SQL in the restaurant's time zone, a page with bars as semantic tables, and a spreadsheet safe CSV.
- Found in the browser: the daily table was wider than a phone and the scroll area it sat in failed the accessibility rule, so the decorative bar column is hidden on small screens.
- Tests: 19 + 6 unit (ranges, dates, CSV) and 25 e2e (totals excluding canceled and out of range orders, midnight in the restaurant's zone at both ends of a range, zero days, hours, dishes across sizes, tables, waiter call answer time, another restaurant never counted, mixed currencies, empty state, Arabic, bad ranges and an injection attempt, the CSV file and formula defusing, who can open it). Browser: axe clean at 375 and 1280 in both languages, no horizontal scroll.

All five follow ups are now done: guest order status, cashier and kitchen accounts, renewal reminders and receipts, self sign up, reports.

## Menu: the All chip icon

The "All" chip in the category bar drew a malformed fork and knife that read as a broken glyph, was small and pale next to the other chips, and did not say "all". It is now four squares, 24px, in the restaurant's accent colors (soft tint, accent glyph) so it follows the theme like the active ring does. Checked in both languages, active and inactive, axe clean, with a test that it is the four squares and not the old path.

## WhatsApp orders: name, phone and location

- Before a WhatsApp order opens, the selection sheet asks for a name, a phone number and a location. Sending is blocked with a message on each missing field (focus goes to the first), Arabic and Eastern Arabic digits in the phone are turned into 0 to 9, a position can be shared with one tap (a map link goes in the message) or an address typed, and the details are remembered on that phone and shown again next time.
- The message now starts with the restaurant, then Name, Phone, Address and Location lines, then the dishes. Nothing is stored on the server.
- Privacy controls: "Remember my details on this phone" (on by default, unchecking stores nothing), "Forget my saved details", and a line saying the details only go in the WhatsApp message.
- Tests: 38 unit (the rules, digits, line breaks and long text, the message layout) and 4 e2e (fields and labels in both languages, none for a table guest). Browser: empty send blocked, focus on the name, axe clean with errors showing and in Arabic, the real message captured with the details, remembered across a reload, forgotten, typed address only, remember off stores nothing, location denied shows the fallback.
- Not done: a per restaurant switch for restaurants that do not want to ask.

## New risks noticed

- Rate limit and login limiter counts are per process (unchanged, audit H7).
- `forbidNonWhitelisted` rejects any form field a DTO does not declare. A future template that adds an input must add it to its DTO, or the save fails with a 422. The CSRF sweep and validation tests will not catch that for a new field, so each new form field needs an e2e case.
- The generic 422 toast text is the same for every failure, the specific wording is only in the field messages, which depend on `form-errors.js` finding an input with that `name`. A field rendered without a `name` attribute gets only the toast.
- htmx loads and runs `form-errors.js` only on admin pages. Public pages have no htmx forms today.
- Dev only: `url.parse()` deprecation warning appears at startup from a dependency, not from this code.
- A new migration run on a database that already has menus is safe, but the Main menu backfill assumes menus did not exist: running `20261007010000_add_menus` twice by hand would add a second Main menu. Prisma applies it once.
- Menu hours use the server clock in Asia/Hebron, same as category hours. A restaurant in another timezone needs that made configurable first.

## Dish suggestions

- Added `ItemPairing` and `SuggestionAdd` (migration `20261018000000_item_pairings`), the ranking in `src/suggestions/suggest.ts`, the public `GET /m/:slug/suggestions` and tap beacon, and the owner picker `GET/POST /admin/items/:id/pairings` (owners only, replaces the list in one transaction, drops itself and other restaurants' dishes).
- Guest side: a "You might also like" list in the selection sheet (a dish with sizes or extras opens its own sheet instead of adding) and a "Goes well with" list in each dish sheet (owner picks and order patterns only, never filler). Works in WhatsApp and table modes.
- Owner reports show how many suggested dishes were added and which ones.
- Verified: lint, tsc, 318 unit, 524 e2e; real browser at 375 and 1280 in Arabic and English with axe (no violations).
- Not done: suggestions are not shown on the table order tracking view; popular fallback does not yet use the time of day.
