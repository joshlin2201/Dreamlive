// The visualizer used to read an AnalyserNode, which only exists if playback is
// routed through the Web Audio graph - and that routing is what silenced the
// show whenever the app went to the background on iOS. So the levels come from
// the file instead: decoded once, offline, into a small array of peaks that the
// bars read against the playhead. An OfflineAudioContext renders into memory and
// never touches the audio session, so nothing here can interrupt playback.

// Decoding at a low rate is the whole trick on an older iPad: a four minute
// track becomes a few hundred kilobytes of samples instead of tens of megabytes.
export const ANALYSIS_SAMPLE_RATE = 8000;
export const PEAK_BUCKETS = 1200;

// Root-mean-square per bucket: louder passages read louder, and a single stray
// sample cannot spike a whole bar the way a raw maximum would.
export function summarizePeaks(channelData, buckets = PEAK_BUCKETS) {
  const total = channelData?.length || 0;
  const count = Math.max(1, Math.floor(buckets));
  const peaks = new Float32Array(count);
  if (total === 0) return peaks;

  const size = total / count;
  let loudest = 0;
  for (let bucket = 0; bucket < count; bucket += 1) {
    const start = Math.floor(bucket * size);
    const end = Math.min(total, Math.max(start + 1, Math.floor((bucket + 1) * size)));
    let sum = 0;
    for (let index = start; index < end; index += 1) {
      const sample = channelData[index];
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / (end - start));
    peaks[bucket] = rms;
    if (rms > loudest) loudest = rms;
  }

  // Normalize against the track's own loudest moment so a quiet recording still
  // fills the meter, the way the old adaptive gain did on the live analyser.
  if (loudest > 0) {
    for (let bucket = 0; bucket < count; bucket += 1) peaks[bucket] /= loudest;
  }
  return peaks;
}

// A spectrum bounces: the whole meter rises and falls with how loud the track
// is right now, and each bar reads a slightly different moment so the movement
// travels across the strip instead of sitting still. Sampling a flat window of
// the waveform gave an even ramp that barely moved, which is not a visualizer.
export function spectrumFromPeaks(peaks, {
  position = 0,
  duration = 0,
  barCount = 64,
  trail = 0.9,
} = {}) {
  const bars = new Array(Math.max(1, barCount)).fill(0);
  const total = peaks?.length || 0;
  if (total === 0 || !(duration > 0)) return bars;

  const perSecond = total / duration;
  const centre = Math.min(total - 1, Math.max(0, position * perSecond));
  const now = peaks[Math.round(centre)];
  // Loud passages push every bar up; quiet ones let the whole meter fall.
  const pump = 0.28 + (Math.pow(now, 0.7) * 0.9);
  const stride = (trail * perSecond) / Math.max(1, bars.length - 1);

  for (let index = 0; index < bars.length; index += 1) {
    const lag = Math.round(centre - (index * stride));
    const band = peaks[Math.min(total - 1, Math.max(0, lag))];
    const tilt = 0.86 + ((index / (bars.length - 1 || 1)) * 0.32);
    bars[index] = Math.min(1, Math.pow(band, 0.62) * pump * tilt);
  }
  return bars;
}

export function hasUsablePeaks(peaks) {
  if (!peaks || peaks.length === 0) return false;
  for (let index = 0; index < peaks.length; index += 1) {
    if (peaks[index] > 0.01) return true;
  }
  return false;
}
