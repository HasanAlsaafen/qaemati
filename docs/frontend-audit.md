# Front-end audit

Scope note: the brief describes an AI-templated demo. This repository is further along. Phases 1 to 17 (see `docs/progress.md`) already built a documented design system, bilingual i18n with Arabic as the default, per-restaurant theming from the database, an admin area, CSRF, helmet, compression, designed 404 and 500 pages, and a prior AI-tells cleanup (`docs/ux/ai-tells.md`, `docs/ux/audit.md`). This audit therefore checks each item in the brief against the code as it is now, and only plans fixes for real gaps.

Baseline before changes: `tsc`, lint, 74 unit tests and 60 e2e tests all passed.

## Routes and views

| Route | View | Purpose |
| --- | --- | --- |
| `/` | `pages/home` | Lists demo menus, demo admin credentials in demo mode |
| `/m/:slug` | `pages/menu` | Public menu: category nav, search, filters, selection list, WhatsApp send |
| `/m/:slug/manifest.webmanifest` | none | Per-restaurant PWA manifest |
| `/offline` | `pages/offline` | Service worker fallback |
| `/admin/*` | `admin/*` | Categories, items, branding, QR, bulk tools, analytics |
| `/styleguide` | `pages/styleguide` | Hidden component reference |
| 404, 500 | `pages/errors/*` | Designed error pages |
| `/health`, `/robots.txt`, `/sitemap.xml` | none | Added in this pass |

## Catalog check

| Tell | Result | Severity | Action |
| --- | --- | --- | --- |
| Purple or blue gradients, gradient text, blobs | None. The only gradients in `app.css` are admin-selectable background patterns | n/a | None |
| Glassmorphism | `backdrop-blur` on two sticky bars (menu search bar, branding save bar). Both sit over scrolling content, which is the legitimate use | Low | Kept |
| Hover scale and decorative animation | `active:scale-[0.97]` on buttons (press feedback). `animate-pulse` only on skeleton placeholders. Global `prefers-reduced-motion` rule exists in `tokens.css` | Low | Kept |
| Emoji as icons | None found | n/a | None |
| Generic SaaS landing template, fake stats, testimonials | None. Home lists real seeded menus | n/a | None |
| Default fonts | Thmanyah (display and body) with IBM Plex Sans Arabic and Inter fallbacks, documented | n/a | None |
| Marketing filler copy | One hit: "Welcome to your menu" in the admin tour | Low | Reworded to "Your menu is ready" |
| Em and en dashes in copy | Found in the WhatsApp item line in both locale files, the builder and its spec | Medium | Replaced with a colon |
| `example.com` | Seed admin emails use `@<slug>.example.com`, a reserved domain, for fictional accounts | Low | Kept, documented |
| Section-label HTML comments | None found in `views/` | n/a | None |
| Hardcoded content in templates | Strings go through i18n, restaurant content comes from Prisma | n/a | None |
| Missing `lang` and `dir` | Present on both layouts | n/a | None |
| Missing canonical, Open Graph, Twitter, JSON-LD | Missing on the public menu | High | Added |
| `robots.txt`, `sitemap.xml` | Missing | High | Added |
| Health endpoint | Missing | Medium | Added |
| Static asset caching | Express defaults, no explicit policy | Medium | Fonts immutable for a year, other assets one hour, `sw.js` always revalidated |
| Structured logging, rate limits on form endpoints | Login is rate limited. Nest `Logger` is used in the exception filter. Other form endpoints sit behind admin auth and CSRF | Medium | Left, see report |
| Home page social and canonical tags | Home has title and description only | Low | Left, home is a demo index |

## Pages

- **Public menu**: strongest page. Sticky category navigation, search, dietary filter, clear prices, one tap WhatsApp, installable. Gap was sharing metadata, now fixed.
- **Home**: functional demo index. No decorative sections.
- **Admin**: task shaped screens, inline validation, guided tour. No High issues.
- **Error pages**: designed, bilingual, rendered by the global exception filter.
