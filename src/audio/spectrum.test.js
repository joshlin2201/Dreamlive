import { aggregateSpectrumBins, createIdleSpectrum, decaySpectrum } from './spectrum';

describe('audio spectrum model', () => {
  test('aggregates frequency data into normalized display bars', () => {
    const bars = aggregateSpectrumBins(Uint8Array.from([0, 64, 128, 255, 255, 128, 64, 0]), 4);
    expect(bars).toHaveLength(4);
    expect(bars[0]).toBeCloseTo(0.125, 2);
    expect(bars[1]).toBeCloseTo(0.75, 2);
    expect(bars.every(value => value >= 0 && value <= 1)).toBe(true);
  });

  test('creates a quiet but visible idle baseline', () => {
    const bars = createIdleSpectrum(48);
    expect(bars).toHaveLength(48);
    expect(Math.max(...bars)).toBeLessThanOrEqual(0.12);
    expect(Math.min(...bars)).toBeGreaterThan(0);
  });

  test('decays stopped audio smoothly toward the idle baseline', () => {
    const decayed = decaySpectrum([1, 0.5], [0.1, 0.1], 0.5);
    expect(decayed).toEqual([0.55, 0.3]);
  });
});
