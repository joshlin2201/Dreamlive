import {
  canStartQueueDrag,
  filterAudioLibrary,
  insertPlaylistItem,
  movePlaylistItem,
  nextPlaylistIndex,
  playlistDisplayOrder,
  previousPlaylistAction,
  queuePlaylistItemNext,
  queueTrackShowsPause,
  queueDisplacement,
  queueDisplayIndex,
  removePlaylistItem,
  shufflePlaylist,
} from './playlist';

describe('background playlist rules', () => {
  test('keeps the held BGM row in its pause state during a performance', () => {
    expect(queueTrackShowsPause({ current: true, playing: false, queueOnly: true })).toBe(true);
    expect(queueTrackShowsPause({ current: false, pending: true, playing: false, queueOnly: true })).toBe(true);
    expect(queueTrackShowsPause({ current: true, playing: true, queueOnly: false })).toBe(true);
    expect(queueTrackShowsPause({ current: false, playing: true, queueOnly: true })).toBe(false);
  });

  test('shows the selected return track at the front while a performance owns playback', () => {
    expect(queueDisplayIndex({ currentIndex: 0, pendingIndex: 3, queueOnly: true })).toBe(3);
    expect(queueDisplayIndex({ currentIndex: 0, pendingIndex: 3, queueOnly: false })).toBe(0);
    expect(queueDisplayIndex({ currentIndex: 2, pendingIndex: -1, queueOnly: true })).toBe(2);
  });

  test('promotes a selected return track to the front of the upcoming queue', () => {
    expect(queuePlaylistItemNext({
      playlist: ['a', 'b', 'c', 'd'], index: 3, currentIndex: 1,
    })).toEqual({ playlist: ['a', 'b', 'd', 'c'], currentIndex: 1, queuedIndex: 2, changed: true });
    expect(queuePlaylistItemNext({
      playlist: ['a', 'b', 'c', 'd'], index: 0, currentIndex: 2,
    })).toEqual({ playlist: ['b', 'c', 'a', 'd'], currentIndex: 1, queuedIndex: 2, changed: true });
  });

  test('uses the track surface for reordering while protecting playback controls', () => {
    expect(canStartQueueDrag({ locked: false, collapsed: false, interactiveControl: false })).toBe(true);
    expect(canStartQueueDrag({ locked: true, collapsed: false, interactiveControl: false })).toBe(false);
    expect(canStartQueueDrag({ locked: false, collapsed: true, interactiveControl: false })).toBe(false);
    expect(canStartQueueDrag({ locked: false, collapsed: false, interactiveControl: true })).toBe(false);
  });

  test('presents the active track first without changing playback order', () => {
    expect(playlistDisplayOrder({ playlist: ['a', 'b', 'c', 'd'], currentIndex: 2 }))
      .toEqual([
        { path: 'c', sourceIndex: 2 },
        { path: 'd', sourceIndex: 3 },
        { path: 'a', sourceIndex: 0 },
        { path: 'b', sourceIndex: 1 },
      ]);
    expect(playlistDisplayOrder({
      playlist: ['a', 'b', 'c', 'd'], currentIndex: 2, maxItems: 1,
    })).toEqual([{ path: 'c', sourceIndex: 2 }]);
  });

  test('previous restarts after three seconds and otherwise moves backward', () => {
    expect(previousPlaylistAction({ currentIndex: 2, length: 4, currentTime: 8 }))
      .toEqual({ index: 2, restart: true });
    expect(previousPlaylistAction({ currentIndex: 2, length: 4, currentTime: 2 }))
      .toEqual({ index: 1, restart: false });
    expect(previousPlaylistAction({ currentIndex: 0, length: 4, currentTime: 0 }))
      .toEqual({ index: 0, restart: true });
  });

  test('next obeys the repeat boundary', () => {
    expect(nextPlaylistIndex({ currentIndex: 1, length: 3, repeat: false })).toBe(2);
    expect(nextPlaylistIndex({ currentIndex: 2, length: 3, repeat: true })).toBe(0);
    expect(nextPlaylistIndex({ currentIndex: 2, length: 3, repeat: false })).toBeNull();
  });

  test('loops only the selected track when single-track loop is active', () => {
    expect(nextPlaylistIndex({
      currentIndex: 1,
      length: 3,
      repeat: true,
      loopCurrent: true,
    })).toBe(1);
    expect(nextPlaylistIndex({
      currentIndex: 1,
      length: 3,
      repeat: true,
      loopCurrent: false,
    })).toBe(2);
  });

  test('inserts a unique track next or at the end without losing the current item', () => {
    expect(insertPlaylistItem({
      playlist: ['a', 'b'], item: 'c', mode: 'next', currentIndex: 0,
    })).toEqual({ playlist: ['a', 'c', 'b'], currentIndex: 0, changed: true });
    expect(insertPlaylistItem({
      playlist: ['a', 'b'], item: 'c', mode: 'end', currentIndex: 1,
    })).toEqual({ playlist: ['a', 'b', 'c'], currentIndex: 1, changed: true });
    expect(insertPlaylistItem({
      playlist: ['a', 'b'], item: 'b', mode: 'end', currentIndex: 0,
    }).changed).toBe(false);
  });

  test('reorders future items while preserving the current item index', () => {
    expect(movePlaylistItem({
      playlist: ['a', 'b', 'c', 'd'], fromIndex: 3, toIndex: 1, currentIndex: 0, lockedIndex: 0,
    })).toEqual({ playlist: ['a', 'd', 'b', 'c'], currentIndex: 0, changed: true });
    expect(movePlaylistItem({
      playlist: ['a', 'b', 'c'], fromIndex: 0, toIndex: 1, currentIndex: 0, lockedIndex: 0,
    }).changed).toBe(false);
  });

  test('displaces rows smoothly around the dragged queue item', () => {
    expect(queueDisplacement({ index: 1, fromIndex: 3, toIndex: 1 })).toBe(1);
    expect(queueDisplacement({ index: 2, fromIndex: 3, toIndex: 1 })).toBe(1);
    expect(queueDisplacement({ index: 2, fromIndex: 0, toIndex: 2 })).toBe(-1);
    expect(queueDisplacement({ index: 3, fromIndex: 0, toIndex: 2 })).toBe(0);
  });

  test('shuffles the queue without changing the selected current track', () => {
    const values = [0.2, 0.8, 0.1];
    let draw = 0;
    const result = shufflePlaylist({
      playlist: ['a', 'b', 'c', 'd'],
      currentIndex: 1,
      random: () => values[draw++],
    });

    expect(result.playlist).toEqual(['d', 'b', 'c', 'a']);
    expect(result.currentIndex).toBe(1);
    expect(result.playlist[result.currentIndex]).toBe('b');
    expect(result.changed).toBe(true);
  });

  test('removes future items but never removes a locked live item', () => {
    expect(removePlaylistItem({
      playlist: ['a', 'b', 'c'], index: 1, currentIndex: 2, lockedIndex: null,
    })).toEqual({ playlist: ['a', 'c'], currentIndex: 1, changed: true });
    expect(removePlaylistItem({
      playlist: ['a', 'b'], index: 0, currentIndex: 0, lockedIndex: 0,
    }).changed).toBe(false);
  });

  test('normalizes Japanese-capable search and caps rendering honestly', () => {
    const files = Array.from({ length: 130 }, (_, index) => ({
      path: `track-${index}`,
      name: index === 129 ? '葉月 恋 - 結び葉.m4a' : `Dream Track ${index}.mp3`,
    }));
    const broad = filterAudioLibrary(files, ' DREAM ');
    expect(broad.total).toBe(129);
    expect(broad.results).toHaveLength(100);
    expect(filterAudioLibrary(files, '結び葉').results[0].path).toBe('track-129');
  });
});
