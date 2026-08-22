import {
  AUDIO_TRANSITION_SECONDS,
  CLICKLESS_MUTE_SECONDS,
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

    expect(calls).toEqual([
      ['cancel', 2],
      ['set', 0.8, 2],
      ['ramp', 0.0001, 2 + CLICKLESS_MUTE_SECONDS],
    ]);
    expect(waitMs).toBe(CLICKLESS_MUTE_SECONDS * 1000);
  });

  test('uses fast ordered envelopes for every operator transition', () => {
    expect(AUDIO_TRANSITION_SECONDS).toEqual({
      pause: 0.07,
      handoffOut: 0.18,
      handoffIn: 0.22,
      resume: 0.16,
      seek: 0.06,
    });
    expect(AUDIO_TRANSITION_SECONDS.handoffOut).toBeLessThan(
      AUDIO_TRANSITION_SECONDS.handoffIn,
    );
    expect(AUDIO_TRANSITION_SECONDS.handoffIn).toBeLessThanOrEqual(0.25);
  });
});
