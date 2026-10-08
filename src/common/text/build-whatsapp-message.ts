/**
 * Builds the plain-text WhatsApp message for a customer's selection. This
 * is the canonical, tested implementation; `public/js/whatsapp-message.js`
 * mirrors it for client-side use (the selection itself lives in
 * localStorage, built entirely client-side -- same duplication tradeoff as
 * normalize-search-text.ts/menu.js, documented there). Keep the two in
 * sync by hand; there is no bundler in this stack to share one module
 * between server and browser.
 */

import { Contact } from './contact-details';

export interface SelectionItem {
  name: string;
  quantity: number;
  priceFormatted: string;
  currency: string;
}

export interface BuildWhatsAppMessageInput {
  restaurantName: string;
  tableLabel: string | null;
  items: SelectionItem[];
  note: string;
  /** Who is ordering, when the restaurant asked for it (WhatsApp orders from outside a table). */
  contact?: Contact | null;
  totalFormatted: string;
  currency: string;
  labels: {
    messageTableLine: string; // "Table: {name}"
    messageItemLine: string; // "{qty}x {name}: {price} {currency}"
    messageNoteLine: string; // "Note: {note}"
    messageNameLine?: string; // "Name: {name}"
    messagePhoneLine?: string; // "Phone: {phone}"
    messageAddressLine?: string; // "Address: {address}"
    messageLocationLine?: string; // "Location: {url}"
    messageTotalLine: string; // "Total: {total} {currency}"
    disclaimer: string;
  };
}

function interpolate(template: string, args: Record<string, string>): string {
  return Object.entries(args).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

export function buildWhatsAppMessage(input: BuildWhatsAppMessageInput): string {
  const lines: string[] = [input.restaurantName];

  if (input.tableLabel) {
    lines.push(interpolate(input.labels.messageTableLine, { name: input.tableLabel }));
  }

  if (input.contact) {
    const { name, phone, address, mapUrl } = input.contact;
    const labels = input.labels;
    if (labels.messageNameLine) lines.push(interpolate(labels.messageNameLine, { name }));
    if (labels.messagePhoneLine) lines.push(interpolate(labels.messagePhoneLine, { phone }));
    if (address && labels.messageAddressLine) {
      lines.push(interpolate(labels.messageAddressLine, { address }));
    }
    if (mapUrl && labels.messageLocationLine) {
      lines.push(interpolate(labels.messageLocationLine, { url: mapUrl }));
    }
  }

  lines.push('');

  for (const item of input.items) {
    lines.push(
      interpolate(input.labels.messageItemLine, {
        qty: String(item.quantity),
        name: item.name,
        price: item.priceFormatted,
        currency: item.currency,
      }),
    );
  }

  if (input.note.trim()) {
    lines.push('');
    lines.push(interpolate(input.labels.messageNoteLine, { note: input.note.trim() }));
  }

  lines.push('');
  lines.push(
    interpolate(input.labels.messageTotalLine, {
      total: input.totalFormatted,
      currency: input.currency,
    }),
  );

  lines.push('');
  lines.push(input.labels.disclaimer);

  return lines.join('\n');
}

export function buildWhatsAppUrl(whatsappUrl: string, message: string): string {
  return `${whatsappUrl}?text=${encodeURIComponent(message)}`;
}
