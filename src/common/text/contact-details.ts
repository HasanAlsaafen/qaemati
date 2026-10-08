/**
 * The details a guest gives when sending a WhatsApp order: who they are, how to
 * reach them, and where. This is the canonical, tested version.
 * `public/js/guest-contact.js` mirrors it in the browser, like the message
 * builder does (there is no bundler to share one file). Keep the two in sync.
 */

export interface ContactInput {
  name: string;
  phone: string;
  address: string;
  /** A position the phone reported, when the guest chose to share it. */
  pin: { lat: number; lng: number } | null;
}

export interface Contact {
  name: string;
  /** Digits with an optional leading +, ready for a person to dial. */
  phone: string;
  address: string;
  mapUrl: string;
}

export type ContactField = 'name' | 'phone' | 'location';
export type ContactResult =
  { ok: true; contact: Contact } | { ok: false; errors: Partial<Record<ContactField, string>> };

/** Arabic-Indic (U+0660) and Eastern Arabic-Indic (U+06F0) digits are the same numbers as 0 to 9. */
export function westernDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** One line of plain text: no line breaks or control characters, single spaces. */
// Built from a string so the line separators stay escapes and cannot be mangled into real line breaks.
const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]+', 'g');

export function cleanLine(value: string, max: number): string {
  return value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Spaces, dashes, dots, brackets and the invisible direction marks a phone adds in right to left text.
const PHONE_NOISE = new RegExp('[\\s().\\-\\u200e\\u200f]', 'g');

export function normalizePhone(value: string): string {
  const text = westernDigits(value).replace(PHONE_NOISE, '');
  return text.startsWith('00') ? `+${text.slice(2)}` : text;
}

export function isValidPhone(phone: string): boolean {
  return /^\+?\d{7,15}$/.test(phone);
}

export function mapUrl(pin: { lat: number; lng: number }): string {
  return `https://maps.google.com/?q=${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
}

const validPin = (pin: ContactInput['pin']): pin is { lat: number; lng: number } =>
  !!pin &&
  Number.isFinite(pin.lat) &&
  Number.isFinite(pin.lng) &&
  Math.abs(pin.lat) <= 90 &&
  Math.abs(pin.lng) <= 180;

/**
 * Name and phone are needed to reach the guest, and the restaurant needs to
 * know where they are: a shared position, a typed address, or both.
 */
export function validateContact(input: ContactInput): ContactResult {
  const errors: Partial<Record<ContactField, string>> = {};
  const name = cleanLine(input.name, 60);
  const phone = normalizePhone(input.phone);
  const address = cleanLine(input.address, 200);
  const pin = validPin(input.pin) ? input.pin : null;

  if (name.length < 2) errors.name = 'nameRequired';
  if (!isValidPhone(phone)) errors.phone = 'phoneInvalid';
  if (!pin && address.length < 3) errors.location = 'locationRequired';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, contact: { name, phone, address, mapUrl: pin ? mapUrl(pin) : '' } };
}
