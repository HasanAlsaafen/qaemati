import 'express-session';

declare module 'express-session' {
  interface SessionData {
    adminUserId?: string;
    restaurantId?: string;
    restaurantSlug?: string;
    adminName?: string;
    /** A5: cached once at login (see auth.controller.ts) rather than
     *  re-queried on every admin page request. */
    hasSeenTour?: boolean;
  }
}
