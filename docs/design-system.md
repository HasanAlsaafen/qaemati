# Qaemati design system

"Warm Minimalism": warm, appetizing, calm, premium local cafe, not a corporate dashboard.
Generous whitespace, moderate rounded corners, soft shadows, thin borders. Item photos and
prices lead the hierarchy. An editorial touch (large, confident headings) is reserved for the
public menu header and category titles only; everything else (admin panel, forms, dialogs)
stays plain and utilitarian.

Interaction ideas only are borrowed from reference products, never their layout, assets, logos,
or copy: the sticky category bar with scroll-spy and the item bottom sheet (Wolt-style), large
editorial headings for headers and category titles (Dishoom-style), and overall calm, uncluttered
density (Blue Bottle Coffee-style).

## Tokens

All tokens are CSS custom properties on `:root` in `src/styles/tokens.css`, mirrored as Tailwind
theme values in `tailwind.config.js`. A restaurant can override the look later by overriding the
CSS variables (for example `--color-primary`) without touching Tailwind config or templates.

### Color: the Zaytoun palette

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#FAF6EF` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, sheets, inputs |
| `--color-surface-muted` | `#F2EBDD` | Subtle fills (skeletons, chips at rest) |
| `--color-border` | `#E6DCC9` | Decorative dividers only (never the sole cue for an interactive boundary) |
| `--color-border-strong` | `#9C927F` | Input/select/toggle outlines (meets 3:1 non-text contrast) |
| `--color-text` | `#2B2622` | Primary text |
| `--color-text-muted` | `#6B6258` | Secondary text |
| `--color-primary` / `-hover` / `-soft` | `#44603C` / `#365030` / `#E7EEDF` | Primary actions, availability/success-adjacent accents |
| `--color-secondary` / `-text` / `-soft` | `#C4622D` / `#A0481B` / `#F7E3D6` | Terracotta accents. Use `-text` for small text and button backgrounds (the lighter `DEFAULT` fails AA at small sizes) |
| `--color-gold` | `#E2B04A` | "Popular" badge only, paired with dark text |
| `--color-success` | `#2E7D4F` | Success states |
| `--color-warning` | `#A56716` | Warning states. Adjusted from the originally specified `#B7791F` (3.64:1 with white text) to `#A56716` (4.61:1), per the contrast script below |
| `--color-danger` | `#B3382C` | Errors and destructive actions only, never decorative |

Every text/background and button/status pairing is checked by `npm run contrast:check`
(`scripts/check-contrast.ts`), which computes WCAG relative luminance and fails the build if any
pair drops below 4.5:1 (body text) or 3:1 (large text / non-text UI boundaries like input
borders). `--color-border` is intentionally below 3:1 against white: it is a decorative divider,
always paired with spacing or a background change, never the only way a user tells two regions
apart. Interactive elements (inputs, selects, toggles) use the darker `--color-border-strong`
instead, which does meet 3:1.

`--color-secondary-text` was adjusted a second time, in Phase 3, from `#A8501F` to `#A0481B`. The
contrast script had only ever checked it against `--color-bg` and `--color-surface`, both of
which it passed comfortably; it was never checked against `--color-secondary-soft`, the tinted
background badges and the Instagram button actually use it on, where it measured 4.41:1 and
failed AA. A live Lighthouse accessibility audit on the running `/m/:slug` page caught this, not
the script — the script now has that pairing (and the equivalent `primary`/`primary-soft` one)
added so it can't happen again silently.

### Typography

- **Arabic, body and most headings**: Thmanyah Sans, the digital-use member of the licensed
  Thmanyah family, provided by the project owner
  (`public/fonts/thmanyah/LICENSE.pdf`, downloaded from font.thmanyah.com).
- **Arabic, editorial only**: Thmanyah Serif Display, Bold, reserved exclusively for the public
  menu header (restaurant name) and category titles, per the brief's "editorial touch... on the
  public menu header and category titles only." Nowhere else uses this face: admin headings,
  dialog titles, card titles, and every other heading use Thmanyah Sans.
- **Latin**: Inter, for numerals and English text, so a price or English word reads consistently
  regardless of which Arabic face is active.
- **Font stacks**, declared once in `src/styles/app.css`:
  - `--font-sans`: `'Thmanyah', 'Inter', 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif`
    (`'Thmanyah'` here is the Thmanyah Sans face).
  - `--font-display`: `'Thmanyah Serif Display', 'Thmanyah', 'Inter', 'IBM Plex Sans Arabic', ...`
    — only ever applied via the `font-display` Tailwind utility, and only to the two elements
    named above.

**Available weights (confirmed from the licensed family).** Thmanyah ships five weights across
all three of its sub-families (Sans, Serif Display, Serif Text): Light (300), Regular (400),
Medium (500), Bold (700), Black (900). We ship Thmanyah Sans at 400/500/700 (matching the type
scale below) and Thmanyah Serif Display at 700 only (the one weight the editorial treatment
uses). No faux bold or faux italic anywhere: component CSS never requests a weight/style without
a matching `@font-face` declaration.

**Licensing note.** The Thmanyah license (`public/fonts/thmanyah/LICENSE.pdf`) permits embedding
the font in websites "only as part of a compiled, packaged, or obfuscated product," and
separately prohibits making the font available in any way that lets a third party extract,
download, or reuse the font files independently, "including through web embedding." Plain
self-hosted `@font-face` files, which is what this project does, do not meet that bar — a visitor
can retrieve the `.woff2` directly via devtools. The project owner reviewed this clause
(including the version in the official download's `LICENSE.pdf`, not just the website) and
made an informed decision to self-host anyway for this demo. Documented here so it's a known,
deliberate tradeoff rather than an oversight if this project moves beyond a demo.

**Fallback behavior.** Both Thmanyah faces and the `IBM Plex Sans Arabic` fallback restrict their
`unicode-range` to Arabic code points (`src/styles/fonts.css`), so:

- An Arabic character tries Thmanyah first. If a Thmanyah file is ever missing (a 404 doesn't
  break the layout — the browser just treats that face as unavailable for that character) it
  falls through to Inter (no Arabic glyphs, skipped), then to IBM Plex Sans Arabic, which renders.
- A Latin character or digit never matches a Thmanyah/IBM Plex Sans Arabic unicode-range at all,
  so it always renders in Inter, regardless of which Arabic face is active.

IBM Plex Sans Arabic and Inter are self-hosted under `public/fonts/` (SIL Open Font License,
`OFL.txt` included in each folder) rather than linked from Google Fonts, to avoid a third-party
request on every page load and keep the Lighthouse performance budget intact.

**Preloading.** Only fonts actually rendering above the fold are preloaded, in
`views/layouts/base.njk`: Inter (needed immediately for any numeral/Latin text) and Thmanyah Sans
Regular (the default body/heading face).

**Line height is per-language**, via CSS variables that flip based on `<html lang>`:

| Variable | Arabic | Latin (default) |
|---|---|---|
| `--leading-body` | 1.8 | 1.5 |
| `--leading-heading` | 1.5 | 1.25 |

Exposed as Tailwind `leading-body` / `leading-heading`.

**Type scale** (Tailwind's default `text-*` sizes, no custom scale needed, combined with
`leading-body`/`leading-heading` and `font-display`/`font-sans`). Weights are limited to what
Thmanyah actually ships (300/400/500/700/900); there is no 600, so nothing in this scale uses it:

| Role | Size | Weight | Font | Line height |
|---|---|---|---|---|
| Editorial display (menu header name, category titles) | `text-4xl` (36px) / `text-2xl` (24px) | 700 | `font-display` | `leading-heading` |
| H1 (page title, admin) | `text-2xl` (24px) | 700 | `font-sans` | `leading-heading` |
| H2 | `text-xl` (20px) | 700 | `font-sans` | `leading-heading` |
| Body | `text-base` (16px) | 400 | `font-sans` | `leading-body` |
| Small / meta | `text-sm` (14px) | 400 | `font-sans` | `leading-body` |
| Caption / badge | `text-xs` (12px) | 500 | `font-sans` | `leading-body` |

**Numerals**: Western digits (0-9) are used everywhere, in both languages, for prices, phone
numbers, and counts. This is a deliberate, documented choice: the font stack already renders any
Latin/digit character in Inter regardless of surrounding Arabic text (see above), so prices stay
visually consistent whether the page is in Arabic or English. Arabic-Indic digits would need a
different numeral treatment and would break that consistency.

**A price like "18.00 ILS" needs an explicit `dir="ltr"` wrapper on an RTL page.** Found on the
public menu: without it, the Unicode bidi algorithm reorders the digit run and the Latin
currency-code run relative to each other inside the ambient RTL paragraph, rendering "ILS 18.00"
even though the source order is "18.00 ILS" (the digits inside "18.00" are never reversed, only
the position of the whole number relative to the word "ILS"). Every place a price is shown
(`components/menu-item-card.njk`, `components/item-detail-sheet.njk`) wraps it in `dir="ltr"`.
Any future bilingual number-plus-Latin-word string on an RTL page needs the same treatment.

No faux bold or faux italic: only the weights actually declared via `@font-face` are used in
component CSS; nothing sets `font-weight` or `font-style` to a value without a matching face.

### Spacing, shape, elevation

- Spacing: Tailwind's default scale, which is already 4px-based (`1` = 4px, `2` = 8px, ...), so
  no custom spacing scale was needed.
- Radii: `--radius-sm` (6px, chips/badges), `--radius-md` (10px, buttons/inputs),
  `--radius-lg` (16px, cards/sheets/modals), `--radius-full` (pills, avatars).
- Elevation, three levels only:
  1. **Flat**: no shadow, a `border` (default state for cards and list rows).
  2. **Raised**: `shadow-raised` (soft, warm-toned, low opacity) for cards above the page.
  3. **Overlay**: `shadow-overlay` for anything floating above other content (modal, bottom
     sheet, toast).

### Motion

`--duration-fast` (150ms), `--duration-base` (200ms), `--duration-slow` (250ms), all using
`--ease-standard` (`cubic-bezier(0.4, 0, 0.2, 1)`). A global `prefers-reduced-motion: reduce`
media query (in `src/styles/tokens.css`) collapses all animation/transition durations to near
zero, so no component needs to handle this individually.

### RTL

Every component uses logical properties and utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`,
`end-`, `text-start`, `text-end`) instead of `left`/`right`/`ml-`/`mr-`. Direction comes from
`<html dir>`, set per-request by `LocaleViewMiddleware`. Icons that imply direction (back/forward
chevrons, arrows) must be mirrored with a `rtl:` Tailwind variant or an inline check against
`dir`, never hardcoded to point one way.

## Components

Nunjucks macros in `views/components/`, one file per component, imported where needed with
`{% from "components/<name>.njk" import <macro> %}`. Every interactive component has a visible
focus state (`focus-visible` ring using `--color-primary`), a minimum 44x44px touch target, and
appropriate ARIA attributes. The full set, with every state and both languages/directions, is
rendered on the hidden `/styleguide` page (not linked from navigation, not localized out of
existence: it exists purely for development reference and is excluded from the public menu and
admin surfaces).

| Macro | File |
|---|---|
| Button | `button.njk` |
| Icon button | `icon-button.njk` |
| Input | `input.njk` |
| Textarea | `textarea.njk` |
| Select | `select.njk` |
| Toggle | `toggle.njk` |
| Badge | `badge.njk` |
| Card | `card.njk` |
| Menu item card | `menu-item-card.njk` |
| Category chip | `category-chip.njk` |
| Bottom sheet | `bottom-sheet.njk` |
| Modal | `modal.njk` |
| Toast | `toast.njk` |
| Skeleton loader | `skeleton.njk` |
| Empty state | `empty-state.njk` |
| Confirm dialog | `confirm-dialog.njk` |
| Table row | `table-row.njk` |
| Language switcher | `language-switcher.njk` |

## Verifying

```bash
npm run contrast:check   # WCAG AA check over the whole palette
npm run start:dev        # then visit /styleguide in ar and en, LTR and RTL
```
