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
