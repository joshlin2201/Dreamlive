import {
  BAND_COUNT,
  bandsAtPosition,
  computeSpectrogram,
  fftMagnitudes,
  hasSpectrogram,
  logBandEdges,
  playheadNow,
} from './spectrogram';

const sine = (length, hz, rate = 8000, amplitude = 1) => {
  const data = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.sin((2 * Math.PI * hz * index) / rate) * amplitude;
  }
  return data;
};

describe('offline spectrogram', () => {
  test('the transform finds the tone it was given', () => {
    const size = 512;
    const rate = 8000;
    const hz = 500;
    const real = Float32Array.from(sine(size, hz, rate));
    const imag = new Float32Array(size);
    const magnitudes = fftMagnitudes(real, imag);
    let loudestBin = 0;
    for (let bin = 1; bin < magnitudes.length; bin += 1) {
      if (magnitudes[bin] > magnitudes[loudestBin]) loudestBin = bin;
    }
    expect(Math.round((loudestBin * rate) / size)).toBeCloseTo(hz, -2);
  });

  test('a bass tone and a treble tone light up different ends of the meter', () => {
    const bass = computeSpectrogram(sine(8000, 120));
    const treble = computeSpectrogram(sine(8000, 3200));
    const at = spec => bandsAtPosition(spec, { position: 0.5, duration: 1, barCount: 32 });
    const low = bars => bars.slice(0, 8).reduce((a, b) => a + b, 0);
    const high = bars => bars.slice(-8).reduce((a, b) => a + b, 0);
    const bassBars = at(bass);
    const trebleBars = at(treble);
    expect(low(bassBars)).toBeGreaterThan(high(bassBars));
    expect(high(trebleBars)).toBeGreaterThan(low(trebleBars));
  });

  test('a quiet moment and a loud moment in one track read differently', () => {
    const data = new Float32Array(16000);
    data.set(sine(8000, 900, 8000, 0.03), 0);
    data.set(sine(8000, 900, 8000, 1), 8000);
    const spec = computeSpectrogram(data);
    const level = bars => bars.reduce((a, b) => a + b, 0) / bars.length;
    const quiet = level(bandsAtPosition(spec, { position: 0.4, duration: 2, barCount: 40 }));
    const loud = level(bandsAtPosition(spec, { position: 1.6, duration: 2, barCount: 40 }));
    expect(loud).toBeGreaterThan(quiet * 2);
  });

  test('bands are logarithmic, so bass gets its own bars instead of one', () => {
    const edges = logBandEdges(256, BAND_COUNT);
    expect(edges).toHaveLength(BAND_COUNT + 1);
    for (let index = 1; index < edges.length; index += 1) {
      expect(edges[index]).toBeGreaterThanOrEqual(edges[index - 1]);
    }
    const firstSpan = edges[5] - edges[0];
    const lastSpan = edges[edges.length - 1] - edges[edges.length - 6];
    expect(lastSpan).toBeGreaterThan(firstSpan);
  });

  test('audio too short to transform reports no spectrogram rather than guessing', () => {
    const tiny = computeSpectrogram(new Float32Array(64));
    expect(tiny.frames).toBe(0);
    expect(hasSpectrogram(tiny)).toBe(false);
    expect(hasSpectrogram(null)).toBe(false);
    expect(hasSpectrogram(computeSpectrogram(sine(8000, 440)))).toBe(true);
  });

  test('an unknown duration draws nothing, and every bar stays in the meter', () => {
    const spec = computeSpectrogram(sine(8000, 440));
    expect(bandsAtPosition(spec, { position: 1, duration: 0, barCount: 16 })).toEqual(new Array(16).fill(0));
    const bars = bandsAtPosition(spec, { position: 0.5, duration: 1, barCount: 48 });
    expect(bars).toHaveLength(48);
    bars.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
  });

  test('the column follows the playhead, not the clock', () => {
    const data = new Float32Array(24000);
    data.set(sine(8000, 150), 0);
    data.set(sine(8000, 3400), 16000);
    const spec = computeSpectrogram(data);
    const start = bandsAtPosition(spec, { position: 0.4, duration: 3, barCount: 32 });
    const end = bandsAtPosition(spec, { position: 2.6, duration: 3, barCount: 32 });
    const high = bars => bars.slice(-8).reduce((a, b) => a + b, 0);
    expect(high(end)).toBeGreaterThan(high(start));
  });
});

describe('playheadNow', () => {
  test('carries a playing sample forward by real time', () => {
    const at = playheadNow({ time: 10, duration: 200, playing: true, at: 1000 }, 1500);
    expect(at.position).toBeCloseTo(10.5, 5);
  });

  test('a paused sample does not drift', () => {
    const at = playheadNow({ time: 10, duration: 200, playing: false, at: 1000 }, 9000);
    expect(at.position).toBe(10);
  });

  test('never runs past the end of the track', () => {
    const at = playheadNow({ time: 199.8, duration: 200, playing: true, at: 1000 }, 6000);
    expect(at.position).toBe(200);
  });

  test('no sample means no playhead, so the caller can fall back', () => {
    expect(playheadNow(null, 1000)).toBeNull();
    expect(playheadNow({ playing: true, at: 0 }, 1000)).toBeNull();
  });
});
