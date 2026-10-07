import 'express-session';

export interface Flash {
  type: 'success' | 'danger';
  message: string;
  /** Field name to message, shown under the inputs after a failed submit. */
  errors?: Record<string, string>;
  /** What was typed, so the form can be filled in again. Never a password. */
  values?: Record<string, unknown>;
  /** Shown once, for example a generated password. */
  secret?: { label: string; value: string };
}

declare module 'express-session' {
  interface SessionData {
    adminUserId?: string;
    restaurantId?: string;
    restaurantSlug?: string;
    adminName?: string;
    /** A5: cached once at login (see auth.controller.ts) rather than
     *  re-queried on every admin page request. */
    hasSeenTour?: boolean;
    /** Platform operators. Never set together with adminUserId. */
    superAdminId?: string;
    superAdminName?: string;
    /** One message carried across a redirect, see FlashMiddleware. */
    flash?: Flash;
  }
}
