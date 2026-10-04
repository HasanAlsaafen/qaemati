# Competitive and reference research

Interaction patterns and principles only — nothing here describes copying layouts, assets,
logos, or text from any of these products. Each entry: what the pattern is, why it works, how
Qaemati adapts it, and (where relevant) a weakness we can beat in the Palestinian market.

## Food delivery apps — menu browsing on mobile

### Wolt / Talabat / Uber Eats
Sources: [Uber Eats UX case study (Baymard)](https://baymard.com/ux-benchmark/case-studies/uber-eats),
[Top mobile menu design inspirations](https://arounda.agency/blog/top-mobile-menu-design-inspirations),
[Ubereats: Smart Design (UX Planet)](https://uxplanet.org/ubereats-smart-design-6e376f976bff)

- **Pattern:** a sticky category bar with horizontal scroll, one-tap filters, and a lean bottom
  nav with only essential actions. **Why it works:** category switching is the single most
  frequent action on a food app, so it gets a fixed, always-reachable control instead of being
  buried in a scroll. **Qaemati adaptation:** already built in Phase 3 (sticky search + category
  chip bar with scroll-spy) — confirms the existing pattern rather than introducing a new one.
- **Pattern:** clear visual hierarchy — primary actions (add to order) in bold/high-contrast,
  secondary actions (view details) recede. **Why it works:** reduces decision fatigue on a small
  screen with dozens of items. **Qaemati adaptation:** relevant for the new "My selection" `+`
  button (Phase 9, A1) — it needs to read as the primary tap target on each card, more prominent
  than the existing "view details" tap-through.
- **Known 2025 UX complaint:** excessive scrolling through unrelated categories (flowers,
  alcohol, groceries) before reaching food, and promotional clutter crowding out the actual menu.
  **Weakness we can beat:** Qaemati has exactly one business per QR code and no upsell clutter —
  a diner scans and sees *that restaurant's menu*, nothing else. That focus is a structural
  advantage a multi-vendor marketplace can't offer.

## QR menu and restaurant platforms

### Toast, Square Online, Flipdish, Menu Tiger, Popmenu
Sources: [Flipdish: 12 reasons to use a QR code menu](https://www.flipdish.com/us/resources/blog/12-great-reasons-to-use-a-qr-code-menu-in-a-restaurant),
[Toast Central: generating QR codes](https://central.toasttab.com/s/article/Generating-QR-Codes-for-Menus-and-Online-Ordering?language=en_US),
[Popmenu review](https://www.perfectvenue.com/post/popmenu-review), [Menu Tiger](https://www.menutiger.com/)

- **Pattern:** single-column layout, vertical scroll only (no pinch-zoom/pan needed), legible
  fonts, real photos per item. **Why it works:** removes the fine-motor-control step (zooming)
  that a paper-menu photo or PDF substitute would otherwise force. **Qaemati adaptation:** already
  the baseline layout; worth re-auditing font sizes at 360px in the Phase 7 screenshot pass.
- **Pattern:** branding (logo, color, theme) carried through the whole QR menu, not just the
  restaurant's physical signage. **Why it works:** reinforces that the digital menu is *this*
  restaurant's, not a generic third-party tool wearing its name. **Qaemati adaptation:** directly
  informs A4 (branding settings — logo, cover image, primary color with a contrast check).
- **Pattern (Popmenu specifically):** menus that look and behave like a social feed — real
  diner photos, shareable items. **Why it works:** for Popmenu's audience (US casual dining,
  social-media-driven discovery). **Not adapted:** out of scope and tonally wrong for Qaemati —
  this app is deliberately about one diner reading one restaurant's menu at their table, not a
  public social feed. Noting the pattern to explicitly *not* chase it.
- **Weakness we can beat:** every one of these platforms is English-first with Arabic (if
  supported at all) as a bolted-on secondary locale — machine-translated labels, no real RTL
  layout testing, Latin-numeral prices inside Arabic text reading backwards (the exact bug fixed
  in Phase 3). Qaemati is Arabic-first with English as the second language, built and tested in
  both directions from day one. For a Palestinian cafe owner, that's the actual product, not a
  feature flag. Also: these are subscription SaaS products with per-seat/per-location pricing
  aimed at the US market; a simpler, cheaper, locally-supported alternative is a real gap.

## Owner admin on a phone

### Shopify mobile admin, Square Dashboard
Sources: [Shopify app UX](https://www.shopify.com/partners/blog/app-ux),
[18 UX design tips for Shopify mobile app](https://www.appbrew.com/blogs/ux-design-tips-for-your-shopify-mobile-app)

- **Pattern:** a single consistent design system (Polaris) means every admin surface behaves the
  same way — merchants "intuitively know how to save changes, where to find settings." **Why it
  works:** admin users are busy, task-focused, and have zero patience for learning a new
  interaction model per screen. **Qaemati adaptation:** the Phase 4 admin panel already follows
  one shared macro set (category-block/item-row edit-toggle pattern, one shared confirm dialog,
  one toast mechanism) — same principle, smaller scale. Worth explicitly protecting this
  consistency as new admin screens (branding, analytics, bulk tools) get added in Phases 9–10.
- **Pattern:** large tap targets, minimal typing, designed for "on the go, limited attention."
  **Why it works:** restaurant owners manage their menu between serving tables, not at a desk.
  **Qaemati adaptation:** directly validates the existing `min-h-11` (44px) touch-target
  convention already used throughout the admin panel — confirms it, and is the bar every new
  admin control (branding picker, analytics dashboard, bulk CSV tool) must clear too.
- **Pattern:** progressive disclosure — simple setup steps for new users, deeper settings
  available but not forced on everyone. **Why it works:** avoids overwhelming a first-time owner
  (relevant to A5, the guided tour) while not limiting power users. **Qaemati adaptation:** the
  planned 3–5 step guided tour (A5) and the fact that QR/branding/analytics are separate admin
  nav sections rather than one giant settings page both follow this.

## Brand feel

### Dishoom, Blue Bottle Coffee
Sources: [Designing Dishoom](https://www.dishoom.com/journal/stories/designing-dishoom/),
[The Dishoom effect](https://www.gethegoods.com/articles/the-dishoom-effect-why-lvmh-backed-a-ps300-million-restaurant-chain-that-writes-fictional-backstories),
[Less Is More — Blue Bottle Coffee UX philosophy](https://medium.com/marketing-in-the-age-of-digital/less-is-more-blue-bottle-coffee-ux-design-philosophy-36cf17a6140)

- **Pattern (Dishoom):** every menu item is written in one consistent narrative voice —
  "slightly formal, lightly amused, emotionally specific" — not generic category-and-price
  listings. **Why it works:** the menu itself becomes a brand touchpoint, not just an information
  table. **Qaemati adaptation:** this is a microcopy lesson, not a visual one — it argues for the
  Arabic/English item descriptions in the seed data and in real restaurant onboarding to read as
  warm, specific, locally-voiced text (see `glossary.md`), not literal bilingual translations of
  each other.
- **Pattern (Blue Bottle):** radical simplicity — one product, one clear photo, minimal
  competing information per screen. **Why it works:** reduces choice overload and reads as
  confident rather than sparse. **Qaemati adaptation:** argues against over-decorating the menu
  item card (badges, icons, multiple CTAs) once new features (variants, dietary tags, specials
  banner) are added in Phases 9–10 — each new element needs to earn its place, not just get
  bolted onto the existing card.
- **Both:** restrained, specific color palettes (Dishoom's monochrome-with-accent interiors;
  Blue Bottle's single blue + neutral) rather than a "friendly SaaS" rainbow of pastel tints.
  Directly reinforces the existing Zaytoun palette discipline from `docs/design-system.md` and is
  the standard the P4 branding color picker (A4) needs to hold new restaurant owners to, via the
  contrast-check gate.

## Similar use cases (unverified — no direct web source, reasoned from domain knowledge)

- **Cafe/bar QR menus:** typically simpler than full-service restaurant menus (fewer categories,
  more impulse/visual items like desserts and drinks) — argues for the "Today's special" banner
  (A3) being genuinely useful here, since a short menu benefits more from a single highlighted
  pick than a long one does.
- **Hotel room-service menus:** usually time-gated (breakfast hours, late-night menu) and need a
  clear "closed right now" state — directly the A3 open/closed + time-based category scheduling
  requirement.
- **Food court menus:** often shared QR infrastructure across multiple stalls — explicitly out of
  scope for Qaemati (multi-tenancy is excluded), noted only to confirm the current single-
  restaurant-per-QR model is the right one for this product, not a gap.
