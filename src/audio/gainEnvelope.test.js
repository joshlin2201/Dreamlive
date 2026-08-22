import {
  AUDIO_TRANSITION_SECONDS,
  CLICKLESS_MUTE_SECONDS,
  FADE_FLOOR_RATIO,
  SILENCE_FLOOR,
  fadeStartValue,
  handoffLeadSeconds,
  setGainImmediately,
  scheduleGainEnvelope,
} from './gainEnvelope';

describe('clickless gain envelope', () => {
  test('ramps from the current audible gain to a nonzero silence floor', () => {
    const calls = [];
    const gainParam = {
      value: 0.8,
      cancelScheduledValues: time => calls.push(['cancel', time]),
      setValueAtTime: (value, time) => calls.push(['set', value, time]),
      exponentialRampToValueAtTime: (value, time) => calls.push(['ramp', value, time]),
    };

    const waitMs = scheduleGainEnvelope(gainParam, {
      currentTime: 2,
      target: 0,
      duration: CLICKLESS_MUTE_SECONDS,
    });

    // The audible part of a fade-out spans the WHOLE duration and only then
    // cuts, instead of reaching inaudibility a third of the way through.
    expect(calls).toEqual([
      ['cancel', 2],
      ['set', 0.8, 2],
      ['ramp', 0.8 * FADE_FLOOR_RATIO, 2 + CLICKLESS_MUTE_SECONDS],
      ['set', SILENCE_FLOOR, 2 + CLICKLESS_MUTE_SECONDS],
    ]);
    expect(waitMs).toBe(CLICKLESS_MUTE_SECONDS * 1000);
  });

  test('a fade never spends its length below the level a room can hear', () => {
    // -26 dB, not -80 dB: the rise is audible from its first moment.
    expect(fadeStartValue(0.8)).toBeCloseTo(0.04, 6);
    // An already louder level is never yanked down to start a fade.
    expect(fadeStartValue(0.8, 0.5)).toBe(0.5);
    // A silent target still resolves above absolute zero.
    expect(fadeStartValue(0)).toBe(SILENCE_FLOOR);
  });

  test('every operator transition fades for seconds, not a blink', () => {
    expect(AUDIO_TRANSITION_SECONDS).toEqual({
      pause: 0.12,
      handoffOut: 3,
      handoffIn: 3.2,
      resume: 2.4,
      seek: 0.06,
      handoffOverlap: 2.4,
    });
    // Pause stops the room immediately; it is the one control that is not a fade.
    expect(AUDIO_TRANSITION_SECONDS.pause).toBeLessThan(0.2);
    expect(AUDIO_TRANSITION_SECONDS.pause).toBeGreaterThan(CLICKLESS_MUTE_SECONDS);
    ['handoffOut', 'handoffIn', 'resume'].forEach(key => {
      expect(AUDIO_TRANSITION_SECONDS[key]).toBeGreaterThanOrEqual(2);
    });
    expect(AUDIO_TRANSITION_SECONDS.handoffOut).toBeLessThan(
      AUDIO_TRANSITION_SECONDS.handoffIn,
    );
  });

  test('a long fade hands off under its own tail instead of leaving silence', () => {
    expect(handoffLeadSeconds()).toBeCloseTo(0.6, 5);
    expect(handoffLeadSeconds()).toBeLessThan(AUDIO_TRANSITION_SECONDS.handoffOut);
    expect(AUDIO_TRANSITION_SECONDS.handoffOverlap).toBeGreaterThan(1);
    // A fade shorter than the overlap must never wait a negative amount.
    expect(handoffLeadSeconds({ out: 0.4, overlap: 2.4 })).toBe(0);
  });

  test('takes manual volume control away from an in-flight fade', () => {
    const calls = [];
    const gainParam = {
      value: 0.3,
      cancelScheduledValues: time => calls.push(['cancel', time]),
      setValueAtTime: (value, time) => calls.push(['set', value, time]),
    };

    setGainImmediately(gainParam, { currentTime: 4, target: 0.72 });

    expect(calls).toEqual([
      ['cancel', 4],
      ['set', 0.72, 4],
    ]);
  });
});
