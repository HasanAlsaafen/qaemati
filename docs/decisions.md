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
26. The Thmanyah font files stay in the repository because they are a licensed asset the owner supplied. They are used only on the landing page (decision 43), and nowhere else.
27. Text on a restaurant's soft primary tint uses a derived color that is darkened only when needed, so any brand color that passes on white also reads on its tint.
28. Stylesheet and script URLs carry a version string and the service worker fetches the stylesheet from the network first, because the files are not content hashed and a cached copy otherwise outlives every deploy.
29. The admin gets the same AR | EN pill as the public menu, so language is a visible choice in both places.
30. Multi tenancy is now a runtime requirement, which replaces the earlier decision to stay single tenant. Every owned record already carried a restaurant id, and an isolation test suite proves one restaurant cannot read or change another's records.
31. Payments are a manual ledger the platform operator fills in, with a single method that extends the subscription so a provider can be added later without touching callers.
32. When a subscription ends there is a grace period (7 days by default, per restaurant), then the public menu goes offline and the owner's admin turns read only. Data is never deleted.
33. Plans carry a price and billing period, usage limits and feature flags. Restaurants created before billing sit on an internal unlimited plan until the operator moves them.
34. Visitors reach a menu by path slug. Custom domains and subdomains are left as a documented seam.
35. Platform operators live in their own table and session, so no restaurant account can become one. Passwords are generated and shown once.
36. The demo reset confirmation moved from an inline handler, which the CSP blocks, to Alpine, because the destructive reset otherwise ran without asking.
37. Email goes through Gmail SMTP with an app password (nodemailer), configured by MAIL_USER and MAIL_APP_PASSWORD. Without them nothing is sent and development prints the message. Gmail is fine for a launch but caps sending at roughly 500 messages a day, so move to a transactional provider when volume grows. Only the transport in `MailService` would change.
38. Password links are random, single use, expire (60 minutes for a reset, 3 days for an invitation) and only a hash is stored. The reset form answers identically for known and unknown addresses, limits requests per address and per IP, and signs the account out of every open session when the password changes.
39. Rate limit counters live in Postgres rather than Redis, to avoid a new service for now. One extra query per sign in attempt and per write request is acceptable at this scale. Revisit if write traffic grows a lot, the interface (`RateLimitStore`) is the only thing to swap.
40. One server with Docker Compose and Caddy is the first deployment target. Caddy was chosen over nginx because it handles certificates with no extra tooling. Uploads stay on a volume until traffic justifies object storage.
41. Operators use a standard authenticator app (TOTP) rather than SMS or email codes, which cannot be intercepted by a SIM swap or a hacked mailbox. It is required in production and optional elsewhere so development stays quick.
42. A password reset never bypasses two step verification, so access to an operator's mailbox alone is not enough to take over the platform.
43. The landing page is set in Thmanyah (Sans for text, Serif Display for headings), as the owner asked. The Thmanyah license (`public/fonts/thmanyah/LICENSE.pdf`) allows commercial use in a website only as part of a compiled, packaged or obfuscated product, and forbids hosting the files or making them downloadable, including through web embedding, unless thmanyah grants it separately (ask@thmanyah.com). A plain `@font-face` pointing at public `.woff2` files is exactly the forbidden case. So the files are served on developer machines, and in production only when `THMANYAH_WEB_LICENSED=true` is set to say that permission exists. Without it the page falls back to Tajawal and `/fonts/thmanyah/*` answers 404. The files are also committed to the repository, which is worth clearing in the same email.
44. The home page is now a marketing page. It never lists restaurants or demo logins, because a real deployment must not advertise its customers. Prices come from the active plans, so changing a plan in the platform area changes the page. The demo logins section was removed at the owner's request.
45. The landing page follows the project's AI-tells checklist (`docs/ux/ai-tells.md`): no gradients anywhere (including the seed placeholder images and the phone frame), no icon card grids, no badges or claims without data, no check mark bullets, no em dashes. Features are a plain definition list, steps a ruled numbered list, plans a menu-style price list with dotted leaders. The only visual is a real iPhone frame around the live demo menu, so what visitors see is the product, not an illustration.
46. Table orders go to a POS screen over a websocket, and the WhatsApp path is untouched for every other way of opening the menu. From a table there is no WhatsApp fallback, so a guest who is refused (for example for location) is told to ask the waiter. See `docs/table-ordering.md`.
47. A table's QR code carries a random key, not its name. A name in the address is not proof of anything, so it can label a WhatsApp order but never create a POS order. Existing tables were given keys by a migration and need their codes reprinted.
48. The location check uses the guest phone's position against a per restaurant point and radius, widened by the phone's accuracy up to 100 meters. It is a filter against mistakes and pranks, not proof, because the position can be faked. It is switchable per restaurant, and with no position set it lets everything through and the POS page warns.
49. Live updates use Socket.IO on the existing login session with an Origin check, and Postgres LISTEN / NOTIFY between instances, instead of Redis. Events carry only ids. Staff actions are ordinary CSRF protected POSTs, not socket messages, so validation and tenancy checks live in one place.
50. Table ordering is a plan feature (`tableOrdering`), like bulk tools and analytics. Restaurants on the internal plan have it.
51. Roles are three fixed ones (owner, cashier, kitchen) rather than a permissions matrix. Staff are limited by a default deny list in one middleware, so new owner pages are protected without anyone remembering to add a check, and the per action rules live in `src/pos/roles.ts` with unit tests. Changing a role ends that person's sessions, because the role is cached on the session.
52. Reminders are sent by an hourly in process check that claims each notice in the database before sending, instead of an external cron or a lock. It needs nothing extra to deploy, is safe on several instances, and can be called with any date in tests.
53. Self sign up creates nothing until the owner confirms their email, and uses no CAPTCHA at first: a confirmation step, a honeypot, a minimum fill time and rate limits are enough to start with, and the form answers the same for a known email so it cannot reveal customers. Add a CAPTCHA if bots get through.
54. Restaurant creation lives in one `TenantProvisioner` used by the platform area and by self sign up.

