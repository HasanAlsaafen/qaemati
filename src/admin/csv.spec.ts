import { parseCsv, stringifyCsv } from './csv';

describe('csv', () => {
  it('round-trips quoted fields with commas, quotes, and newlines', () => {
    const rows = [
      ['id', 'name'],
      ['1', 'Simple'],
      ['2', 'Has, a comma'],
      ['3', 'Has "quotes"'],
      ['4', 'Has\na newline'],
    ];
    const csv = stringifyCsv(rows);
    expect(parseCsv(csv)).toEqual(rows);
  });

  it('parses a plain header + rows csv', () => {
    const csv = 'id,category,price\n,Drinks,10\nabc,Sweets,15\n';
    expect(parseCsv(csv)).toEqual([
      ['id', 'category', 'price'],
      ['', 'Drinks', '10'],
      ['abc', 'Sweets', '15'],
    ]);
  });
});
