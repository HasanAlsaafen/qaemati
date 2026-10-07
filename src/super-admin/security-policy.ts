import { parseAllowlist } from './ip-allowlist';

/**
 * Operators must use an authenticator app in production. Elsewhere it is
 * optional so local work and the demo are not slowed down. SUPER_REQUIRE_2FA
 * (true or false) overrides either default.
 */
export function requireTwoFactor(): boolean {
  const setting = process.env.SUPER_REQUIRE_2FA;
  if (setting === 'true') return true;
  if (setting === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export const allowedIps = (): string[] => parseAllowlist(process.env.SUPER_ALLOWED_IPS);

export const MIN_OPERATOR_PASSWORD = 12;
