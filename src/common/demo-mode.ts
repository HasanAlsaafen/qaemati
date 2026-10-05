/** A5: gates the "Try the admin panel" panel and the "Reset demo data"
 *  action -- both are demo-environment-only, never shown/reachable in a
 *  real deployment unless this env var is explicitly set. */
export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE === 'true';
}
