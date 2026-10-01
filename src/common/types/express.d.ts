import { Locale } from '../middleware/locale-view.middleware';

declare global {
  namespace Express {
    interface Request {
      locale?: Locale;
    }
  }
}

export {};
