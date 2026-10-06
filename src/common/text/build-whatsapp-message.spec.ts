import { buildWhatsAppMessage, buildWhatsAppUrl } from './build-whatsapp-message';

const labels = {
  messageTableLine: 'Table: {name}',
  messageItemLine: '{qty}x {name}: {price} {currency}',
  messageNoteLine: 'Note: {note}',
  messageTotalLine: 'Total: {total} {currency}',
  disclaimer: 'This is a message, not an online order or payment.',
};

describe('buildWhatsAppMessage', () => {
  it('includes the restaurant name, items, and total', () => {
    const message = buildWhatsAppMessage({
      restaurantName: 'Bayt Al-Zaytoun',
      tableLabel: null,
      items: [{ name: 'Arabic Coffee', quantity: 2, priceFormatted: '12.00', currency: 'ILS' }],
      note: '',
      totalFormatted: '24.00',
      currency: 'ILS',
      labels,
    });

    expect(message).toContain('Bayt Al-Zaytoun');
    expect(message).toContain('2x Arabic Coffee: 12.00 ILS');
    expect(message).toContain('Total: 24.00 ILS');
    expect(message).toContain('This is a message, not an online order or payment.');
  });

  it('omits the table line when there is no table', () => {
    const message = buildWhatsAppMessage({
      restaurantName: 'Bayt Al-Zaytoun',
      tableLabel: null,
      items: [],
      note: '',
      totalFormatted: '0.00',
      currency: 'ILS',
      labels,
    });
    expect(message).not.toContain('Table:');
  });

  it('includes the table line when a table is set', () => {
    const message = buildWhatsAppMessage({
      restaurantName: 'Bayt Al-Zaytoun',
      tableLabel: '5',
      items: [],
      note: '',
      totalFormatted: '0.00',
      currency: 'ILS',
      labels,
    });
    expect(message).toContain('Table: 5');
  });

  it('omits the note line when the note is blank or whitespace', () => {
    const message = buildWhatsAppMessage({
      restaurantName: 'X',
      tableLabel: null,
      items: [],
      note: '   ',
      totalFormatted: '0.00',
      currency: 'ILS',
      labels,
    });
    expect(message).not.toContain('Note:');
  });

  it('includes a trimmed note when present', () => {
    const message = buildWhatsAppMessage({
      restaurantName: 'X',
      tableLabel: null,
      items: [],
      note: '  extra spicy  ',
      totalFormatted: '0.00',
      currency: 'ILS',
      labels,
    });
    expect(message).toContain('Note: extra spicy');
  });

  it('lists every item, each on its own line', () => {
    const message = buildWhatsAppMessage({
      restaurantName: 'X',
      tableLabel: null,
      items: [
        { name: 'Coffee', quantity: 1, priceFormatted: '10.00', currency: 'ILS' },
        { name: 'Knafeh', quantity: 3, priceFormatted: '20.00', currency: 'ILS' },
      ],
      note: '',
      totalFormatted: '70.00',
      currency: 'ILS',
      labels,
    });
    expect(message).toContain('1x Coffee: 10.00 ILS');
    expect(message).toContain('3x Knafeh: 20.00 ILS');
  });
});

describe('buildWhatsAppUrl', () => {
  it('appends the URL-encoded message as a text query param', () => {
    const url = buildWhatsAppUrl('https://wa.me/970599000000', 'Hello & welcome');
    expect(url).toBe('https://wa.me/970599000000?text=Hello%20%26%20welcome');
  });

  it('url-encodes Arabic text safely', () => {
    const url = buildWhatsAppUrl('https://wa.me/970599000000', 'قهوة');
    expect(url).toContain('https://wa.me/970599000000?text=');
    expect(decodeURIComponent(url.split('?text=')[1])).toBe('قهوة');
  });
});
