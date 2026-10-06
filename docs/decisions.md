# Decisions applied

Owner decisions from the audit approval, plus the defaults taken from section 9 of `docs/frontend-audit-report.md`.

1. Visual direction is Option 1: keep and tighten the current olive and cream look, no new identity.
2. Tenancy stays single tenant at runtime, and every new model and service takes a restaurant id so a tenant can be added later without changing callers.
3. Images stay on local disk with server side processing added later, see the note in docs/implementation-log.md about where that work sits.
4. Admin mobile is fixed now, because the staff phone is the most likely admin device (audit decision 1).
5. Address, phone and map link will be added as nullable restaurant fields and shown only when set (audit decision 2), scheduled for a later phase.
6. Language does not get its own URL for now, the cookie and query parameter stay (audit decision 3).
7. Production refuses to start with a missing, short or placeholder session or CSRF secret, and only warns when demo mode is on (audit decision 6).
8. class-validator is the validation approach, applied through a global ValidationPipe with whitelist, forbidNonWhitelisted and transform (audit decision 7).
9. Arabic copy gets a native speaker review before launch, this is not done in code (audit decision 8).
10. The hidden styleguide route will be gated in production, scheduled for a later phase (audit decision 9).
11. Demo credentials on the public home page are only acceptable on a labeled demo host, so DEMO_MODE must be off elsewhere (audit decision 10).
12. DTOs check type, length, format and allowed values, while required field rules and domain rules such as color contrast stay in the controllers and services that already report them per field, so existing behavior and tests are unchanged.
13. Validation failures on htmx forms return 422 with field messages and are drawn next to the inputs by a small script without swapping the form, so typed values are kept, and the login form is re-rendered by the server with its message and email kept.
14. Phase C was scoped from the reference menu the owner pointed to, and all four offered items were approved: contact and social details, multiple menus with hours, an All chip, and brand logo dividers.
15. Existing categories moved into a named Main menu through a migration (owner choice), while a category with no menu still falls back to the first menu at runtime so code and tests that know nothing about menus keep working.
16. Menu hours describe a menu on the public page and never hide it, the page opens the first menu being served right now, and a menu with no hours counts as always served.
17. Deleting a menu moves its categories to another menu instead of deleting them, and the last menu cannot be deleted.
18. Every new model carries a restaurant id (Menu), and every new service method takes it, so a tenant can be added later without changing callers.
19. The cached offline notice from the reference was already covered by the existing offline banner and offline page, so only the brand logo divider was added from that item.
20. Facebook accepts a page name or a full facebook.com https link, and the map link accepts any https URL so the owner can paste whichever map service they use.
21. The owner then asked that the design match the reference menu, which replaces decision 1 (keep the olive and cream look). The public menu and, through shared tokens, the admin now follow the reference: pale cool page, cream white surfaces, blue primary with an orange accent, Tajawal type, round category chips, image first dish cards, a centered detail card and a centered footer.
22. Tap targets stay at 44px even though the reference uses smaller pills, because accessible touch targets were an original requirement and the visual difference is small.
23. The reference's own teal measured 3.55:1 against white, so the demo cafe uses a slightly deeper teal and the system keeps requiring 4.5:1 for primary colors.
24. The between dishes logo divider from Phase C was removed before release. On the real page the logo is the placeholder picture for dishes and categories without a photo, so that is what was built, with no setting.
25. Only the category row is sticky. Search scrolls away, because two sticky rows would take about a fifth of a phone screen.
26. The Thmanyah font files stay in the repository because they are a licensed asset the owner supplied, but nothing loads them any more.
27. Text on a restaurant's soft primary tint uses a derived color that is darkened only when needed, so any brand color that passes on white also reads on its tint.
28. Stylesheet and script URLs carry a version string and the service worker fetches the stylesheet from the network first, because the files are not content hashed and a cached copy otherwise outlives every deploy.
29. The admin gets the same AR | EN pill as the public menu, so language is a visible choice in both places.

