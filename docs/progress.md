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
  membership is active and confirm PostgreSQL comes up on port 5432.
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
