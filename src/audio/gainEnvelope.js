export const SILENCE_FLOOR = 0.0001;
export const CLICKLESS_MUTE_SECONDS = 0.035;

export function scheduleGainEnvelope(gainParam, {
  currentTime,
  target,
  duration = CLICKLESS_MUTE_SECONDS,
}) {
  if (!gainParam) return 0;
  const safeTarget = Math.max(target, SILENCE_FLOOR);
  const safeCurrent = Math.max(gainParam.value, SILENCE_FLOOR);
  gainParam.cancelScheduledValues(currentTime);
  gainParam.setValueAtTime(safeCurrent, currentTime);
  if (duration > 0) {
    gainParam.exponentialRampToValueAtTime(safeTarget, currentTime + duration);
  } else {
    gainParam.setValueAtTime(safeTarget, currentTime);
  }
  return duration * 1000;
}
