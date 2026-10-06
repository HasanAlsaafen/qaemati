import { Request } from 'express';

/**
 * Absolute origin used in canonical, Open Graph and sitemap URLs.
 * PUBLIC_BASE_URL wins when set, because the Host header is client
 * controlled and a canonical built from it can be poisoned behind a
 * proxy that does not pin the host.
 */
export function getBaseUrl(req: Pick<Request, 'protocol' | 'get'>): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

export function toAbsoluteUrl(baseUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Serialized for a <script type="application/ld+json"> block; "<" is
 *  escaped so a restaurant name can never close the script tag. */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export interface RestaurantJsonLdInput {
  name: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  menuUrl: string;
  telephone: string | null;
  instagramUrl: string | null;
}

export function buildRestaurantJsonLd(input: RestaurantJsonLdInput): string {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: input.name,
    url: input.url,
    hasMenu: input.menuUrl,
  };
  if (input.description) data.description = input.description;
  if (input.imageUrl) data.image = input.imageUrl;
  if (input.telephone) data.telephone = input.telephone;
  if (input.instagramUrl) data.sameAs = [input.instagramUrl];
  return serializeJsonLd(data);
}
