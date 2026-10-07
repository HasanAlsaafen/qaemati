/**
 * The Thmanyah font license forbids making the font files downloadable from a
 * website unless thmanyah grants it separately (ask@thmanyah.com). So the files
 * are served on a developer's machine, and in production only once the owner
 * sets THMANYAH_WEB_LICENSED=true to confirm they have that permission. Without
 * it the landing page falls back to Tajawal and nothing is served.
 */
export function thmanyahEnabled(): boolean {
  return process.env.THMANYAH_WEB_LICENSED === 'true' || process.env.NODE_ENV !== 'production';
}
