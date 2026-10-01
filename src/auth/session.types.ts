import 'express-session';

declare module 'express-session' {
  interface SessionData {
    adminUserId?: string;
    restaurantId?: string;
    restaurantSlug?: string;
    adminName?: string;
  }
}
