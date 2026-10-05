import { parseIds } from './parse-ids';

describe('parseIds', () => {
  it('passes through an array of ids', () => {
    expect(parseIds(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('wraps a single id (a one-item drag reorder) into an array', () => {
    expect(parseIds('a')).toEqual(['a']);
  });

  it('returns an empty array for missing input', () => {
    expect(parseIds(undefined)).toEqual([]);
  });

  it('drops empty-string entries', () => {
    expect(parseIds(['a', '', 'b'])).toEqual(['a', 'b']);
  });
});
