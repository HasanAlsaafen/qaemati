import QRCode from 'qrcode';
import { Request } from 'express';

/**
 * A table's code carries its unguessable token, not its name, so the menu can
 * tell a real scan from someone typing a table name into the address.
 *
 * Built from the request's own protocol/host rather than a configured base
 * URL, so QR codes always point at wherever this instance is actually
 * reachable (localhost in dev, whatever domain it's deployed behind) without
 * needing a separate env var to keep in sync.
 */
export function buildMenuUrl(req: Request, slug: string, tableToken?: string): string {
  const base = `${req.protocol}://${req.get('host')}/m/${slug}`;
  return tableToken ? `${base}?t=${encodeURIComponent(tableToken)}` : base;
}

/**
 * Inline SVG markup (not a PNG data URL or a saved file): scales crisp at
 * any print size, costs nothing to regenerate per-request for the handful
 * of tables a demo restaurant has, and needs no upload-style file lifecycle
 * management.
 */
export function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 1 });
}
