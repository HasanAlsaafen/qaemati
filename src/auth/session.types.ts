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
  /** The address a sign in link was emailed to, when mail is configured. */
  mailedTo?: string;
}

declare module 'express-session' {
  interface SessionData {
    adminUserId?: string;
    restaurantId?: string;
    restaurantSlug?: string;
    adminName?: string;
    /** OWNER, CASHIER or KITCHEN. A session from before roles existed has none and was an owner. */
    adminRole?: 'OWNER' | 'CASHIER' | 'KITCHEN';
    /** A5: cached once at login (see auth.controller.ts) rather than
     *  re-queried on every admin page request. */
    hasSeenTour?: boolean;
    /** Platform operators. Never set together with adminUserId. */
    superAdminId?: string;
    superAdminName?: string;
    /** Whether this operator signed in with an authenticator code. */
    superTwoFactor?: boolean;
    /** Password was right, the authenticator code is still to come. */
    pendingSuperAdminId?: string;
    pendingSuperAdminAt?: number;
    /** A secret being set up, encrypted, until its first code is confirmed. */
    pendingTotpSecret?: string;
    /** One message carried across a redirect, see FlashMiddleware. */
    flash?: Flash;
  }
}
