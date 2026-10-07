# SaaS architecture

How one deployment serves many restaurants, and how the platform operator runs the business.

## Tenants

A tenant is a `Restaurant` row. Everything a restaurant owns carries its `restaurantId`: menus, categories, dishes, tables, admin users, analytics, bulk logs, the subscription and the payments. Every admin service takes the signed in restaurant's id from the session and checks ownership before it reads or changes anything by id. `test/tenant-isolation.e2e-spec.ts` proves it: one restaurant's admin attacks another's records through every route that takes an id, and nothing changes or leaks.

Visitors reach a menu by `/m/:slug`. The slug is chosen at creation, must be unique, and a list of reserved words (`admin`, `super`, `lang`, and so on) is refused.

Custom domains are not built. The seam is the lookup in `MenuController.show` and `MenuService.getMenu`, which find a restaurant by slug. A host to restaurant lookup would go in front of it, plus a `customDomain` column and a verification flow. `PUBLIC_BASE_URL` and `getBaseUrl` in `src/seo/seo.ts` are the places that would learn about it.

## Plans, subscriptions and payments

| Model | Meaning |
| --- | --- |
| `Plan` | Price, currency, monthly or yearly billing, trial days, limits (menus, categories, dishes, owner accounts, empty means unlimited) and feature keys (`bulkTools`, `analytics`, `whatsappOrdering`). Archived plans stay on the restaurants that have them. |
| `Subscription` | One per restaurant. Status, trial end, paid until, grace days. An empty paid until means it never expires, which internal and free accounts use. |
| `Payment` | The manual ledger. Amount, method, reference, the period it covered, a sequential receipt number. Voiding keeps the row. |
| `SuperAdmin` | Platform operators. A separate table from `AdminUser`: a restaurant owner can never become one. |
| `AuditLog` | Who did what to which restaurant. Not a foreign key, so it outlives a restaurant. |

## What a subscription allows

`computeAccess` in `src/tenancy/tenant-access.ts` is the only place that decides. It returns one of four states.

| State | When | Public menu | Owner admin |
| --- | --- | --- | --- |
| ok | paid, or no end date | served | full |
| trial | trial running | served | full, banner with the days left |
| grace | the end passed but not the grace days | served | full, red banner with the days until offline |
| blocked | grace over, or suspended, or canceled | answers 503 with a friendly page, out of the sitemap, manifest 404 | read only, every change answers 402, sign out and the billing page still work |

Owners can preview their own menu while blocked. Nothing is ever deleted. A restaurant with no subscription row counts as ok, so anything created before billing keeps working.

## Limits and features

`TenancyService.assertCanAdd` runs on every create path: menus, categories, dishes (including duplicate and CSV rows, which become row errors) and owner accounts. `@RequiresFeature('analytics')` on a controller refuses the whole route, and the admin menu hides what the plan lacks. The WhatsApp selection list on the public menu follows the `whatsappOrdering` feature while the plain WhatsApp link stays.

## The platform area

Everything under `/super`, behind its own login and session fields, never mixed with the restaurant admin.

- Overview: restaurants by state, monthly recurring revenue (active paid plans, yearly counted per month), money received this and last month per currency, what ends within 7 days, the latest payments.
- Restaurants: search, filter by state, create (restaurant, first menu, subscription, owner account with a generated password shown once), then per restaurant: suspend, cancel, reactivate, change plan, edit dates and grace days, usage against limits, owner accounts (add, reset password, remove but never the last one), payments and activity.
- Plans: create, edit, archive and restore.
- Payments: record, filter by restaurant, method, status and dates, print receipts, void.
- Activity log.

Recording a payment extends the subscription from the end of time already paid for, or from the payment date when it had lapsed. A trial or overdue subscription becomes active. A suspended or canceled one keeps its status, because reactivating is a separate decision. Voiding never shortens the period, the operator edits the dates if they should change.

Create the first operator with `npm run super:create -- you@example.org "Your Name"`. It prints a generated password once, or uses `SUPER_ADMIN_PASSWORD` if set.

## Adding a payment provider

The ledger is the single place that extends a subscription: `PaymentsService.record`. A provider integration would verify its webhook, then call that method with the amount, `method: 'CARD'` and the provider's transaction id as `reference`. Idempotency on that reference, refunds (a void plus a provider call) and renewal reminders are the parts to add. No provider code exists today on purpose.

## Email

`MailService` sends through Gmail SMTP. Turn 2 step verification on the Google account, create an app password at https://myaccount.google.com/apppasswords and set `MAIL_USER` and `MAIL_APP_PASSWORD` (spaces are ignored), and optionally `MAIL_FROM`. With them unset nothing is sent, and production logs a warning at start.

Used for:
- Forgot password at `/admin/forgot`, which emails a link to `/admin/reset/:token`.
- The invitation an owner gets when the operator creates a restaurant or adds an account, so the owner can choose a password instead of keeping the generated one. The generated password is still shown to the operator once, as a fallback if the mail does not arrive.
- A reset link when the operator resets an owner's password.

## Reminders and receipts

An hourly check (`BillingScheduler`, off in tests and with `REMINDERS_ENABLED=false`) emails the **owners** of a restaurant, never cashiers or kitchen staff, in Arabic and English in one message:

| When | Email |
| --- | --- |
| A trial has 3 days or less left | trial ends soon |
| A paid plan has 7 days or less left (1 day or less sends the more urgent one instead) | plan ends |
| The period ended and the grace period began | plan ended, menu stays online until the date |
| The grace period is over | menu went offline (only for 14 days after, then it stops writing) |

Suspended or canceled restaurants are not emailed: that was the operator's decision. Each notice is recorded in `NotificationLog`, unique per restaurant, kind and ending date, and the row is claimed **before** sending, so running on several servers or twice never sends a duplicate. If nobody could be reached the row is removed and the next run tries again. A renewal moves the ending date, which starts a fresh set. The platform's restaurant page lists what was sent.

Recording a payment also emails the owners the receipt (number, amount, date, the period it covers, a link). A failed email never undoes a payment.

Links need `PUBLIC_BASE_URL`. The contact line uses `LANDING_CONTACT_WHATSAPP` or `LANDING_CONTACT_EMAIL`.

## Platform operator security

- **Two step verification (authenticator app).** Required in production, optional elsewhere (`SUPER_REQUIRE_2FA=true|false` overrides). In production an operator who signs in without one is held on `/super/security` until they set it up. Codes are standard 6 digit TOTP, each code works once, five wrong codes lock the step for 15 minutes, and 10 single use recovery codes are given at setup (stored as hashes). The secret is stored encrypted with a key derived from `SESSION_SECRET`, so rotating `SESSION_SECRET` means operators set 2FA up again.
- **Forgot password** at `/super/forgot`, with at least 12 characters. A reset link changes the password only, it never bypasses the authenticator, and an owner's link does not work on the platform side or the other way round.
- **Change password** on the security page, which signs the operator out everywhere.
- **IP allowlist.** `SUPER_ALLOWED_IPS=203.0.113.7,198.51.100.0/24` makes `/super` answer a plain 404 to every other address, including the login page. It uses the address Express sees, so set `TRUST_PROXY` correctly behind a proxy. Restaurant owners and the public menu are unaffected. Do not set it before you know your own address, or you lock yourself out (clear the variable and restart).
- **Lost phone and recovery codes.** `npm run super:create -- you@example.org "Your Name" --reset-2fa` turns the authenticator off for that account, with a new password printed.

## Left for later

- Support sign in as an owner.
- Per plan branding limits and per tenant domains.
