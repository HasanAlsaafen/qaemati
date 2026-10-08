import {
  cleanLine,
  isValidPhone,
  mapUrl,
  normalizePhone,
  validateContact,
  westernDigits,
} from './contact-details';

const ok = {
  name: 'Dana Haddad',
  phone: '+970 599 123 456',
  address: '',
  pin: { lat: 31.5326, lng: 35.0998 },
};

describe('phone numbers', () => {
  it('turns Arabic and Eastern Arabic digits into the ones a dialer wants', () => {
    expect(westernDigits('٠٥٩٩١٢٣٤٥٦')).toBe('0599123456');
    expect(westernDigits('۰۵۹۹۱۲۳۴۵۶')).toBe('0599123456');
    expect(westernDigits('+٩٧٠ 599')).toBe('+970 599');
  });

  it('strips spaces, dashes, dots and brackets and reads 00 as +', () => {
    expect(normalizePhone('+970 (599) 123-456')).toBe('+970599123456');
    expect(normalizePhone('00970599123456')).toBe('+970599123456');
    expect(normalizePhone('0599.123.456')).toBe('0599123456');
    expect(normalizePhone('\u200e+970\u200f 599 123 456')).toBe('+970599123456');
  });

  it.each(['+970599123456', '0599123456', '1234567', '123456789012345'])('accepts %s', (phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });

  it.each(['', '12345', '+', 'abc', '05991234567890123', '+97059a123456', '0599 12'])(
    'refuses %s',
    (phone) => {
      expect(isValidPhone(normalizePhone(phone))).toBe(false);
    },
  );
});

describe('text fields', () => {
  it('keeps one clean line of limited length', () => {
    expect(cleanLine('  a\n\tb\u0000c  ', 20)).toBe('a b c');
    expect(cleanLine('x'.repeat(300), 200)).toHaveLength(200);
    expect(cleanLine('line one line two', 50)).toBe('line one line two');
  });
});

describe('mapUrl', () => {
  it('links the position on a map to five decimals', () => {
    expect(mapUrl({ lat: 31.532601, lng: 35.099801 })).toBe(
      'https://maps.google.com/?q=31.53260,35.09980',
    );
    expect(mapUrl({ lat: -33.8688, lng: -70.5 })).toBe(
      'https://maps.google.com/?q=-33.86880,-70.50000',
    );
  });
});

describe('validateContact', () => {
  it('accepts a name, a phone and a shared position', () => {
    expect(validateContact(ok)).toEqual({
      ok: true,
      contact: {
        name: 'Dana Haddad',
        phone: '+970599123456',
        address: '',
        mapUrl: 'https://maps.google.com/?q=31.53260,35.09980',
      },
    });
  });

  it('accepts a typed address instead of a position, and both together', () => {
    const typed = validateContact({ ...ok, pin: null, address: '  Main street,   building 4 ' });
    expect(typed).toMatchObject({
      ok: true,
      contact: { address: 'Main street, building 4', mapUrl: '' },
    });
    expect(validateContact({ ...ok, address: 'Gate 2' })).toMatchObject({
      ok: true,
      contact: { address: 'Gate 2' },
    });
  });

  it('says exactly what is missing, all at once', () => {
    expect(validateContact({ name: '', phone: '', address: '', pin: null })).toEqual({
      ok: false,
      errors: { name: 'nameRequired', phone: 'phoneInvalid', location: 'locationRequired' },
    });
    expect(validateContact({ ...ok, name: 'D' })).toEqual({
      ok: false,
      errors: { name: 'nameRequired' },
    });
    expect(validateContact({ ...ok, phone: '12' })).toEqual({
      ok: false,
      errors: { phone: 'phoneInvalid' },
    });
    expect(validateContact({ ...ok, pin: null, address: 'x' })).toEqual({
      ok: false,
      errors: { location: 'locationRequired' },
    });
  });

  it('does not trust an impossible or broken position', () => {
    for (const pin of [
      { lat: 999, lng: 0 },
      { lat: NaN, lng: 1 },
      { lat: 1, lng: 181 },
    ]) {
      expect(validateContact({ ...ok, pin })).toEqual({
        ok: false,
        errors: { location: 'locationRequired' },
      });
    }
  });

  it('cannot smuggle a line break or a long text into the message', () => {
    const result = validateContact({
      ...ok,
      name: 'Dana\nPhone: 000',
      pin: null,
      address: 'a\r\nb'.padEnd(500, 'x'),
    });
    expect(result.ok && result.contact.name).toBe('Dana Phone: 000');
    expect(result.ok && result.contact.address.includes('\n')).toBe(false);
    expect(result.ok && result.contact.address.length).toBeLessThanOrEqual(200);
  });
});
