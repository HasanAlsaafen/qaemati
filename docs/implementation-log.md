# Implementation log

Branch `refactor/human-ui-and-production-prep`. Two phases from the approved audit (`docs/frontend-audit-report.md`). Decisions applied are in `docs/decisions.md`.

## Results at a glance

| Check | Before | After |
| --- | --- | --- |
| Type-check | pass | pass |
| Lint | pass | pass |
| Unit tests | 84 pass | 117 pass (33 new, none changed) |
| E2E tests | 66 pass | 83 pass (17 new, none changed or weakened) |
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

## New risks noticed

- Rate limit and login limiter counts are per process (unchanged, audit H7).
- `forbidNonWhitelisted` rejects any form field a DTO does not declare. A future template that adds an input must add it to its DTO, or the save fails with a 422. The CSRF sweep and validation tests will not catch that for a new field, so each new form field needs an e2e case.
- The generic 422 toast text is the same for every failure, the specific wording is only in the field messages, which depend on `form-errors.js` finding an input with that `name`. A field rendered without a `name` attribute gets only the toast.
- htmx loads and runs `form-errors.js` only on admin pages. Public pages have no htmx forms today.
- Dev only: `url.parse()` deprecation warning appears at startup from a dependency, not from this code.
