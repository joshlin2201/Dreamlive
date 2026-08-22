export const SILENCE_FLOOR = 0.0001;
export const AUDIO_TRANSITION_SECONDS = Object.freeze({
  pause: 0.07,
  handoffOut: 0.18,
  handoffIn: 0.22,
  resume: 0.16,
  seek: 0.06,
});
export const CLICKLESS_MUTE_SECONDS = AUDIO_TRANSITION_SECONDS.pause;

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
