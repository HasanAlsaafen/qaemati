/**
 * Contact link helpers shared by the admin validation and the public menu,
 * so what the owner is allowed to save is exactly what the page can link to.
 */

const PHONE_PATTERN = /^\+?[0-9(][0-9 ()-]{5,19}$/;
const FACEBOOK_HANDLE_PATTERN = /^[A-Za-z0-9.\-_]{3,80}$/;
const FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'fb.com',
  'www.fb.com',
]);

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value.trim());
}

/** "+970 (2) 222-0111" becomes "tel:+97022220111". */
export function toTelUrl(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, '');
  return `tel:${digits}`;
}

function parseHttps(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** A bare page handle, or a full https link on a Facebook host. */
export function isValidFacebook(value: string): boolean {
  const trimmed = value.trim();
  if (FACEBOOK_HANDLE_PATTERN.test(trimmed)) return true;
  const url = parseHttps(trimmed);
  return url !== null && FACEBOOK_HOSTS.has(url.hostname.toLowerCase());
}

export function toFacebookUrl(value: string): string {
  const trimmed = value.trim();
  return FACEBOOK_HANDLE_PATTERN.test(trimmed) ? `https://facebook.com/${trimmed}` : trimmed;
}

/** Any https link, so the owner can paste whichever map service they use. */
export function isValidMapUrl(value: string): boolean {
  return parseHttps(value) !== null;
}
