/**
 * The symbol a price is shown with next to the number: ₪ for ILS, $ for USD,
 * and so on. Currencies Intl has no short symbol for (JOD in English) keep
 * their code, which is what shoppers expect to see.
 */
export function currencySymbol(code: string, locale: 'ar' | 'en'): string {
  try {
    const parts = new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    const symbol = parts.find((part) => part.type === 'currency')?.value ?? code;
    // Intl wraps right to left symbols in direction marks.
    return symbol.replace(/[‎‏؜]/g, '').trim() || code;
  } catch {
    return code;
  }
}
