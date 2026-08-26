import { PEAK_BUCKETS, hasUsablePeaks, spectrumFromPeaks, summarizePeaks } from './waveform';

const tone = (length, amplitude) => {
  const data = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.sin((index / 24) * Math.PI * 2) * amplitude;
  }
  return data;
};

describe('offline waveform analysis', () => {
  test('a quiet track still fills the meter, because peaks are relative to itself', () => {
    const loud = summarizePeaks(tone(8000, 0.9), 64);
    const quiet = summarizePeaks(tone(8000, 0.02), 64);
    expect(Math.max(...loud)).toBeCloseTo(1, 5);
    expect(Math.max(...quiet)).toBeCloseTo(1, 5);
  });

  test('a louder passage reads louder than a quiet one in the same track', () => {
    const data = new Float32Array(4000);
    data.set(tone(2000, 0.1), 0);
    data.set(tone(2000, 1), 2000);
    const peaks = summarizePeaks(data, 4);
    expect(peaks[0]).toBeLessThan(peaks[3]);
  });

  test('silence and empty audio never claim to have levels', () => {
    expect(hasUsablePeaks(summarizePeaks(new Float32Array(2000), 32))).toBe(false);
    expect(hasUsablePeaks(summarizePeaks(new Float32Array(0), 32))).toBe(false);
    expect(hasUsablePeaks(null)).toBe(false);
    expect(hasUsablePeaks(summarizePeaks(tone(2000, 0.8), 32))).toBe(true);
  });

  test('bucket count is honoured and never zero', () => {
    expect(summarizePeaks(tone(5000, 0.5), 128)).toHaveLength(128);
    expect(summarizePeaks(tone(5000, 0.5), 0)).toHaveLength(1);
    expect(summarizePeaks(tone(5000, 0.5))).toHaveLength(PEAK_BUCKETS);
  });

  test('the meter follows the playhead across the track', () => {
    const data = new Float32Array(9000);
    data.set(tone(3000, 1), 6000); // only the last third is loud
    const peaks = summarizePeaks(data, 300);
    const opening = spectrumFromPeaks(peaks, { position: 1, duration: 90, barCount: 32 });
    const closing = spectrumFromPeaks(peaks, { position: 88, duration: 90, barCount: 32 });
    const level = bars => bars.reduce((a, b) => a + b, 0) / bars.length;
    expect(level(closing)).toBeGreaterThan(level(opening));
  });

  test('the meter bounces: a quiet moment sits far lower than a loud one', () => {
    const data = new Float32Array(12000);
    data.set(tone(3000, 0.05), 0);
    data.set(tone(3000, 1), 6000);
    const peaks = summarizePeaks(data, 400);
    const level = bars => bars.reduce((a, b) => a + b, 0) / bars.length;
    const quiet = level(spectrumFromPeaks(peaks, { position: 8, duration: 120, barCount: 40 }));
    const loud = level(spectrumFromPeaks(peaks, { position: 70, duration: 120, barCount: 40 }));
    expect(loud).toBeGreaterThan(quiet * 2);
  });

  test('bars read different moments, so the movement travels across the strip', () => {
    const data = new Float32Array(12000);
    for (let i = 0; i < data.length; i += 1) {
      const loud = Math.floor(i / 400) % 2 === 0;
      data[i] = Math.sin((i / 20) * Math.PI * 2) * (loud ? 1 : 0.04);
    }
    const peaks = summarizePeaks(data, 600);
    const bars = spectrumFromPeaks(peaks, { position: 60, duration: 120, barCount: 48 });
    const distinct = new Set(bars.map(value => value.toFixed(2)));
    expect(distinct.size).toBeGreaterThan(4);
  });

  test('an unknown duration draws nothing rather than guessing', () => {
    const peaks = summarizePeaks(tone(4000, 0.7), 64);
    expect(spectrumFromPeaks(peaks, { position: 3, duration: 0, barCount: 16 })).toEqual(new Array(16).fill(0));
    expect(spectrumFromPeaks(null, { position: 3, duration: 30, barCount: 16 })).toEqual(new Array(16).fill(0));
  });

  test('every bar stays inside the meter', () => {
    const peaks = summarizePeaks(tone(6000, 1), 200);
    const bars = spectrumFromPeaks(peaks, { position: 30, duration: 60, barCount: 48 });
    expect(bars).toHaveLength(48);
    bars.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
  });
});
