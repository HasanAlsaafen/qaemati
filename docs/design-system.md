# Qaemati design system

Follows the reference menu the owner chose (qr.befoundonline.ps/menu/haddoota): a pale cool page
with cream white surfaces, a single strong primary color per restaurant, round category chips with
photos, image-first dish cards with a 20px radius and a hairline border, a centered detail card,
and a centered contact footer. Admin screens use the same tokens, so the product reads as one
system. Layout, tokens and behavior were rebuilt from what the page shows. No images, logos,
fonts files or copy come from the reference: Tajawal and IBM Plex Sans Arabic are open fonts and
every picture is the restaurant's own or a clearly marked placeholder.

Two deliberate differences from the reference, both for accessibility: every tappable control keeps
a 44px target (the reference uses about 32px pills), and the demo cafe's teal is slightly deeper
than the reference's, because that teal measures 3.55:1 against white and the design system
requires 4.5:1.

## Tokens

All tokens are CSS custom properties on `:root` in `src/styles/tokens.css`, mirrored as Tailwind
theme values in `tailwind.config.js`. A restaurant can override the look later by overriding the
CSS variables (for example `--color-primary`) without touching Tailwind config or templates.

### Color

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#F2F9FA` | Page background |
| `--color-surface` | `#FFFDFA` | Header, cards (at 95%), footer, inputs |
| `--color-surface-muted` | `#DCECEF` | Photo placeholders, chips at rest, skeletons |
| `--color-border` | `#CFE4E8` | Card outlines and dividers (never the sole cue for an interactive boundary) |
| `--color-border-strong` | `#6F8F98` | Input/select/toggle outlines (3.4:1 on surface) |
| `--color-text` | `#0F2A30` | Primary text |
| `--color-text-muted` | `#4F6E75` | Secondary text |
| `--color-primary` / `-hover` / `-soft` / `-text` | `#1565C0` / `#0F52A0` / `#E3EEFA` / `#1565C0` | Primary actions and accents. `-text` is the primary darkened only as far as needed to read at 4.5:1 on `-soft`, so tag badges stay readable on any restaurant color |
| `--color-secondary` / `-text` / `-soft` | `#FF9800` / `#9A5700` / `#FFF1DB` | Orange accent (today's special marker). Use `-text` for small text, the bright orange is only ever a fill |
| `--color-gold` | `#E2B04A` | "Popular" badge only, paired with dark text |
| `--color-success` | `#2A7248` | Success states, also text on its own 10% tint (4.7:1) |
| `--color-warning` | `#A56716` | Warning states. Adjusted from the originally specified `#B7791F` (3.64:1 with white text) to `#A56716` (4.61:1), per the contrast script below |
| `--color-warning-text` | `#7A480A` | Text on a warning tint. `--color-warning` itself is only 3.8:1 on its own 10% tint, so message text uses this darker value (6.3:1) |
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

Tajawal (SIL OFL, `public/fonts/tajawal`) carries interface text, headings and prices in Arabic
and Latin at 400, 500 and 700, with IBM Plex Sans Arabic and Inter behind it as fallbacks. Both
are self-hosted, nothing loads from a CDN, and each file is limited to its own unicode range so
only the script a page uses is downloaded. The two weights used above the fold are preloaded.
The "modern" font theme swaps both families to IBM Plex Sans Arabic.

| Role | Size and weight |
|---|---|
| Restaurant name | 18px (20px from `sm`), 700 |
| Category title | 24px, 700, with a 4px primary bar at the start |
| Dish name and price | 14px, 700 (price in the primary color) |
| Description, hints | 12px to 14px, 400, muted |
| Chip label | 12px, 500 |

Numerals stay Western digits (0-9) in both languages, and prices read number first, then the
currency symbol (`15.00 ₪`), with the symbol coming from `Intl` and the code kept when a currency
has no short symbol. The earlier Thmanyah files remain in `public/fonts/thmanyah` but nothing
references them.

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
