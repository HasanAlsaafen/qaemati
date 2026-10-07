import { randomInt } from 'crypto';

// No look alike characters (0 O 1 l I), so a password read from a screen or a
// message is typed correctly the first time.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
