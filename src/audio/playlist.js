const unchanged = (playlist, currentIndex) => ({ playlist, currentIndex, changed: false });

export function playlistDisplayOrder({ playlist, currentIndex = 0 }) {
  if (playlist.length === 0) return [];
  const safeIndex = Math.max(0, Math.min(currentIndex, playlist.length - 1));
  const entries = playlist.map((path, sourceIndex) => ({ path, sourceIndex }));
  return [...entries.slice(safeIndex), ...entries.slice(0, safeIndex)];
}

export function nextPlaylistIndex({ currentIndex, length, repeat }) {
  if (length < 1) return null;
  const next = currentIndex + 1;
  if (next < length) return next;
  return repeat ? 0 : null;
}

export function previousPlaylistAction({ currentIndex, length, currentTime, restartThreshold = 3 }) {
  if (length < 1) return { index: null, restart: false };
  if (currentTime > restartThreshold || currentIndex <= 0) {
    return { index: Math.max(0, Math.min(currentIndex, length - 1)), restart: true };
  }
  return { index: currentIndex - 1, restart: false };
}

export function insertPlaylistItem({ playlist, item, mode = 'end', currentIndex = 0 }) {
  if (!item || playlist.includes(item)) return unchanged(playlist, currentIndex);
  const insertionIndex = mode === 'next' && playlist.length > 0
    ? Math.min(currentIndex + 1, playlist.length)
    : playlist.length;
  const next = [...playlist];
  next.splice(insertionIndex, 0, item);
  return { playlist: next, currentIndex, changed: true };
}

export function movePlaylistItem({
  playlist,
  fromIndex,
  toIndex,
  currentIndex = 0,
  lockedIndex = null,
}) {
  const valid = fromIndex >= 0 && fromIndex < playlist.length
    && toIndex >= 0 && toIndex < playlist.length;
  if (!valid || fromIndex === toIndex || fromIndex === lockedIndex || toIndex === lockedIndex) {
    return unchanged(playlist, currentIndex);
  }

  const currentItem = playlist[currentIndex];
  const next = [...playlist];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return {
    playlist: next,
    currentIndex: Math.max(0, next.indexOf(currentItem)),
    changed: true,
  };
}

export function queueDisplacement({ index, fromIndex, toIndex }) {
  if (fromIndex === null || toIndex === null || fromIndex === toIndex || index === fromIndex) return 0;
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return -1;
  if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return 1;
  return 0;
}

export function shufflePlaylist({ playlist, currentIndex = 0, random = Math.random }) {
  if (playlist.length < 2) return unchanged(playlist, currentIndex);
  const safeCurrentIndex = Math.max(0, Math.min(currentIndex, playlist.length - 1));
  const currentItem = playlist[safeCurrentIndex];
  const next = playlist.filter((_, index) => index !== safeCurrentIndex);
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  next.splice(safeCurrentIndex, 0, currentItem);
  const changed = next.some((item, index) => item !== playlist[index]);
  return changed
    ? { playlist: next, currentIndex: safeCurrentIndex, changed: true }
    : unchanged(playlist, safeCurrentIndex);
}

export function removePlaylistItem({ playlist, index, currentIndex = 0, lockedIndex = null }) {
  if (index < 0 || index >= playlist.length || index === lockedIndex) {
    return unchanged(playlist, currentIndex);
  }
  const currentItem = playlist[currentIndex];
  const next = playlist.filter((_, itemIndex) => itemIndex !== index);
  return {
    playlist: next,
    currentIndex: next.length === 0
      ? 0
      : Math.max(0, next.indexOf(currentItem) >= 0 ? next.indexOf(currentItem) : Math.min(currentIndex, next.length - 1)),
    changed: true,
  };
}

export function filterAudioLibrary(files, query, limit = 100) {
  const normalized = String(query || '').normalize('NFKC').trim().toLocaleLowerCase();
  const matches = normalized
    ? files.filter(file => String(file.name || '').normalize('NFKC').toLocaleLowerCase().includes(normalized))
    : files;
  return { total: matches.length, results: matches.slice(0, limit) };
}
