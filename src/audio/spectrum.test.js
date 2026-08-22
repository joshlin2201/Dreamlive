import { aggregateSpectrumBins, createIdleSpectrum, decaySpectrum, smoothSpectrum } from './spectrum';

describe('audio spectrum model', () => {
  test('aggregates frequency data into normalized display bars', () => {
    const bars = aggregateSpectrumBins(Uint8Array.from([0, 64, 128, 255, 255, 128, 64, 0]), 4);
    expect(bars).toHaveLength(4);
    expect(bars[0]).toBeCloseTo(0.125, 2);
    expect(bars[1]).toBeCloseTo(0.75, 2);
    expect(bars.every(value => value >= 0 && value <= 1)).toBe(true);
  });

  test('reuses a supplied bar buffer during continuous playback', () => {
    const output = Array(4).fill(0);
    const bars = aggregateSpectrumBins(
      Uint8Array.from([0, 64, 128, 255, 255, 128, 64, 0]),
      4,
      output
    );

    expect(bars).toBe(output);
  });

  test('can focus the display on the musically useful frequency range', () => {
    const data = Uint8Array.from([255, 255, 128, 128, 0, 0, 0, 0]);
    expect(aggregateSpectrumBins(data, 2, null, 0.5)).toEqual([1, 128 / 255]);
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

  test('reuses a supplied smoothing buffer during animation', () => {
    const output = Array(2).fill(0);
    expect(decaySpectrum([1, 0.5], [0.1, 0.1], 0.5, output)).toBe(output);
    expect(output).toEqual([0.55, 0.3]);
  });

  test('responds quickly to frequency attacks and releases them smoothly', () => {
    const values = smoothSpectrum([0.1, 0.8], [0.9, 0.1], { attack: 0.75, release: 0.2 });
    expect(values).toEqual([0.7, 0.66]);
  });
});
