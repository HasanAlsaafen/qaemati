import { Response } from 'express';

/**
 * Fires the shared toast (components/toast.njk) on the client after an
 * htmx response lands, by setting the HX-Trigger response header. htmx
 * dispatches a DOM CustomEvent named "toast" on the swap target, which
 * bubbles to window -- where the toast host's x-on:toast.window listener
 * picks it up, same as a client-dispatched toast.
 */
export function triggerToast(
  res: Response,
  message: string,
  variant: 'success' | 'warning' | 'danger' | 'neutral' = 'success',
): void {
  res.setHeader('HX-Trigger', JSON.stringify({ toast: { message, variant } }));
}
