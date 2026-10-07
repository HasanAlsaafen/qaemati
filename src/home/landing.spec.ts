import { Plan } from '@prisma/client';
import { landingContact, toLandingPlans } from './landing';

const plan = (overrides: Partial<Record<keyof Plan, unknown>>): Plan =>
  ({
    id: 'p',
    nameAr: 'باقة',
    nameEn: 'Plan',
    descriptionAr: null,
    descriptionEn: null,
    priceAmount: 60,
    currency: 'ILS',
    interval: 'MONTHLY',
    trialDays: 0,
    maxMenus: null,
    maxCategories: null,
    maxItems: null,
    maxAdminUsers: null,
    features: [],
    isActive: true,
    sortOrder: 0,
    ...overrides,
  }) as unknown as Plan;

describe('landingContact', () => {
  it('builds a WhatsApp link from any phone format', () => {
    expect(landingContact({ LANDING_CONTACT_WHATSAPP: '+970 (599) 123-456' }).whatsappUrl).toBe(
      'https://wa.me/970599123456',
    );
  });

  it('ignores a number that is too short and an email that is not one', () => {
    expect(
      landingContact({ LANDING_CONTACT_WHATSAPP: '123', LANDING_CONTACT_EMAIL: 'nope' }),
    ).toEqual({ email: null, whatsappUrl: null });
  });

  it('keeps a valid email', () => {
    expect(landingContact({ LANDING_CONTACT_EMAIL: ' hi@example.org ' }).email).toBe(
      'hi@example.org',
    );
  });
});

describe('toLandingPlans', () => {
  it('formats price, interval and the chosen language', () => {
    const [ar, en] = [
      toLandingPlans([plan({ priceAmount: 60, interval: 'YEARLY' as Plan['interval'] })], 'ar')[0],
      toLandingPlans([plan({ priceAmount: 59.5 })], 'en')[0],
    ];
    expect(ar.name).toBe('باقة');
    expect(ar.price).toBe('60');
    expect(ar.interval).toBe('year');
    expect(en.price).toBe('59.50');
    expect(en.interval).toBe('month');
  });

  it('marks which features a plan has and keeps empty limits as unlimited', () => {
    const [p] = toLandingPlans([plan({ features: ['analytics'], maxMenus: 2 })], 'en');
    expect(p.features).toEqual({
      tableOrdering: false,
      whatsappOrdering: false,
      bulkTools: false,
      analytics: true,
    });
    expect(p.limits).toEqual({ menus: 2, categories: null, dishes: null, admins: null });
  });

  it('highlights the middle plan only when there are three or more', () => {
    const three = toLandingPlans([plan({ id: 'a' }), plan({ id: 'b' }), plan({ id: 'c' })], 'en');
    expect(three.map((p) => p.popular)).toEqual([false, true, false]);
    const two = toLandingPlans([plan({ id: 'a' }), plan({ id: 'b' })], 'en');
    expect(two.some((p) => p.popular)).toBe(false);
  });
});
