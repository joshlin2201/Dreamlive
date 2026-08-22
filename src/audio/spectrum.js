export function aggregateSpectrumBins(frequencyData, barCount = 48, output = null, coverage = 1) {
  if (!frequencyData?.length || barCount < 1) return [];
  const bars = output?.length === barCount ? output : Array(barCount).fill(0);
  const usableLength = Math.max(1, Math.min(
    frequencyData.length,
    Math.floor(frequencyData.length * Math.max(0.1, Math.min(1, coverage)))
  ));
  for (let bar = 0; bar < barCount; bar += 1) {
    const start = Math.floor((bar * usableLength) / barCount);
    const end = Math.max(start + 1, Math.floor(((bar + 1) * usableLength) / barCount));
    let total = 0;
    for (let index = start; index < Math.min(end, usableLength); index += 1) {
      total += frequencyData[index];
    }
    bars[bar] = Math.min(1, Math.max(0, total / ((end - start) * 255)));
  }
  return bars;
}

export function createIdleSpectrum(barCount = 48) {
  return Array.from({ length: barCount }, (_, index) => (
    0.035 + (((index * 7) % 11) / 11) * 0.075
  ));
}

export function decaySpectrum(current, target, amount = 0.18, output = null) {
  return smoothSpectrum(current, target, { attack: amount, release: amount }, output);
}

export function smoothSpectrum(
  current,
  target,
  { attack = 0.68, release = 0.16 } = {},
  output = null
) {
  const values = output?.length === current.length ? output : Array(current.length).fill(0);
  for (let index = 0; index < current.length; index += 1) {
    const value = current[index];
    const destination = target[index] ?? 0;
    const amount = destination > value ? attack : release;
    values[index] = Math.round((value + ((destination - value) * amount)) * 10000) / 10000;
  }
  return values;
}
