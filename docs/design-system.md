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
| `--color-secondary` / `-text` / `-soft` | `#C4622D` / `#A8501F` / `#F7E3D6` | Terracotta accents. Use `-text` for small text and button backgrounds (the lighter `DEFAULT` fails AA at small sizes) |
| `--color-gold` | `#E2B04A` | "Popular" badge only, paired with dark text |
| `--color-success` | `#2E7D4F` | Success states |
| `--color-warning` | `#A56716` | Warning states. Adjusted from the originally specified `#B7791F` (3.64:1 with white text) to `#A56716` (4.61:1), per the contrast script below |
| `--color-danger` | `#B3382C` | Errors and destructive actions only, never decorative |

Every text/background and button/status pairing is checked by `npm run contrast:check`
(`scripts/check-contrast.ts`), which computes WCAG relative luminance and fails the build if any
pair drops below 4.5:1 (body text) or 3:1 (large text / non-text UI boundaries like input
borders). The only palette value changed to pass was `--color-warning`; everything else in the
brief already passed. `--color-border` is intentionally below 3:1 against white: it is a
decorative divider, always paired with spacing or a background change, never the only way a user
tells two regions apart. Interactive elements (inputs, selects, toggles) use the darker
`--color-border-strong` instead, which does meet 3:1.

### Typography

- **Arabic**: Thmanyah (licensed, provided separately) for headings and body.
- **Latin**: Inter, for numerals and English text, so a price or English word reads consistently
  regardless of which Arabic face is active.
- **Font stack** (one place, `--font-sans` in `src/styles/app.css`):
  `'Thmanyah', 'Inter', 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif`.
  `--font-display` is the same stack today; the editorial header/category-title treatment comes
  from size and weight, not a different family.

**How the fallback actually works.** Thmanyah's `@font-face` rules
(`src/styles/fonts.css`) point at `public/fonts/thmanyah/*.woff2`, which do not exist yet (only
a `.gitkeep` placeholder is committed). That is intentional, not a bug: when the browser 404s on
a font file, it does not break the layout, it simply treats that face as unavailable and moves to
the next family in the stack for that character. Both Thmanyah and the interim
`IBM Plex Sans Arabic` fallback restrict their `unicode-range` to Arabic code points, so:

- An Arabic character tries Thmanyah (missing today) → falls through to Inter (no Arabic
  glyphs, skipped) → falls through to IBM Plex Sans Arabic (self-hosted now, renders). Once the
  real Thmanyah files are added, the same character renders in Thmanyah automatically, no
  template changes needed.
- A Latin character or digit never matches Thmanyah or IBM Plex Sans Arabic's unicode-range at
  all, so it always renders in Inter, regardless of which Arabic face is active.

IBM Plex Sans Arabic and Inter are self-hosted under `public/fonts/` (SIL Open Font License,
`OFL.txt` included in each folder) rather than linked from Google Fonts, to avoid a third-party
request on every page load and keep the Lighthouse performance budget intact. They are **not**
the licensed Thmanyah asset and can be replaced freely.

**Placeholder weights.** The brief asks to inspect the Thmanyah folder's available weights and
styles before building the type scale, and design the scale around them only. The folder is
currently empty, so the `@font-face` rules declare 400/500/700 as a placeholder assumption (a
typical regular/medium/bold set), not a confirmed fact about the licensed files. When the real
files arrive: inspect the actual weights, update `src/styles/fonts.css` to match exactly
(including removing any weight that doesn't exist, so the browser doesn't synthesize faux-bold),
and re-check this type scale.

**Preloading.** Only fonts actually rendering above the fold today are preloaded, in
`views/layouts/base.njk`: Inter (needed immediately for any numeral/Latin text) and IBM Plex Sans
Arabic 400 and 700 (the faces currently in effect for Arabic body and heading text, since
Thmanyah isn't present). Swap these preload links to the Thmanyah files once they exist.

**Line height is per-language**, via CSS variables that flip based on `<html lang>`:

| Variable | Arabic | Latin (default) |
|---|---|---|
| `--leading-body` | 1.8 | 1.5 |
| `--leading-heading` | 1.5 | 1.25 |

Exposed as Tailwind `leading-body` / `leading-heading`.

**Type scale** (Tailwind's default `text-*` sizes, no custom scale needed, combined with
`leading-body`/`leading-heading` and `font-display`/`font-sans`):

| Role | Size | Weight | Line height |
|---|---|---|---|
| Editorial display (menu header name) | `text-4xl` (36px) | 700 | `leading-heading` |
| Category title | `text-2xl` (24px) | 700 | `leading-heading` |
| H1 (page title, admin) | `text-2xl` (24px) | 600 | `leading-heading` |
| H2 | `text-xl` (20px) | 600 | `leading-heading` |
| Body | `text-base` (16px) | 400 | `leading-body` |
| Small / meta | `text-sm` (14px) | 400 | `leading-body` |
| Caption / badge | `text-xs` (12px) | 500 | `leading-body` |

**Numerals**: Western digits (0-9) are used everywhere, in both languages, for prices, phone
numbers, and counts. This is a deliberate, documented choice: the font stack already renders any
Latin/digit character in Inter regardless of surrounding Arabic text (see above), so prices stay
visually consistent whether the page is in Arabic or English. Arabic-Indic digits would need a
different numeral treatment and would break that consistency.

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
