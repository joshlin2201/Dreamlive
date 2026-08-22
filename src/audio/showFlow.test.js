import {
  SHOW_PHASE,
  finishPerformanceFlow,
  getShowDeckState,
  getShowReadiness,
  nextPlaylistIndex,
  shouldShowRunDeck,
  startPerformanceFlow,
} from './showFlow';

describe('local show flow', () => {
  test('starts only after background audio is fully lowered', async () => {
    const events = [];

    await startPerformanceFlow({
      lowerBackground: async () => events.push('background:down'),
      playPerformance: async () => events.push('performance:play'),
      restoreBackground: async () => events.push('background:restore'),
      onPhase: phase => events.push(`phase:${phase}`),
    });

    expect(events).toEqual([
      `phase:${SHOW_PHASE.TRANSITIONING}`,
      'background:down',
      'performance:play',
      `phase:${SHOW_PHASE.LIVE}`,
    ]);
  });

  test('restores background audio when performance start fails', async () => {
    const events = [];
    const failure = new Error('file cannot play');

    await expect(startPerformanceFlow({
      lowerBackground: async () => events.push('background:down'),
      playPerformance: async () => { throw failure; },
      restoreBackground: async () => events.push('background:restore'),
      onPhase: phase => events.push(`phase:${phase}`),
    })).rejects.toBe(failure);

    expect(events).toEqual([
      `phase:${SHOW_PHASE.TRANSITIONING}`,
      'background:down',
      `phase:${SHOW_PHASE.RESTORING}`,
      'background:restore',
      `phase:${SHOW_PHASE.ERROR}`,
    ]);
  });

  test('restores background audio after a completed performance', async () => {
    const events = [];

    await finishPerformanceFlow({
      restoreBackground: async () => events.push('background:restore'),
      onPhase: phase => events.push(`phase:${phase}`),
    });

    expect(events).toEqual([
      `phase:${SHOW_PHASE.RESTORING}`,
      'background:restore',
      `phase:${SHOW_PHASE.READY}`,
    ]);
  });

  test('reports readiness from assigned performances without an output gate', () => {
    expect(getShowReadiness({
      outputReady: false,
      assignedPerformances: 1,
    })).toEqual({ phase: SHOW_PHASE.READY, label: 'Show ready', ready: true });
    expect(getShowReadiness({ playlistLength: 0, bgPlaying: false, assignedPerformances: 0 }))
      .toEqual({ phase: SHOW_PHASE.SETUP, label: 'Assign a performance', ready: false });
    expect(getShowReadiness({ playlistLength: 0, bgPlaying: false, assignedPerformances: 1 }))
      .toEqual({ phase: SHOW_PHASE.READY, label: 'Show ready', ready: true });
    expect(getShowReadiness({ playlistLength: 2, bgPlaying: true, assignedPerformances: 3 }))
      .toEqual({ phase: SHOW_PHASE.READY, label: 'Show ready', ready: true });
  });

  test('keeps the full setup visible until the show is ready', () => {
    expect(getShowDeckState({
      ready: false,
      assignments: [true, false, false, false],
      completed: [false, false, false, false],
      currentPerformance: null,
    })).toEqual({
      mode: 'prep',
      activePerformanceIndex: null,
      nextPerformanceIndex: 0,
      remainingAssignedCount: 1,
    });
  });

  test('keeps the operating players mounted while an imported library is being assigned', () => {
    expect(shouldShowRunDeck({ mode: 'prep', hasAudio: true })).toBe(true);
    expect(shouldShowRunDeck({ mode: 'prep', hasAudio: false })).toBe(false);
    expect(shouldShowRunDeck({ mode: 'ready', hasAudio: false })).toBe(true);
  });

  test('focuses the earliest assigned incomplete performance when ready', () => {
    expect(getShowDeckState({
      ready: true,
      assignments: [false, true, true, false],
      completed: [false, false, true, false],
      currentPerformance: null,
    })).toEqual({
      mode: 'ready',
      activePerformanceIndex: null,
      nextPerformanceIndex: 1,
      remainingAssignedCount: 1,
    });
  });

  test('advances the ready focus after a performance completes', () => {
    expect(getShowDeckState({
      ready: true,
      assignments: [true, true, true, false],
      completed: [true, false, false, false],
      currentPerformance: null,
    }).nextPerformanceIndex).toBe(1);
  });

  test('keeps the live performance dominant and previews the following cue', () => {
    expect(getShowDeckState({
      ready: false,
      assignments: [true, true, true, false],
      completed: [true, false, false, false],
      currentPerformance: 1,
    })).toEqual({
      mode: 'live',
      activePerformanceIndex: 1,
      nextPerformanceIndex: 2,
      remainingAssignedCount: 2,
    });
  });

  test('advances and repeats a background playlist deterministically', () => {
    expect(nextPlaylistIndex({ currentIndex: 0, length: 3, repeat: true })).toBe(1);
    expect(nextPlaylistIndex({ currentIndex: 2, length: 3, repeat: true })).toBe(0);
    expect(nextPlaylistIndex({ currentIndex: 2, length: 3, repeat: false })).toBeNull();
    expect(nextPlaylistIndex({ currentIndex: 0, length: 0, repeat: true })).toBeNull();
  });
});
