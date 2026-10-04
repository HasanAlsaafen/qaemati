# AI-tells checklist

A checklist of visual, copy, and interaction patterns that make an interface read as
AI-generated or templated, rather than designed for a specific product. Starts from the seed
list in the brief, extended with research findings. Sources:
[SaaS UI looks AI-generated? 7 fixes](https://www.saasui.design/blog/saas-ui-looks-ai-generated),
[AI slop web design guide](https://www.925studios.co/blog/ai-slop-web-design-guide),
[10 signs a website was designed by AI](https://www.newwebsite.ai/blog/10-signs-a-website-was-designed-by-ai).

Each item: what it looks like, why it signals "AI/templated," what to do instead. Per-item
findings for Qaemati specifically (present/absent, where, fix) belong in `audit.md`, not here —
this file is the general-purpose checklist.

## Color and visual treatment

1. **Purple-to-blue gradient backgrounds.** The single most common AI "looks professional"
   default, since it dominates the SaaS-landing-page training data. *Instead:* a restrained,
   specific palette tied to the actual brand (Qaemati's Zaytoun olive/warm-cream palette from
   `docs/design-system.md`) — no gradient as a default fallback.
2. **Glowing blobs / gradient mesh backgrounds.** Decorative abstract shapes with no relationship
   to the content. *Instead:* no decorative background texture unless it reinforces a specific
   brand idea; plain, confident whitespace instead.
3. **Glassmorphism / blur used everywhere.** Frosted-glass panels applied as a default aesthetic
   rather than for a specific legibility reason (e.g., a sticky bar over scrolling content).
   *Instead:* use blur only where it serves a real purpose (the existing sticky search bar's
   `backdrop-blur` over scrolling menu content is a legitimate use — the tell is using it
   decoratively elsewhere).
4. **Box-shadow on every element, same elevation everywhere.** Flattens hierarchy — if
   everything floats, nothing does. *Instead:* shadow/elevation reserved for things that are
   actually "above" the page (modals, the confirm dialog), not static content cards.
5. **Multi-color gradient text on headlines.** Spectacle over hierarchy, and usually tanks
   contrast. *Instead:* solid, high-contrast text color; let type size/weight carry hierarchy.
6. **Thin colored accent bar down the left edge of every card.** A specific, recognizable AI-tool
   default. *Instead:* no decorative accent unless it encodes real information (e.g., a status
   color that actually means something, like the existing "unavailable" item state).

## Layout and components

7. **Identical rounded cards in a uniform grid, same shadow, same radius, same weight.**
   Flattens importance — a hero item and a footnote look the same. *Instead:* vary size/weight by
   actual importance; let empty/low-priority states look visually lighter than active content.
8. **Everything centered, perfect symmetry, no real hierarchy.** Reads as a template, not a
   decision. *Instead:* left/right-align to the actual reading direction (RTL for Arabic, LTR for
   English — asymmetry here isn't a flaw, it's correct bidi design) and let content density
   drive layout, not a centering default.
9. **3-column feature grids with icons, repeated 3+ times down the page.** The generic SaaS
   marketing-page skeleton. *Instead:* n/a for Qaemati — this is a functional app (menu, admin
   panel), not a marketing landing page, so this pattern shouldn't appear at all; its presence
   anywhere would itself be the tell.
10. **Every screen a variation of the same dashboard template** (same sidebar, same card grid,
    different data). *Instead:* let each admin screen's layout follow its actual task (a QR grid
    looks like a QR grid, a list of categories looks like a list, an analytics view looks like a
    chart) rather than forcing one dashboard shell onto all of them.
11. **Uniform spacing everywhere, no grouping.** One `gap` value applied globally instead of
    spacing used to group related elements and separate unrelated ones. *Instead:* tighter
    spacing within a related group (e.g., a price and its currency), looser spacing between
    unrelated groups (e.g., between one menu item and the next).
12. **Inconsistent spacing and radii between components that *should* match.** The opposite
    failure — components that are supposed to be the same system drifting apart because they
    were generated independently. *Instead:* shared macros/components (already the house
    pattern — `button.njk`, the category/item/table row macros) so radius/spacing/sizing can't
    drift between instances of the "same" element.
13. **Over-rounded everything** (pill-shaped buttons, fully rounded cards) applied as a blanket
    default rather than a considered choice. *Instead:* a defined radius scale (`docs/design-
    system.md` already has `--radius-sm/md/lg` tokens) used deliberately, not maximal rounding
    everywhere.
14. **Decorative hover animation with no purpose** — every card lifting and scaling on hover
    regardless of whether it's interactive. *Instead:* hover/transition states only on actually-
    interactive elements, and only enough to confirm interactivity (e.g., a subtle background
    change), not a motion flourish.
15. **Arrow icons on every button** ("Learn more →", "Get started →") regardless of whether the
    action navigates anywhere directional. *Instead:* an icon only when it adds real information
    (a chevron on something that expands, a trash icon on delete); a plain button for a plain
    action.

## Icons and imagery

16. **Emoji used as icons or bullets** (🚀 for performance, 💡 for a tip, ✨ for "premium").
    *Instead:* a real icon set used consistently (the existing hand-checked SVG icons, not emoji)
    — emoji render inconsistently across platforms and read as placeholder, not intentional.
17. **Sparkle icons used to signal "AI" or "magic"** on features that aren't actually AI-driven.
    *Instead:* don't borrow the visual vocabulary of "AI-powered" marketing for an app that is
    just a well-built CRUD tool — honesty in iconography.
18. **Mixed icon styles** (some outline, some filled, some from different icon families) in the
    same interface. *Instead:* one icon style (stroke width, corner treatment) used throughout —
    already mostly the case in Qaemati's hand-written SVGs, worth re-checking as new features add
    more icons (variants, dietary tags, analytics).
19. **Fake/stock-feeling photography** that doesn't represent the real product. *Instead:* for
    Qaemati specifically, the generated placeholder images (fork-and-spoon glyph on a gradient
    circle, from Phase 2/3) are an honest placeholder, not a fake-photo — the tell to avoid is
    ever presenting a generic stock food photo as if it were a real menu item's actual photo.

## Copy and language

20. **Vague, aspirational headlines** — "Welcome to [Product]," "Elevate your experience,"
    "Seamless," "Your all-in-one platform," "Scale without limits." Generated by averaging every
    headline the model has seen, so it says nothing specific. *Instead:* copy that names the
    actual thing the screen does ("Categories," "QR codes & printing" — already the house style
    in Qaemati's admin nav).
21. **Generic microcopy that reads translated, not native**, especially in Arabic. *Instead:*
    see `principles.md`'s microcopy section and `glossary.md` — native Modern Standard Arabic
    with a warm local tone, never a literal mirror of the English string.
22. **Fake stats, fake testimonials, placeholder names like "John Doe," lorem ipsum.**
    *Instead:* for a demo product, honestly-labeled example data (the seed script already uses a
    real, specific fictional restaurant with a real address/story, not "Restaurant Name Here") —
    the tell to avoid going forward is any new feature (e.g., analytics) ever shipping with fake
    "1,234 happy customers"-style numbers instead of real zero-state honesty.
23. **The ubiquitous em dash as connective tissue** in AI-generated copy — one or two is natural
    writing, but a pattern of them stringing fragments together is a tell. *Instead:* already a
    hard constraint in this project's own CLAUDE.md (no em dashes) — re-confirmed here as an
    actual AI-tell, not an arbitrary style rule.
24. **Low-contrast gray-on-gray text everywhere**, used as a default "subtle" look rather than a
    deliberate hierarchy choice. *Instead:* the contrast-check gate already enforced in Phase 1
    (`scripts/check-contrast.ts`) is the actual fix — contrast is verified, not eyeballed.
25. **A default system font (or just "Inter") as the interface's only typographic personality.**
    *Instead:* Qaemati already pairs a real Arabic display/body typeface (Thmanyah) with Inter
    for Latin/numerals — a deliberate pairing, not a default.

## Interaction and structure

26. **Pill badges and chips applied to everything** (every card gets a badge, whether or not it
    carries real information). *Instead:* badges/tags only where they convey something the user
    needs (the existing tag badges — Spicy, Vegetarian, New, Popular — are information, not
    decoration; new dietary/allergen tags in B1 must hold the same bar).
27. **Perfect symmetry and centering used as a layout crutch** rather than a decision about
    reading order and hierarchy (also listed under layout, repeated here because it's as much an
    interaction-flow issue — e.g., centering a form that should instead flow top-to-bottom in
    reading order).
