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

describe('buildWhatsAppMessage with the customer details', () => {
  const withContact = {
    ...labels,
    messageNameLine: 'Name: {name}',
    messagePhoneLine: 'Phone: {phone}',
    messageAddressLine: 'Address: {address}',
    messageLocationLine: 'Location: {url}',
  };
  const base = {
    restaurantName: 'Bayt Al-Zaytoun',
    tableLabel: null,
    items: [{ name: 'Falafel', quantity: 1, priceFormatted: '8.00', currency: 'ILS' }],
    note: '',
    totalFormatted: '8.00',
    currency: 'ILS',
  };

  it('puts who is ordering, how to reach them and where right under the restaurant name', () => {
    const message = buildWhatsAppMessage({
      ...base,
      labels: withContact,
      contact: {
        name: 'Dana',
        phone: '+970599123456',
        address: 'Building 4, second floor',
        mapUrl: 'https://maps.google.com/?q=31.5,35.1',
      },
    });
    const lines = message.split('\n');
    expect(lines.slice(0, 5)).toEqual([
      'Bayt Al-Zaytoun',
      'Name: Dana',
      'Phone: +970599123456',
      'Address: Building 4, second floor',
      'Location: https://maps.google.com/?q=31.5,35.1',
    ]);
    expect(message.indexOf('Location:')).toBeLessThan(message.indexOf('1x Falafel'));
  });

  it('leaves out an address or a map link that was not given', () => {
    const message = buildWhatsAppMessage({
      ...base,
      labels: withContact,
      contact: {
        name: 'Dana',
        phone: '0599123456',
        address: '',
        mapUrl: 'https://maps.google.com/?q=1,2',
      },
    });
    expect(message).not.toContain('Address:');
    expect(message).toContain('Location: https://maps.google.com/?q=1,2');
  });

  it('adds nothing when there are no details, as before', () => {
    const message = buildWhatsAppMessage({ ...base, labels: withContact });
    expect(message).not.toMatch(/Name:|Phone:|Address:|Location:/);
  });
});
