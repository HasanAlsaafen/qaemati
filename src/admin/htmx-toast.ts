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
  // HTTP header values must be Latin-1/ASCII -- Node's http module throws
  // ERR_INVALID_CHAR on anything outside that range. Every Arabic toast
  // message (i.e. every toast for an Arabic-locale request, which is this
  // app's default locale) crashed the whole request with a 500 until this
  // was encodeURIComponent'd; toast.njk's client-side handler decodes it
  // back before display. Found by the Phase 9 e2e test suite -- every
  // manual browser test up to this point happened to resolve to the
  // English locale for htmx calls regardless of the displayed page's
  // language, since Chrome's Accept-Language header wins over the
  // request's lack of a lang query param, so this never surfaced visibly.
  res.setHeader(
    'HX-Trigger',
    JSON.stringify({ toast: { message: encodeURIComponent(message), variant } }),
  );
}
