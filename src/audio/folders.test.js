import {
  ALL_FOLDERS,
  DEFAULT_FOLDERS,
  UNSORTED,
  assignFolder,
  createFolder,
  deleteFolder,
  filesInFolder,
  foldersWithCounts,
  normalizeFolderState,
  renameFolder,
  trackFolder,
} from './folders';

const files = [
  { id: 'a', path: 'idb:a', name: 'One.mp3' },
  { id: 'b', path: 'idb:b', name: 'Two.mp3' },
  { id: 'c', path: 'idb:c', name: 'Three.mp3' },
];

describe('library folders', () => {
  test('a fresh library always offers the two folders a show needs', () => {
    const state = normalizeFolderState(undefined);
    expect(state.folders).toEqual([...DEFAULT_FOLDERS]);
    expect(state.assignments).toEqual({});
    expect(trackFolder(state, files[0])).toBe(UNSORTED);
  });

  test('a track moves between folders and can be moved back out', () => {
    let state = assignFolder(normalizeFolderState(), files[0], 'BGM');
    expect(trackFolder(state, files[0])).toBe('BGM');
    state = assignFolder(state, files[0], 'Performance');
    expect(trackFolder(state, files[0])).toBe('Performance');
    state = assignFolder(state, files[0], UNSORTED);
    expect(trackFolder(state, files[0])).toBe(UNSORTED);
  });

  test('folder names are cleaned, deduplicated, and never shadow the fixed views', () => {
    let state = createFolder(normalizeFolderState(), '  Encore   set  ');
    expect(state.folders).toContain('Encore set');
    state = createFolder(state, 'encore SET');
    expect(state.folders.filter(f => f.toLowerCase() === 'encore set')).toHaveLength(1);
    expect(createFolder(state, ALL_FOLDERS).folders).not.toContain(ALL_FOLDERS);
    expect(createFolder(state, UNSORTED).folders).not.toContain(UNSORTED);
    expect(createFolder(state, '   ').folders).toEqual(state.folders);
  });

  test('renaming carries every track with it', () => {
    let state = assignFolder(normalizeFolderState(), files[0], 'BGM');
    state = assignFolder(state, files[1], 'BGM');
    state = renameFolder(state, 'BGM', 'Room music');
    expect(state.folders).toContain('Room music');
    expect(trackFolder(state, files[0])).toBe('Room music');
    expect(trackFolder(state, files[1])).toBe('Room music');
  });

  test('deleting a folder returns its tracks to Unsorted, never deletes them', () => {
    let state = assignFolder(normalizeFolderState(), files[0], 'Performance');
    state = deleteFolder(state, 'Performance');
    expect(state.folders).not.toContain('Performance');
    expect(trackFolder(state, files[0])).toBe(UNSORTED);
    expect(filesInFolder(files, state, ALL_FOLDERS)).toHaveLength(3);
  });

  test('a stored state that names a folder which no longer exists forgets it', () => {
    const state = normalizeFolderState({ folders: ['BGM'], assignments: { a: 'Ghost', b: 'BGM' } });
    expect(state.assignments).toEqual({ b: 'BGM' });
  });

  test('counts cover every track exactly once', () => {
    let state = assignFolder(normalizeFolderState(), files[0], 'BGM');
    state = assignFolder(state, files[1], 'Performance');
    const counts = foldersWithCounts(state, files);
    const byName = Object.fromEntries(counts.map(entry => [entry.name, entry.count]));
    expect(byName[ALL_FOLDERS]).toBe(3);
    expect(byName.BGM).toBe(1);
    expect(byName.Performance).toBe(1);
    expect(byName[UNSORTED]).toBe(1);
    const tallied = counts.filter(entry => entry.name !== ALL_FOLDERS).reduce((a, e) => a + e.count, 0);
    expect(tallied).toBe(files.length);
  });

  test('Unsorted leads while it has tracks, All closes the row, and Unsorted goes away when empty', () => {
    let state = assignFolder(normalizeFolderState(), files[0], 'BGM');
    const withPile = foldersWithCounts(state, files).map(entry => entry.name);
    expect(withPile[0]).toBe(UNSORTED);
    expect(withPile[withPile.length - 1]).toBe(ALL_FOLDERS);

    state = assignFolder(state, files[1], 'BGM');
    state = assignFolder(state, files[2], 'Performance');
    const sorted = foldersWithCounts(state, files).map(entry => entry.name);
    expect(sorted).not.toContain(UNSORTED);
    expect(sorted[sorted.length - 1]).toBe(ALL_FOLDERS);
  });

  test('filtering by folder returns only that folder, and All returns everything', () => {
    const state = assignFolder(normalizeFolderState(), files[2], 'BGM');
    expect(filesInFolder(files, state, 'BGM').map(f => f.id)).toEqual(['c']);
    expect(filesInFolder(files, state, UNSORTED).map(f => f.id)).toEqual(['a', 'b']);
    expect(filesInFolder(files, state, ALL_FOLDERS)).toHaveLength(3);
  });
});
