import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { configureNunjucks } from './common/view/nunjucks';
import { doubleCsrfProtection } from './auth/csrf';
import { ITEM_IMAGE_UPLOAD_DIR } from './admin/upload.config';
import { LocaleViewMiddleware } from './common/middleware/locale-view.middleware';
import './auth/session.types';

/**
 * Everything `main.ts` does to an app instance before `listen()` -- pulled
 * out so e2e tests can apply the exact same middleware stack (session,
 * CSRF, locale, body-parsing order) instead of hitting the app through a
 * thinner, drifting approximation of production. The middleware ordering
 * here is load-bearing (see the inline comments) and was the source of
 * several Phase 4 bugs when it drifted even slightly.
 */
export async function configureApp(app: NestExpressApplication): Promise<void> {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Alpine.js evaluates x-data/x-show/etc expressions with `new
          // Function(...)`, which the default CSP's script-src blocks.
          // There is no way around this short of precompiling every
          // template's Alpine expressions, so unsafe-eval is allowed only
          // for same-origin scripts (nothing external is ever loaded).
          'script-src': ["'self'", "'unsafe-eval'"],
        },
      },
      // Helmet's default is "no-referrer", which strips the Referer header
      // entirely. The language switch (LocaleController) depends on Referer
      // to know which page to redirect back to. "same-origin" still sends
      // it for our own navigations (fixing that) while never leaking it
      // cross-origin, which is more private than the browser's own default
      // policy, and makes the Referer value safe to trust for a redirect
      // target (a cross-origin request can never produce one).
      referrerPolicy: { policy: 'same-origin' },
    }),
  );
  // gzip/brotli everything. Express sends no Content-Encoding by default,
  // and our HTML/CSS are mostly repeated Tailwind class names and JSON,
  // which compress extremely well (found via a Lighthouse run showing a
  // ~90KB uncompressed menu page).
  app.use(compression());
  app.use(cookieParser());
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      // Font files never change in place; the service worker must always
      // be revalidated or a bad release can never be replaced.
      if (filePath.includes(`${join('public', 'fonts')}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  });

  // Nest applies its own default body parsers (express.json/urlencoded)
  // later than these explicit app.use() calls -- the same "module
  // middleware runs after main.ts's own app.use() calls" ordering noted
  // elsewhere in this file. doubleCsrfProtection below reads req.body for
  // the login/create/etc forms' csrf_token field, so it needs urlencoded
  // parsing to have already run; without this, req.body was still `{}`
  // when CSRF checked it, failing every plain-form POST with "invalid csrf
  // token" even when the token was correct.
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Applied here, directly, rather than left to AppModule's Nest-managed
  // middleware chain (which runs *after* everything below): session and
  // CSRF setup can themselves throw (invalid/expired CSRF token), and the
  // global exception filter's error page needs `t` from this middleware to
  // render at all. If this ran later, an error here would itself crash
  // trying to render the error page -- found exactly that way, as a 500
  // whose own error page failed with "Unable to call `t`".
  app.use(app.get(LocaleViewMiddleware).use.bind(app.get(LocaleViewMiddleware)));

  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET ?? 'change-me-in-production',
      resave: false,
      // CSRF validation ties a token to req.session.id (see auth/csrf.ts).
      // With saveUninitialized: false, an anonymous visitor's session is
      // never persisted, so express-session hands out a fresh, unstable id
      // on every request until something saves it -- meaning the id used
      // to generate a token when the login page is rendered never matches
      // the id seen when that form is submitted, and CSRF validation fails
      // on the login form itself every time. true establishes a stable,
      // cookied session from the first request.
      saveUninitialized: true,
      name: 'qaemati_session',
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }),
  );
  app.use(doubleCsrfProtection);

  configureNunjucks(app);
  mkdirSync(ITEM_IMAGE_UPLOAD_DIR, { recursive: true });
}
