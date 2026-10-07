import { csvField, csvRows } from './csv-safe';

describe('csvField', () => {
  it('leaves plain text alone and quotes what needs it', () => {
    expect(csvField('Hummus')).toBe('Hummus');
    expect(csvField('a, b')).toBe('"a, b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField(null)).toBe('');
    expect(csvField(12.5)).toBe('12.5');
  });

  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '=HYPERLINK("http://evil","x")'])(
    'defuses a spreadsheet formula: %s',
    (cell) => {
      expect(csvField(cell).replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('does not touch a value that only contains those characters later on', () => {
    expect(csvField('a=b')).toBe('a=b');
    expect(csvField('3 - 2')).toBe('3 - 2');
  });

  it('starts a file with the byte order mark and ends lines with CRLF', () => {
    const csv = csvRows([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿a,b\r\n1,2\r\n');
  });
});
