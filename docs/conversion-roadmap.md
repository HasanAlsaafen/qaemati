# Conversion roadmap

The seams already exist. This lists what to build on each one, in order.

1. **Environment.** Set `NODE_ENV=production`, real `SESSION_SECRET` and `CSRF_SECRET`, and `PUBLIC_BASE_URL` so canonical, Open Graph and sitemap URLs use your domain and never the request Host header. Set `DEMO_MODE=false` to remove the demo credentials from the home page.
2. **Hosting.** Run `npm run build`, then `npm start`. Put it behind a TLS proxy. Point uptime checks at `/health` (returns 503 when the database is down).
3. **Tenants.** Each restaurant is a `Restaurant` row, created from the platform area at `/super` with its first menu, subscription and owner account. A public self signup flow is the next step if you want one. See `docs/saas-architecture.md`.
4. **Home page.** Replace the demo index at `src/home/home.controller.ts` with a real landing page, or redirect `/` to a marketing site.
5. **Custom domains.** Resolve the restaurant from the Host header in `MenuController` before falling back to the slug. Update `getBaseUrl` in `src/seo/seo.ts` to return that domain.
6. **Images.** Uploads go to `public/uploads` (`src/admin/upload.config.ts`). Move to object storage and a resizing step before running more than one instance.
7. **Sessions and rate limits.** Sessions already live in Postgres, so multiple instances work. Rate limits (the login limiter and the POST limiter) count in the `RateLimitBucket` table, so every instance and every restart agree. Set `TRUST_PROXY` behind a proxy so limits apply per client.
8. **Orders and reservations.** The selection list builds a WhatsApp message client side (`public/js/selection.js`, mirrored by `src/common/text/build-whatsapp-message.ts`). A real order flow would add an `Order` model and a POST endpoint behind the same CSRF and validation setup the admin forms use.
9. **Analytics.** Menu and item views are recorded (`src/admin/analytics.service.ts`). Add events for selection sends before adding a third party tool, and update the CSP in `src/bootstrap.ts` if you do.
10. **Logging.** Production already logs JSON lines (`src/common/logging/json-logger.ts`) plus an access log. Point your log shipper at stdout.
