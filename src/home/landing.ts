import { Plan } from '@prisma/client';
import { currencySymbol } from '../common/currency';

export interface LandingContact {
  email: string | null;
  whatsappUrl: string | null;
}

/** Where "get in touch" points. Both optional, the page copes with neither. */
export function landingContact(env: NodeJS.ProcessEnv = process.env): LandingContact {
  const email = env.LANDING_CONTACT_EMAIL?.trim() || null;
  const digits = (env.LANDING_CONTACT_WHATSAPP ?? '').replace(/\D/g, '');
  return {
    email: email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null,
    whatsappUrl: digits.length >= 8 ? `https://wa.me/${digits}` : null,
  };
}

export interface LandingPlan {
  id: string;
  name: string;
  description: string | null;
  price: string;
  symbol: string;
  interval: 'month' | 'year';
  trialDays: number;
  limits: {
    menus: number | null;
    categories: number | null;
    dishes: number | null;
    admins: number | null;
  };
  features: Record<string, boolean>;
  popular: boolean;
}

const ALL_FEATURES = ['tableOrdering', 'whatsappOrdering', 'bulkTools', 'analytics'];

/** The plans a visitor can choose from, shaped for the page. The middle one of three or more is highlighted. */
export function toLandingPlans(plans: Plan[], locale: 'ar' | 'en'): LandingPlan[] {
  return plans.map((plan, index) => ({
    id: plan.id,
    name: locale === 'ar' ? plan.nameAr : plan.nameEn,
    description: (locale === 'ar' ? plan.descriptionAr : plan.descriptionEn) || null,
    price: Number(plan.priceAmount).toFixed(2).replace(/\.00$/, ''),
    symbol: currencySymbol(plan.currency, locale),
    interval: plan.interval === 'YEARLY' ? 'year' : 'month',
    trialDays: plan.trialDays,
    limits: {
      menus: plan.maxMenus,
      categories: plan.maxCategories,
      dishes: plan.maxItems,
      admins: plan.maxAdminUsers,
    },
    features: Object.fromEntries(ALL_FEATURES.map((f) => [f, plan.features.includes(f)])),
    popular: plans.length >= 3 && index === 1,
  }));
}
