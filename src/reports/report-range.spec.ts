import {
  addDaysIso,
  daysBetween,
  eachDay,
  isRealDate,
  parseRange,
  todayInHebron,
} from './report-range';

const today = '2026-11-20';

describe('parseRange', () => {
  it('gives the last 7 days when asked for nothing', () => {
    expect(parseRange({}, today)).toEqual({ from: '2026-11-14', to: today, preset: '7d' });
  });

  it.each([
    ['today', '2026-11-20'],
    ['7d', '2026-11-14'],
    ['30d', '2026-10-22'],
    ['90d', '2026-08-23'],
  ])('knows the %s preset', (range, from) => {
    expect(parseRange({ range }, today)).toEqual({ from, to: today, preset: range });
  });

  it('takes a custom range of two real dates in order', () => {
    expect(parseRange({ from: '2026-01-01', to: '2026-01-31' }, today)).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      preset: 'custom',
    });
    expect(parseRange({ from: '2026-01-05', to: '2026-01-05' }, today).preset).toBe('custom');
  });

  it.each([
    [{ from: '2026-02-31', to: '2026-03-05' }],
    [{ from: '2026-03-05', to: '2026-03-01' }],
    [{ from: 'yesterday', to: 'today' }],
    [{ from: '2026-01-01' }],
    [{ from: '2020-01-01', to: '2026-01-01' }],
    [{ range: 'forever' }],
    [{ range: ['7d', '30d'] }],
    [{ from: ['2026-01-01'], to: '2026-01-02' }],
  ])('falls back to the last 7 days for %j', (query) => {
    expect(parseRange(query, today)).toEqual({ from: '2026-11-14', to: today, preset: '7d' });
  });

  it('allows a full leap year and refuses a day more', () => {
    expect(parseRange({ from: '2024-01-01', to: '2024-12-31' }, today).preset).toBe('custom');
    expect(parseRange({ from: '2024-01-01', to: '2025-01-01' }, today).preset).toBe('7d');
  });
});

describe('date helpers', () => {
  it('adds days across months and years', () => {
    expect(addDaysIso('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days inclusively and lists every one', () => {
    expect(daysBetween('2026-11-14', '2026-11-20')).toBe(7);
    expect(eachDay('2026-11-29', '2026-12-02')).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
  });

  it('only accepts real calendar dates', () => {
    expect(isRealDate('2026-02-28')).toBe(true);
    expect(isRealDate('2026-02-29')).toBe(false);
    expect(isRealDate('2026-2-8')).toBe(false);
    expect(isRealDate(20261120)).toBe(false);
  });

  it('reads today where the restaurant is, not where the server clock says', () => {
    // 22:30 UTC on the 14th is already the 15th in Hebron, in winter (UTC+2) and summer (UTC+3).
    expect(todayInHebron(new Date('2026-01-14T22:30:00Z'))).toBe('2026-01-15');
    expect(todayInHebron(new Date('2026-07-14T21:30:00Z'))).toBe('2026-07-15');
    expect(todayInHebron(new Date('2026-07-14T20:30:00Z'))).toBe('2026-07-14');
  });
});
