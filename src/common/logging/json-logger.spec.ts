import { JsonLogger } from './json-logger';

describe('JsonLogger', () => {
  it('writes one parseable json line per call', () => {
    const lines: string[] = [];
    const logger = new JsonLogger((l) => lines.push(l));
    logger.log('started', 'Boot');
    logger.error('failed', 'Error: x\n at y', 'Http');
    const [a, b] = lines.map((l) => JSON.parse(l));
    expect(a).toMatchObject({ level: 'log', context: 'Boot', message: 'started' });
    expect(b).toMatchObject({ level: 'error', context: 'Http', stack: 'Error: x\n at y' });
  });
});
