import { reconcileLibraryRemoval, toLibraryMetadata } from './libraryStorage';

describe('audio library storage model', () => {
  test('keeps file payloads out of the in-memory library', () => {
    const fileData = new Blob(['audio bytes'], { type: 'audio/mpeg' });
    const metadata = toLibraryMetadata({
      id: 'file-room-bgm',
      name: 'Room BGM.mp3',
      path: 'blob:temporary-import',
      size: fileData.size,
      type: fileData.type,
      duration: 120,
      fileData,
    });

    expect(metadata).toEqual({
      id: 'file-room-bgm',
      name: 'Room BGM.mp3',
      path: 'idb:file-room-bgm',
      size: fileData.size,
      type: fileData.type,
      duration: 120,
    });
    expect(metadata).not.toHaveProperty('fileData');
  });
});

describe('library removal reconciliation', () => {
  test('removes device, queue, and cue references while preserving the current track when possible', () => {
    expect(reconcileLibraryRemoval({
      files: [{ path: 'a' }, { path: 'b' }, { path: 'c' }],
      playlist: ['a', 'b', 'c'],
      currentIndex: 1,
      performances: ['a', 'b', '', 'c'],
      completed: [true, true, false, true],
      paths: ['a', 'c'],
    })).toEqual({
      files: [{ path: 'b' }],
      playlist: ['b'],
      currentIndex: 0,
      performances: ['', 'b', '', ''],
      completed: [false, true, false, false],
    });
  });
});
