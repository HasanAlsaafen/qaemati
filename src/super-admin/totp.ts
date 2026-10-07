import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'crypto';
import { getSessionSecret } from '../config/env.validation';

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function base32Encode(bytes: Buffer): string {
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5)
    out += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = '';
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Not base32');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function stepFor(timeMs: number): number {
  return Math.floor(timeMs / 1000 / STEP_SECONDS);
}

/** RFC 6238 over HMAC-SHA1, the variant every authenticator app supports. */
export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * Returns the step the code matched, or null. One step either side is allowed
 * for clock drift. A step at or before `lastStep` is refused, so a code that
 * was just used (or shoulder surfed) cannot be replayed.
 */
export function verifyTotp(
  secret: string,
  code: string,
  lastStep: number | null,
  timeMs: number = Date.now(),
): number | null {
  const cleaned = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return null;
  const now = stepFor(timeMs);
  let matched: number | null = null;
  for (const step of [now - 1, now, now + 1]) {
    const expected = Buffer.from(totpAt(secret, step));
    // Every candidate is compared, so the time taken does not say which one matched.
    if (timingSafeEqual(expected, Buffer.from(cleaned)) && matched === null) matched = step;
  }
  if (matched === null || (lastStep !== null && matched <= lastStep)) return null;
  return matched;
}

export function otpauthUri(secret: string, account: string, issuer = 'Qaemati'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

const key = (): Buffer => createHash('sha256').update(`totp:${getSessionSecret()}`).digest();

/** AES-256-GCM, so a copy of the database alone does not give away the secrets. */
export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    let code = '';
    for (let i = 0; i < 10; i++) code += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

export const hashRecoveryCode = (code: string): string =>
  createHash('sha256').update(code.replace(/[\s-]/g, '').toLowerCase()).digest('hex');
