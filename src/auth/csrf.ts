import { doubleCsrf } from 'csrf-csrf';
import { Request } from 'express';

/**
 * Double-submit-cookie CSRF protection. Needs express-session mounted
 * first (getSessionIdentifier reads req.session.id). The token travels
 * either as a hidden form field (plain POSTs: login, category/item forms)
 * or as a request header (htmx partial updates, set via hx-headers).
 */
export const { doubleCsrfProtection, generateCsrfToken, invalidCsrfTokenError } = (() => {
  const { doubleCsrfProtection, generateToken, invalidCsrfTokenError } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET ?? 'change-me-in-production',
    getSessionIdentifier: (req: Request) => req.session.id,
    cookieName: 'qaemati_csrf',
    cookieOptions: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
    // htmx requests carry the token as a header (set once, globally, via
    // hx-headers on <body> in layouts/admin.njk); plain <form method="post">
    // submissions (login, create/delete forms) carry it as a hidden field.
    getTokenFromRequest: (req: Request) =>
      (req.headers['x-csrf-token'] as string | undefined) ??
      ((req.body as Record<string, unknown> | undefined)?.['csrf_token'] as string | undefined),
  });

  return { doubleCsrfProtection, generateCsrfToken: generateToken, invalidCsrfTokenError };
})();
