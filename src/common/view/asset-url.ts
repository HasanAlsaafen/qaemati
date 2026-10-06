import { statSync } from 'fs';
import { join } from 'path';

const PUBLIC_DIR = join(__dirname, '..', '..', '..', 'public');
const cache = new Map<string, string>();

/**
 * "/css/app.css" becomes "/css/app.css?v=<mtime>". The files are not named
 * by content hash, so without this a browser (or the service worker) that
 * already holds an older copy keeps using it after a deploy while the HTML
 * has moved on. Cached per process in production, recomputed in development
 * so a rebuilt stylesheet is picked up straight away.
 */
export function assetUrl(path: string): string {
  const cached = process.env.NODE_ENV === 'production' ? cache.get(path) : undefined;
  if (cached) return cached;
  let versioned = path;
  try {
    versioned = `${path}?v=${Math.floor(statSync(join(PUBLIC_DIR, path)).mtimeMs).toString(36)}`;
  } catch {
    // A missing file keeps its plain URL and 404s the same as before.
  }
  cache.set(path, versioned);
  return versioned;
}
