export function aggregateSpectrumBins(frequencyData, barCount = 48) {
  if (!frequencyData?.length || barCount < 1) return [];
  const bars = [];
  for (let bar = 0; bar < barCount; bar += 1) {
    const start = Math.floor((bar * frequencyData.length) / barCount);
    const end = Math.max(start + 1, Math.floor(((bar + 1) * frequencyData.length) / barCount));
    let total = 0;
    for (let index = start; index < Math.min(end, frequencyData.length); index += 1) {
      total += frequencyData[index];
    }
    bars.push(Math.min(1, Math.max(0, total / ((end - start) * 255))));
  }
  return bars;
}

export function createIdleSpectrum(barCount = 48) {
  return Array.from({ length: barCount }, (_, index) => (
    0.035 + (((index * 7) % 11) / 11) * 0.075
  ));
}

export function decaySpectrum(current, target, amount = 0.18) {
  return current.map((value, index) => {
    const destination = target[index] ?? 0;
    return Number((value + ((destination - value) * amount)).toFixed(4));
  });
}
