import { isDemoModeEnabled } from './demo-mode';

describe('isDemoModeEnabled', () => {
  const original = process.env.DEMO_MODE;

  afterEach(() => {
    process.env.DEMO_MODE = original;
  });

  it('is true when DEMO_MODE is exactly "true"', () => {
    process.env.DEMO_MODE = 'true';
    expect(isDemoModeEnabled()).toBe(true);
  });

  it('is false when DEMO_MODE is unset', () => {
    delete process.env.DEMO_MODE;
    expect(isDemoModeEnabled()).toBe(false);
  });

  it('is false for any other value, not just a truthy string', () => {
    process.env.DEMO_MODE = '1';
    expect(isDemoModeEnabled()).toBe(false);
    process.env.DEMO_MODE = 'TRUE';
    expect(isDemoModeEnabled()).toBe(false);
  });
});
