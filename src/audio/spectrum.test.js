import {
  aggregateLogSpectrumBins,
  aggregateSpectrumBins,
  createIdleSpectrum,
  decaySpectrum,
  smoothSpectrum,
} from './spectrum';

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

  test('maps a wide spectrum into distinct logarithmic frequency bands', () => {
    const data = Uint8Array.from({ length: 256 }, (_, index) => (
      index < 16 ? 230 : (index < 64 ? 120 : 24)
    ));
    const output = Array(24).fill(0);
    const bars = aggregateLogSpectrumBins(data, 24, output, 0.8);

    expect(bars).toBe(output);
    expect(bars).toHaveLength(24);
    expect(Math.max(...bars.slice(0, 6))).toBeGreaterThan(Math.max(...bars.slice(-6)));
    expect(new Set(bars.map(value => value.toFixed(2))).size).toBeGreaterThan(2);
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
