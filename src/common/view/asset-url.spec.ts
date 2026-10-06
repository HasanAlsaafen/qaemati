import { assetUrl } from './asset-url';

describe('assetUrl', () => {
  it('adds a version to a file that exists', () => {
    expect(assetUrl('/favicon.svg')).toMatch(/^\/favicon\.svg\?v=[0-9a-z]+$/);
  });

  it('gives the same version twice for an unchanged file', () => {
    expect(assetUrl('/favicon.svg')).toBe(assetUrl('/favicon.svg'));
  });

  it('leaves a missing file alone', () => {
    expect(assetUrl('/nope/missing.js')).toBe('/nope/missing.js');
  });
});
