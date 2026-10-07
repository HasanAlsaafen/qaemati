import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUri,
  stepFor,
  totpAt,
  verifyTotp,
} from './totp';

// RFC 6238 appendix B: the SHA1 secret is the ASCII text 12345678901234567890.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
  it('matches the RFC 6238 test vectors', () => {
    expect(totpAt(RFC_SECRET, stepFor(59_000))).toBe('287082');
    expect(totpAt(RFC_SECRET, stepFor(1_111_111_109_000))).toBe('081804');
    expect(totpAt(RFC_SECRET, stepFor(1_234_567_890_000))).toBe('005924');
    expect(totpAt(RFC_SECRET, stepFor(20_000_000_000_000))).toBe('353130');
  });

  it('round trips base32', () => {
    const bytes = Buffer.from('hello world, 123');
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('accepts the current code and one step of drift each way, not more', () => {
    const t = 1_700_000_000_000;
    const step = stepFor(t);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step), null, t)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), null, t)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 1), null, t)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 2), null, t)).toBeNull();
  });

  it('refuses a code whose step was already used', () => {
    const t = 1_700_000_000_000;
    const step = stepFor(t);
    const code = totpAt(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, step, t)).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, step - 1, t)).toBe(step);
  });

  it.each(['', '12345', '1234567', 'abcdef', '12 345'])('refuses the malformed code %p', (code) => {
    expect(verifyTotp(RFC_SECRET, code, null, 1_700_000_000_000)).toBeNull();
  });

  it('tolerates spaces typed in the middle of a valid code', () => {
    const t = 1_700_000_000_000;
    const code = totpAt(RFC_SECRET, stepFor(t));
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, null, t)).not.toBeNull();
  });

  it('builds an otpauth address that authenticator apps read', () => {
    const uri = otpauthUri('ABC234', 'me@example.com');
    expect(uri).toBe(
      'otpauth://totp/Qaemati%3Ame%40example.com?secret=ABC234&issuer=Qaemati&algorithm=SHA1&digits=6&period=30',
    );
  });

  it('encrypts a secret so it is not readable and decrypts it back', () => {
    const secret = generateTotpSecret();
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored)).toBe(secret);
    expect(encryptSecret(secret)).not.toBe(stored);
  });

  it('refuses a tampered stored secret', () => {
    const [iv, tag, data] = encryptSecret('ABCDEFGH').split('.');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    expect(() => decryptSecret([iv, tag, flipped.toString('base64')].join('.'))).toThrow();
  });

  it('makes ten distinct recovery codes whose hash ignores case and the dash', () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/);
    expect(hashRecoveryCode(codes[0])).toBe(
      hashRecoveryCode(codes[0].toUpperCase().replace('-', ' ')),
    );
    expect(hashRecoveryCode(codes[0])).not.toBe(hashRecoveryCode(codes[1]));
  });
});
