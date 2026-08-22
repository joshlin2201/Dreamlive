export const SILENCE_FLOOR = 0.0001;
export const FADE_FLOOR_RATIO = 0.05;
// Room transitions are meant to be heard. Every operator-triggered change runs
// a multi-second fade so a performance never cuts in or out on the floor.
export const AUDIO_TRANSITION_SECONDS = Object.freeze({
  // Pause is an operator stopping the room, not a transition: it lands now, with
  // only enough ramp to avoid a click. Every OTHER change is a heard fade.
  pause: 0.12,
  handoffOut: 3,
  handoffIn: 3.2,
  resume: 2.4,
  seek: 0.06,
  // How much of the outgoing fade keeps playing under the incoming track, so a
  // long fade reads as one continuous handoff instead of a silent gap.
  handoffOverlap: 2.4,
});
// Scrubbing stays immediate even though operator-triggered fades are expressive.
export const CLICKLESS_MUTE_SECONDS = 0.06;

// The wait before the next source starts: the outgoing tail covers the rest.
export function handoffLeadSeconds({
  out = AUDIO_TRANSITION_SECONDS.handoffOut,
  overlap = AUDIO_TRANSITION_SECONDS.handoffOverlap,
} = {}) {
  return Math.max(0, out - overlap);
}

export function setGainImmediately(gainParam, { currentTime, target }) {
  if (!gainParam) return;
  const safeTarget = Math.max(target, SILENCE_FLOOR);
  gainParam.cancelScheduledValues(currentTime);
  gainParam.setValueAtTime(safeTarget, currentTime);
}

export function scheduleGainEnvelope(gainParam, {
  currentTime,
  target,
  duration = CLICKLESS_MUTE_SECONDS,
}) {
  if (!gainParam) return 0;
  const safeCurrent = Math.max(gainParam.value, SILENCE_FLOOR);
  gainParam.cancelScheduledValues(currentTime);
  gainParam.setValueAtTime(safeCurrent, currentTime);
  if (duration <= 0) {
    gainParam.setValueAtTime(Math.max(target, SILENCE_FLOOR), currentTime);
    return 0;
  }
  if (target <= SILENCE_FLOOR) {
    // An exponential ramp all the way to the silence floor is already inaudible
    // for most of its length, so a three second fade is heard as the track
    // stopping early followed by dead air. Ride down to a quiet but real level
    // across the WHOLE fade, then cut the last sliver.
    gainParam.exponentialRampToValueAtTime(
      Math.max(SILENCE_FLOOR, safeCurrent * FADE_FLOOR_RATIO),
      currentTime + duration,
    );
    gainParam.setValueAtTime(SILENCE_FLOOR, currentTime + duration);
  } else {
    gainParam.exponentialRampToValueAtTime(
      Math.max(target, SILENCE_FLOOR),
      currentTime + duration,
    );
  }
  return duration * 1000;
}

// Where a fade starts from, and ends at: about -26 dB. Anything quieter is not
// heard as music, only as absence, so no part of a fade is spent down there.
export function fadeStartValue(target, current = 0) {
  const floor = Math.max(SILENCE_FLOOR, target * FADE_FLOOR_RATIO);
  return Math.max(current, floor);
}
