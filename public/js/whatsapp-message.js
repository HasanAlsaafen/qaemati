// Mirrors src/common/text/build-whatsapp-message.ts -- see that file for
// the tested canonical version and why this is duplicated rather than
// shared (same tradeoff as normalize-search-text.ts/menu.js).

function interpolate(template, args) {
  return Object.keys(args).reduce(
    (result, key) => result.split('{' + key + '}').join(args[key]),
    template,
  );
}

function buildWhatsAppMessage(input) {
  const lines = [input.restaurantName];

  if (input.tableLabel) {
    lines.push(interpolate(input.labels.messageTableLine, { name: input.tableLabel }));
  }

  lines.push('');

  input.items.forEach((item) => {
    lines.push(
      interpolate(input.labels.messageItemLine, {
        qty: String(item.quantity),
        name: item.name,
        price: item.priceFormatted,
        currency: item.currency,
      }),
    );
  });

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

function buildWhatsAppUrl(whatsappUrl, message) {
  return whatsappUrl + '?text=' + encodeURIComponent(message);
}
