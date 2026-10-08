import { Candidate, suggest } from './suggest';

const c = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  id,
  categoryId: 'mains',
  tagged: false,
  sold: 0,
  sortOrder: 0,
  ...over,
});
const none = { pairings: new Map<string, string[]>(), together: new Map<string, number>() };
const ids = (result: { id: string }[]) => result.map((r) => r.id);

describe('suggest: the owner picks come first', () => {
  const candidates = [c('burger'), c('fries'), c('cola'), c('shake'), c('salad')];

  it('offers what the owner said goes well, in the owner order', () => {
    const result = suggest({
      selected: ['burger'],
      candidates,
      ...none,
      pairings: new Map([['burger', ['cola', 'fries']]]),
    });
    expect(result.slice(0, 2)).toEqual([
      { id: 'cola', reason: 'pairing' },
      { id: 'fries', reason: 'pairing' },
    ]);
  });

  it('follows the order the guest chose their dishes in', () => {
    const result = suggest({
      selected: ['salad', 'burger'],
      candidates,
      ...none,
      pairings: new Map([
        ['burger', ['cola']],
        ['salad', ['shake']],
      ]),
    });
    expect(ids(result).slice(0, 2)).toEqual(['shake', 'cola']);
  });

  it('never offers a dish already chosen, itself, or one that cannot be ordered now', () => {
    const result = suggest({
      selected: ['burger', 'fries'],
      candidates: candidates.filter((x) => x.id !== 'cola'),
      ...none,
      pairings: new Map([['burger', ['burger', 'fries', 'cola', 'shake']]]),
    });
    expect(ids(result)).not.toContain('burger');
    expect(ids(result)).not.toContain('fries');
    expect(ids(result)).not.toContain('cola');
    expect(ids(result)[0]).toBe('shake');
  });

  it('never offers the same dish twice when two picks point to it', () => {
    const result = suggest({
      selected: ['burger', 'salad'],
      candidates,
      ...none,
      pairings: new Map([
        ['burger', ['cola']],
        ['salad', ['cola']],
      ]),
    });
    expect(ids(result).filter((id) => id === 'cola')).toHaveLength(1);
  });

  it('stops at three', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => c(id));
    const result = suggest({
      selected: ['burger'],
      candidates: [c('burger'), ...many],
      ...none,
      pairings: new Map([['burger', ['a', 'b', 'c', 'd', 'e']]]),
    });
    expect(ids(result)).toEqual(['a', 'b', 'c']);
  });
});

describe('suggest: what orders show', () => {
  const candidates = [
    c('burger'),
    c('fries', { sold: 5 }),
    c('cola', { sold: 50 }),
    c('shake', { sold: 1 }),
  ];

  it('uses dishes often ordered together, most often first, once there are enough orders', () => {
    const result = suggest({
      selected: ['burger'],
      candidates,
      pairings: new Map(),
      together: new Map([
        ['fries', 9],
        ['cola', 4],
        ['shake', 3],
      ]),
    });
    expect(result).toEqual([
      { id: 'fries', reason: 'together' },
      { id: 'cola', reason: 'together' },
      { id: 'shake', reason: 'together' },
    ]);
  });

  it('does not call two orders a pattern', () => {
    const result = suggest({
      selected: ['burger'],
      candidates,
      pairings: new Map(),
      together: new Map([
        ['fries', 2],
        ['cola', 1],
      ]),
    });
    expect(result.every((r) => r.reason !== 'together')).toBe(true);
  });

  it('breaks a tie by what sells most, and ignores dishes that cannot be ordered', () => {
    const result = suggest({
      selected: ['burger'],
      candidates,
      pairings: new Map(),
      together: new Map([
        ['fries', 4],
        ['cola', 4],
        ['gone', 99],
      ]),
    });
    expect(ids(result).slice(0, 2)).toEqual(['cola', 'fries']);
    expect(ids(result)).not.toContain('gone');
  });

  it('fills what the owner left open with what orders show', () => {
    const result = suggest({
      selected: ['burger'],
      candidates,
      pairings: new Map([['burger', ['shake']]]),
      together: new Map([['fries', 5]]),
    });
    expect(result).toEqual([
      { id: 'shake', reason: 'pairing' },
      { id: 'fries', reason: 'together' },
      expect.objectContaining({ reason: 'popular' }),
    ]);
  });
});

describe('suggest: popular dishes as a last resort', () => {
  it('prefers a category the guest has not picked from, then tagged, then best selling', () => {
    const candidates = [
      c('burger', { categoryId: 'mains' }),
      c('steak', { categoryId: 'mains', tagged: true, sold: 90 }),
      c('cola', { categoryId: 'drinks', sold: 10 }),
      c('juice', { categoryId: 'drinks', sold: 30 }),
      c('cake', { categoryId: 'sweets', tagged: true, sold: 1 }),
    ];
    const result = suggest({ selected: ['burger'], candidates, ...none });
    expect(result.map((r) => r.reason)).toEqual(['popular', 'popular', 'popular']);
    expect(ids(result)).toEqual(['cake', 'juice', 'steak']);
  });

  it('takes one per category before a second from the same one', () => {
    const candidates = [
      c('d1', { categoryId: 'drinks', sold: 9 }),
      c('d2', { categoryId: 'drinks', sold: 8 }),
      c('d3', { categoryId: 'drinks', sold: 7 }),
      c('s1', { categoryId: 'sweets', sold: 1 }),
    ];
    const result = suggest({ selected: [], candidates, ...none });
    expect(ids(result)).toEqual(['d1', 's1', 'd2']);
  });

  it('breaks ties by menu order so the answer does not change between requests', () => {
    const candidates = [
      c('b', { sortOrder: 2 }),
      c('a', { sortOrder: 1 }),
      c('c', { sortOrder: 3 }),
    ];
    expect(ids(suggest({ selected: [], candidates, ...none }))).toEqual(['a', 'b', 'c']);
    expect(ids(suggest({ selected: [], candidates: [...candidates].reverse(), ...none }))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('offers nothing when there is nothing left to offer', () => {
    expect(suggest({ selected: ['only'], candidates: [c('only')], ...none })).toEqual([]);
    expect(suggest({ selected: [], candidates: [], ...none })).toEqual([]);
  });
});
