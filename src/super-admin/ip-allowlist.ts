import { isIP } from 'net';

/** "::ffff:1.2.3.4" is the same address as "1.2.3.4". */
function normalize(ip: string): string {
  return ip.toLowerCase().replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, '$1');
}

function ipv4ToNumber(ip: string): number {
  return ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);
}

/**
 * Entries are exact addresses (IPv4 or IPv6) or IPv4 ranges such as
 * 203.0.113.0/24. An empty list allows everyone.
 */
export function parseAllowlist(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => normalize(entry.trim()))
    .filter(Boolean);
}

export function isAllowedIp(ip: string | undefined, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  if (!ip) return false;
  const address = normalize(ip);
  return allowlist.some((entry) => {
    if (!entry.includes('/')) return entry === address;
    const [base, bitsText] = entry.split('/');
    const bits = Number(bitsText);
    if (
      isIP(base) !== 4 ||
      isIP(address) !== 4 ||
      !Number.isInteger(bits) ||
      bits < 0 ||
      bits > 32
    ) {
      return false;
    }
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ipv4ToNumber(base) & mask) >>> 0 === (ipv4ToNumber(address) & mask) >>> 0;
  });
}
