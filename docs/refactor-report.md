# Refactor report

## Finding

The brief assumed an AI-templated demo needing a rebuild. The repository had already been through 17 phases covering the design system, i18n, tenant theming, admin, security middleware and an AI-tells pass. Rebuilding it would have risked working behavior for no gain. This pass was a gap audit and targeted fixes instead. Work is on branch `refactor/human-ui-and-production-prep`.

## Changes by phase

- **Phase 0, setup**: branch created. Baseline recorded: `tsc`, lint, 74 unit tests and 60 e2e tests passing, app runs against local Postgres.
- **Phase 1, audit**: `docs/frontend-audit.md`, checked against the real code.
- **Phases 2 and 3, tells and design**: the only real tells were dashes in the WhatsApp message line (both locales, builder, spec) and one "Welcome to" string. Both fixed. Design system left as is (`docs/design-system.md`).
- **Phase 4, UX**: menu navigation, search, filters, forms, error pages, focus styles and reduced motion were already present. Added sharing metadata, canonical, Open Graph, Twitter card and `Restaurant` JSON-LD on the menu page.
- **Phase 5, production seams**: added `/robots.txt`, `/sitemap.xml` (one entry per restaurant), `/health` (database round trip), `PUBLIC_BASE_URL` support, and explicit static cache headers. `docs/conversion-roadmap.md` written.
- **Phase 6, verification**: new unit tests for the SEO helpers, new e2e spec for the endpoints and menu metadata, tour e2e assertion updated for the reworded string.

## Verification run after the first commit

- axe (WCAG 2 A, AA, 2.2 AA) over the public menu, admin login, dashboard and QR page in both languages found one serious issue: the English menu's "open now" pill had 4.42:1 contrast. `--color-success` darkened from `#2E7D4F` to `#2A7248` (4.7:1 on the tint). Rerun: zero violations on all eight pages.
- Menu screenshots at 375, 768 and 1280px in Arabic (RTL) and English (LTR) saved in `docs/ux/screenshots/after/`. No horizontal scroll at any width, `dir` correct in both locales.
- `contrast:check` script updated to the new success value.

## AI tells found

| Tell | Fix |
| --- | --- |
| Dash in WhatsApp item line | Colon, in `i18n/*/common.json`, `build-whatsapp-message.ts`, its spec |
| "Welcome to your menu" | "Your menu is ready" |
| Everything else in the catalog | Not present, see the audit table |

## Design system decisions

Unchanged. Zaytoun palette as CSS variables, Thmanyah display and body faces with Plex Arabic and Inter fallbacks, per-restaurant overrides injected as `:root` variables.

## Intentionally not done

- No visual rewrite, no new front-end structure. The existing component macros and layouts already match the seams the brief asks for.
- Rate limiting beyond login, and a JSON logger. Admin form endpoints are behind session auth and CSRF. Revisit when running multiple instances.
- Home page social tags. It is a demo index.
- Lighthouse rerun. Prior reports exist in `docs/ux/lighthouse/`.
- Real address and opening hours in JSON-LD. The schema stores free text hours and no structured address, so I only emit fields that exist.

## Next steps

See `docs/conversion-roadmap.md`. The first three are `PUBLIC_BASE_URL`, a restaurant signup flow, and moving uploads to object storage.
