const MANAGED_AUDIO_PREFIX = 'idb:';

export function managedAudioRef(id) {
  return `${MANAGED_AUDIO_PREFIX}${id}`;
}

export function isManagedAudioRef(value) {
  return typeof value === 'string' && value.startsWith(MANAGED_AUDIO_PREFIX);
}

export function audioIdFromRef(value) {
  return isManagedAudioRef(value) ? value.slice(MANAGED_AUDIO_PREFIX.length) : null;
}

export function toLibraryMetadata(file) {
  const { fileData, path, ...metadata } = file;
  return {
    ...metadata,
    path: managedAudioRef(file.id),
  };
}

export function reconcileLibraryRemoval({
  files = [], playlist = [], currentIndex = 0, performances = [], completed = [], paths = [],
}) {
  const removed = new Set(paths);
  const currentPath = playlist[currentIndex];
  const nextPlaylist = playlist.filter(path => !removed.has(path));
  const preservedIndex = nextPlaylist.indexOf(currentPath);
  return {
    files: files.filter(file => !removed.has(file.path)),
    playlist: nextPlaylist,
    currentIndex: nextPlaylist.length === 0
      ? 0
      : (preservedIndex >= 0 ? preservedIndex : Math.min(currentIndex, nextPlaylist.length - 1)),
    performances: performances.map(path => (removed.has(path) ? '' : path)),
    completed: completed.map((value, index) => (removed.has(performances[index]) ? false : value)),
  };
}
