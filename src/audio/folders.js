// Folders sort an imported library into the two things a show actually needs:
// room music and performance tracks. A folder is a label on a track, not a
// place on disk, so moving a track never touches the audio itself.
export const UNSORTED = 'Unsorted';
export const DEFAULT_FOLDERS = Object.freeze(['BGM', 'Performance']);
export const ALL_FOLDERS = 'All';

const MAX_NAME = 24;

export function normalizeFolderName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
}

export function normalizeFolderState(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const seen = new Set();
  const folders = [];
  for (const name of [...DEFAULT_FOLDERS, ...(Array.isArray(raw.folders) ? raw.folders : [])]) {
    const clean = normalizeFolderName(name);
    if (!clean || clean === UNSORTED || clean === ALL_FOLDERS) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    folders.push(clean);
  }
  const assignments = {};
  const source = raw.assignments && typeof raw.assignments === 'object' ? raw.assignments : {};
  const allowed = new Set(folders.map(name => name.toLowerCase()));
  for (const [id, folder] of Object.entries(source)) {
    const clean = normalizeFolderName(folder);
    if (!id || !clean || !allowed.has(clean.toLowerCase())) continue;
    assignments[id] = folders.find(name => name.toLowerCase() === clean.toLowerCase());
  }
  return { folders, assignments };
}

export function fileKey(file) {
  return file?.id || file?.path || '';
}

export function trackFolder(state, file) {
  const key = fileKey(file);
  return (key && state?.assignments?.[key]) || UNSORTED;
}

export function assignFolder(state, file, folder) {
  const normalized = normalizeFolderState(state);
  const key = fileKey(file);
  if (!key) return normalized;
  const clean = normalizeFolderName(folder);
  const match = normalized.folders.find(name => name.toLowerCase() === clean.toLowerCase());
  const assignments = { ...normalized.assignments };
  if (!match) delete assignments[key];
  else assignments[key] = match;
  return { ...normalized, assignments };
}

export function createFolder(state, name) {
  const normalized = normalizeFolderState(state);
  const clean = normalizeFolderName(name);
  if (!clean || clean === UNSORTED || clean === ALL_FOLDERS) return normalized;
  if (normalized.folders.some(folder => folder.toLowerCase() === clean.toLowerCase())) return normalized;
  return { ...normalized, folders: [...normalized.folders, clean] };
}

export function renameFolder(state, from, to) {
  const normalized = normalizeFolderState(state);
  const clean = normalizeFolderName(to);
  const exists = normalized.folders.find(folder => folder === from);
  if (!exists || !clean || clean === UNSORTED || clean === ALL_FOLDERS) return normalized;
  if (normalized.folders.some(folder => folder !== from && folder.toLowerCase() === clean.toLowerCase())) {
    return normalized;
  }
  return {
    folders: normalized.folders.map(folder => (folder === from ? clean : folder)),
    assignments: Object.fromEntries(
      Object.entries(normalized.assignments).map(([id, folder]) => [id, folder === from ? clean : folder]),
    ),
  };
}

// Deleting a folder never deletes audio: its tracks fall back to Unsorted.
export function deleteFolder(state, name) {
  const normalized = normalizeFolderState(state);
  if (!normalized.folders.includes(name)) return normalized;
  return {
    folders: normalized.folders.filter(folder => folder !== name),
    assignments: Object.fromEntries(
      Object.entries(normalized.assignments).filter(([, folder]) => folder !== name),
    ),
  };
}

export function filesInFolder(files = [], state, folder) {
  if (!folder || folder === ALL_FOLDERS) return files;
  return files.filter(file => trackFolder(state, file) === folder);
}

export function foldersWithCounts(state, files = []) {
  const normalized = normalizeFolderState(state);
  const counts = new Map(normalized.folders.map(folder => [folder, 0]));
  let unsorted = 0;
  for (const file of files) {
    const folder = trackFolder(normalized, file);
    if (counts.has(folder)) counts.set(folder, counts.get(folder) + 1);
    else unsorted += 1;
  }
  return [
    { name: ALL_FOLDERS, count: files.length, fixed: true },
    ...normalized.folders.map(folder => ({ name: folder, count: counts.get(folder) || 0, fixed: false })),
    { name: UNSORTED, count: unsorted, fixed: true },
  ];
}
