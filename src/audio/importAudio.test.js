import { inspectAudioFile, isNativeAudioRuntime, processAudioFiles } from './importAudio';

function createFile(name, { size = 1024, type = 'audio/mp4', lastModified = 42 } = {}) {
  return { name, size, type, lastModified };
}

describe('local audio import', () => {
  test('recognizes both Capacitor globals and the native URL scheme', () => {
    expect(isNativeAudioRuntime({
      Capacitor: { isNativePlatform: () => true },
      location: { protocol: 'https:' },
    })).toBe(true);
    expect(isNativeAudioRuntime({ location: { protocol: 'capacitor:' } })).toBe(true);
    expect(isNativeAudioRuntime({
      Capacitor: { isNativePlatform: () => false },
      location: { protocol: 'https:' },
    })).toBe(false);
  });

  test('explicitly starts metadata loading before accepting a track', async () => {
    const probe = {
      duration: 233.18,
      load: jest.fn(() => probe.onloadedmetadata()),
      removeAttribute: jest.fn(),
    };

    const duration = await inspectAudioFile('blob:track', {
      createAudio: () => probe,
      setTimer: () => 1,
      clearTimer: jest.fn(),
    });

    expect(probe.src).toBe('blob:track');
    expect(probe.preload).toBe('metadata');
    expect(probe.load).toHaveBeenCalledTimes(1);
    expect(duration).toBe(233.18);
    expect(probe.removeAttribute).toHaveBeenCalledWith('src');
  });

  test('rejects a media error and cleans up the probe', async () => {
    const probe = {
      load: jest.fn(() => probe.onerror()),
      removeAttribute: jest.fn(),
    };

    await expect(inspectAudioFile('blob:broken', {
      createAudio: () => probe,
      setTimer: () => 1,
      clearTimer: jest.fn(),
    })).rejects.toThrow('not playable');

    expect(probe.removeAttribute).toHaveBeenCalledWith('src');
    expect(probe.onloadedmetadata).toBeNull();
    expect(probe.onerror).toBeNull();
  });

  test('accepts supported files, reports rejected files, and preserves stable ids', async () => {
    const good = createFile('show-opening.m4a');
    const empty = createFile('empty.mp3', { size: 0, type: 'audio/mpeg' });
    const unsupported = createFile('notes.txt', { type: 'text/plain' });
    const progress = [];
    const revoked = [];

    const result = await processAudioFiles([good, empty, unsupported], {
      inspect: async () => 125,
      createObjectURL: file => `blob:${file.name}`,
      revokeObjectURL: url => revoked.push(url),
      onProgress: update => progress.push(update),
    });

    expect(result.accepted).toEqual([expect.objectContaining({
      id: 'file-show-opening.m4a-1024-42',
      name: 'show-opening.m4a',
      duration: 125,
      fileData: good,
    })]);
    expect(result.rejected.map(item => item.file.name)).toEqual(['empty.mp3', 'notes.txt']);
    expect(revoked).toEqual([]);
    expect(progress.at(-1)).toEqual({ completed: 3, total: 3 });
  });

  test('accepts a native audio file without a detached metadata probe', async () => {
    const nativeTrack = createFile('external-drive-track.mp3', {
      type: 'audio/mpeg',
      size: 9209512,
    });
    const inspect = jest.fn(() => Promise.reject(new Error('Audio metadata timed out.')));
    window.Capacitor = { isNativePlatform: () => true };

    let result;
    try {
      result = await processAudioFiles([nativeTrack], {
        inspect,
        createObjectURL: () => 'blob:native-track',
        revokeObjectURL: jest.fn(),
      });
    } finally {
      delete window.Capacitor;
    }

    expect(result.rejected).toEqual([]);
    expect(result.accepted).toEqual([expect.objectContaining({
      name: 'external-drive-track.mp3',
      path: 'blob:native-track',
      duration: 0,
      fileData: nativeTrack,
    })]);
    expect(inspect).not.toHaveBeenCalled();
  });

  test('limits simultaneous metadata probes to three', async () => {
    const files = Array.from({ length: 8 }, (_, index) => createFile(`track-${index}.mp3`, {
      type: 'audio/mpeg',
      lastModified: index,
    }));
    let active = 0;
    let maximumActive = 0;

    const result = await processAudioFiles(files, {
      concurrency: 3,
      createObjectURL: file => `blob:${file.name}`,
      revokeObjectURL: jest.fn(),
      inspect: () => new Promise(resolve => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        window.setTimeout(() => {
          active -= 1;
          resolve(60);
        }, 0);
      }),
    });

    expect(result.accepted).toHaveLength(8);
    expect(maximumActive).toBe(3);
  });
});
