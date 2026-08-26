// A real sound visualizer needs frequency content, not loudness. An
// AnalyserNode gives that live, but only if playback is routed through the Web
// Audio graph — and that routing is what silences the show when iOS sends the
// app to the background. So the FFT happens once, offline, and the bars read
// the column for whatever moment is playing. Same data an analyser would give,
// computed ahead of time instead of in the audio thread.

export const FFT_SIZE = 512;
export const BAND_COUNT = 28;
// ~23 frames a second: fast enough that a kick reads as a kick, small enough
// that a four minute track stays well under a megabyte of bands.
export const HOP_SIZE = 344;

export function hannWindow(size) {
  const window = new Float32Array(size);
  for (let index = 0; index < size; index += 1) {
    window[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1)));
  }
  return window;
}

// In-place iterative radix-2 FFT. Real input, so the caller only reads the
// first half of the spectrum.
export function fftMagnitudes(real, imag) {
  const size = real.length;
  for (let i = 1, j = 0; i < size; i += 1) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let len = 2; len <= size; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let start = 0; start < size; start += len) {
      let curReal = 1;
      let curImag = 0;
      for (let offset = 0; offset < len / 2; offset += 1) {
        const a = start + offset;
        const b = a + (len / 2);
        const tReal = (real[b] * curReal) - (imag[b] * curImag);
        const tImag = (real[b] * curImag) + (imag[b] * curReal);
        real[b] = real[a] - tReal;
        imag[b] = imag[a] - tImag;
        real[a] += tReal;
        imag[a] += tImag;
        const nextReal = (curReal * wReal) - (curImag * wImag);
        curImag = (curReal * wImag) + (curImag * wReal);
        curReal = nextReal;
      }
    }
  }
  const half = size >> 1;
  const magnitudes = new Float32Array(half);
  for (let index = 0; index < half; index += 1) {
    magnitudes[index] = Math.hypot(real[index], imag[index]);
  }
  return magnitudes;
}

// Bins are spaced logarithmically, the way hearing is: a handful of bands for
// the bass, progressively wider ones on top.
export function logBandEdges(binCount, bands = BAND_COUNT) {
  const edges = new Array(bands + 1);
  const lowest = 1;
  for (let index = 0; index <= bands; index += 1) {
    const ratio = index / bands;
    edges[index] = Math.min(
      binCount,
      Math.max(lowest, Math.round(lowest * Math.pow(binCount / lowest, ratio))),
    );
  }
  return edges;
}

export function computeSpectrogram(channelData, {
  fftSize = FFT_SIZE,
  hopSize = HOP_SIZE,
  bands = BAND_COUNT,
} = {}) {
  const total = channelData?.length || 0;
  const frames = total >= fftSize ? Math.floor((total - fftSize) / hopSize) + 1 : 0;
  const data = new Float32Array(Math.max(0, frames) * bands);
  if (frames <= 0) return { data, frames: 0, bands };

  const window = hannWindow(fftSize);
  const edges = logBandEdges(fftSize >> 1, bands);
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);
  let loudest = 0;

  for (let frame = 0; frame < frames; frame += 1) {
    const start = frame * hopSize;
    for (let index = 0; index < fftSize; index += 1) {
      real[index] = channelData[start + index] * window[index];
      imag[index] = 0;
    }
    const magnitudes = fftMagnitudes(real, imag);
    for (let band = 0; band < bands; band += 1) {
      const from = edges[band];
      const to = Math.max(from + 1, edges[band + 1]);
      let sum = 0;
      for (let bin = from; bin < to; bin += 1) sum += magnitudes[bin];
      const value = sum / (to - from);
      data[(frame * bands) + band] = value;
      if (value > loudest) loudest = value;
    }
  }

  // Music puts most of its energy in the bass. Scaling everything by the single
  // loudest band leaves the rest of the meter flat on the floor, which is what
  // an empty-looking visualizer is. Each band is scaled against its own loudest
  // moment instead - with a floor, so a band that is genuinely absent stays
  // absent rather than being amplified into noise.
  const floor = loudest * 0.06;
  for (let band = 0; band < bands; band += 1) {
    let bandMax = 0;
    for (let frame = 0; frame < frames; frame += 1) {
      const value = data[(frame * bands) + band];
      if (value > bandMax) bandMax = value;
    }
    const scale = 1 / Math.max(bandMax, floor, 1e-9);
    for (let frame = 0; frame < frames; frame += 1) {
      const at = (frame * bands) + band;
      data[at] = Math.min(1, data[at] * scale);
    }
  }

  // How loud each moment is overall, so the meter still rises and falls with
  // the music instead of sitting at full height for the whole track.
  const level = new Float32Array(frames);
  let loudestFrame = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let band = 0; band < bands; band += 1) sum += data[(frame * bands) + band];
    const value = sum / bands;
    level[frame] = value;
    if (value > loudestFrame) loudestFrame = value;
  }
  if (loudestFrame > 0) {
    for (let frame = 0; frame < frames; frame += 1) level[frame] /= loudestFrame;
  }

  return { data, level, frames, bands };
}

// The column of bands for whatever is playing right now, stretched across the
// bars on screen. Nothing here depends on the playhead moving forward — a
// scrubbed or paused track shows the sound at that moment.
export function bandsAtPosition(spectrogram, { position = 0, duration = 0, barCount = 64 } = {}) {
  const bars = new Array(Math.max(1, barCount)).fill(0);
  const frames = spectrogram?.frames || 0;
  const bands = spectrogram?.bands || 0;
  if (frames <= 0 || bands <= 0 || !(duration > 0)) return bars;

  const progress = Math.min(1, Math.max(0, position / duration));
  const frame = Math.min(frames - 1, Math.round(progress * (frames - 1)));
  const offset = frame * bands;
  const pump = 0.45 + (Math.pow(spectrogram.level?.[frame] ?? 1, 0.6) * 0.6);

  for (let index = 0; index < bars.length; index += 1) {
    const place = (index / (bars.length - 1 || 1)) * (bands - 1);
    const low = Math.floor(place);
    const high = Math.min(bands - 1, low + 1);
    const blend = place - low;
    const value = (spectrogram.data[offset + low] * (1 - blend))
      + (spectrogram.data[offset + high] * blend);
    // The same perceptual curve the live analyser used, so the meter reads the
    // way it always did rather than hugging the floor.
    bars[index] = Math.min(1, Math.pow(value, 0.55) * pump * 1.18);
  }
  return bars;
}

export function hasSpectrogram(spectrogram) {
  return Boolean(spectrogram && spectrogram.frames > 0 && spectrogram.bands > 0);
}

// Where the playhead is right now, given a sample taken a moment ago. Native
// playback is sampled a few times a second, which is far coarser than the
// frame rate the bars draw at, so a paused-looking step appears unless the
// sample is carried forward by the time since it was read.
export function playheadNow(sample, now = 0) {
  if (!sample || !Number.isFinite(sample.time)) return null;
  const elapsed = sample.playing ? Math.max(0, (now - sample.at) / 1000) : 0;
  const duration = Number.isFinite(sample.duration) ? sample.duration : 0;
  const position = sample.time + elapsed;
  return { position: duration > 0 ? Math.min(position, duration) : position, duration };
}
