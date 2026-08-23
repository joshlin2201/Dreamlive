import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, FolderOpen, FolderPlus, ListPlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { filterAudioLibrary } from '../audio/playlist';
import {
  ALL_FOLDERS,
  UNSORTED,
  filesInFolder,
  foldersWithCounts,
  trackFolder,
} from '../audio/folders';

function AudioLibraryPanel({
  open,
  files,
  playlist,
  displayName,
  onAdd,
  onImport,
  onRemove,
  onClear,
  onClose,
  folderState,
  onMoveToFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}) {
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState(ALL_FOLDERS);
  const [selected, setSelected] = useState(() => new Set());
  const [renaming, setRenaming] = useState(null);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const panelRef = useRef(null);

  const folders = useMemo(() => foldersWithCounts(folderState, files), [folderState, files]);
  const scoped = useMemo(() => filesInFolder(files, folderState, folder), [files, folderState, folder]);
  const { total, results } = useMemo(() => filterAudioLibrary(scoped, query), [scoped, query]);
  const moveTargets = useMemo(
    () => folders.filter(entry => entry.name !== ALL_FOLDERS).map(entry => entry.name),
    [folders],
  );

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const dismiss = event => {
      if (panelRef.current?.contains(event.target)) return;
      if (event.target.closest?.('[aria-controls="bgm-library-panel"]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setRenaming(null);
    }
  }, [open]);

  // A selection only ever means tracks you can still see.
  useEffect(() => {
    setSelected(previous => {
      const visible = new Set(scoped.map(file => file.path));
      const next = new Set([...previous].filter(path => visible.has(path)));
      return next.size === previous.size ? previous : next;
    });
  }, [scoped]);

  if (!open) return null;

  const toggle = path => setSelected(previous => {
    const next = new Set(previous);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });

  const allShownSelected = results.length > 0 && results.every(file => selected.has(file.path));
  const selectionCount = selected.size;

  const commitRename = () => {
    if (renaming && draftName.trim()) onRenameFolder(renaming, draftName);
    setRenaming(null);
    setDraftName('');
  };

  const handleCreate = () => {
    const name = window.prompt('Name this folder');
    if (name) onCreateFolder(name);
  };

  return (
    <section ref={panelRef} id="bgm-library-panel" className="audio-library-panel" aria-label="Audio library">
      <div className="audio-library-header">
        <h3>Your tracks <em>{files.length}</em></h3>
        <button type="button" className="library-close" onClick={onClose} aria-label="Close audio library">
          <X size={17} />
        </button>
      </div>

      <div className="library-folder-bar" role="tablist" aria-label="Folders">
        {folders.map(entry => (
          <button
            key={entry.name}
            type="button"
            role="tab"
            aria-selected={folder === entry.name}
            className={`library-folder-chip ${folder === entry.name ? 'is-active' : ''}`}
            onClick={() => setFolder(entry.name)}
          >
            {entry.name}
            <em>{entry.count}</em>
          </button>
        ))}
        <button type="button" className="library-folder-chip is-add" onClick={handleCreate} aria-label="New folder">
          <FolderPlus size={13} />
        </button>
      </div>

      {renaming === folder && (
        <div className="library-folder-rename-row">
          <input
            className="library-folder-rename"
            value={draftName}
            autoFocus
            onChange={event => setDraftName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') { setRenaming(null); setDraftName(''); }
            }}
            aria-label={`Rename ${folder}`}
          />
          <button type="button" className="library-inline-action" onClick={commitRename} aria-label="Save folder name">
            <Check size={15} />
          </button>
        </div>
      )}

      <div className="library-search-field">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
          placeholder="Search"
          aria-label="Search track library"
        />
        {results.length > 0 && (
          <button
            type="button"
            className={`library-select-all ${allShownSelected ? 'is-active' : ''}`}
            onClick={() => setSelected(allShownSelected ? new Set() : new Set(results.map(file => file.path)))}
          >
            {allShownSelected ? 'None' : 'All'}
          </button>
        )}
        {folder !== ALL_FOLDERS && folder !== UNSORTED && renaming !== folder && (
          <>
            <button type="button" className="library-inline-action" onClick={() => { setRenaming(folder); setDraftName(folder); }} aria-label={`Rename ${folder}`}>
              <Pencil size={14} />
            </button>
            <button type="button" className="library-inline-action" onClick={() => { onDeleteFolder(folder); setFolder(ALL_FOLDERS); }} aria-label={`Delete folder ${folder}`}>
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {results.length > 0 ? (
        <div ref={listRef} className="library-results" role="listbox" aria-multiselectable="true" aria-label="Tracks">
          {results.map((file, index) => {
            const queued = playlist.includes(file.path);
            const isSelected = selected.has(file.path);
            const name = displayName(file.name);
            return (
              <div
                key={file.id || file.path}
                data-library-index={index}
                className={`library-track-row ${isSelected ? 'is-selected' : ''}`}
                role="option"
                aria-selected={isSelected}
              >
                <button
                  type="button"
                  className="library-row-select"
                  onClick={() => toggle(file.path)}
                  aria-label={`${isSelected ? 'Deselect' : 'Select'} ${name}`}
                >
                  <span className="library-checkbox" aria-hidden="true">{isSelected && <Check size={12} />}</span>
                </button>
                <div className="library-track-copy">
                  <strong title={name}>{name}</strong>
                  {trackFolder(folderState, file) !== UNSORTED && (
                    <span className="library-track-folder">{trackFolder(folderState, file)}</span>
                  )}
                </div>
                <div className="library-row-actions">
                  <button
                    type="button"
                    className={`library-icon-action ${queued ? 'is-on' : ''}`}
                    onClick={() => !queued && onAdd(file.path)}
                    disabled={queued}
                    aria-label={queued ? `${name} is already in the BGM queue` : `Add ${name} to the BGM queue`}
                    title={queued ? 'In the BGM queue' : 'Add to the BGM queue'}
                  >
                    {queued ? <Check size={14} /> : <Plus size={15} />}
                  </button>
                  <button
                    type="button"
                    className="library-icon-action"
                    onClick={() => onRemove([file.path])}
                    aria-label={`Remove ${name} from this device`}
                    title="Remove from this device"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {total > results.length && (
            <p className="library-result-cap">Showing {results.length} of {total}. Search to narrow the list.</p>
          )}
        </div>
      ) : (
        <div className="library-empty-state">
          <ListPlus size={18} />
          <span>{folder === ALL_FOLDERS ? 'Import audio to get started.' : 'Nothing in this folder yet.'}</span>
        </div>
      )}

      {selectionCount > 0 && (
        <div className="library-bulk-bar" role="group" aria-label="Move selected tracks">
          <span>Move {selectionCount} to</span>
          <div className="library-bulk-targets">
            {moveTargets.map(target => (
              <button
                key={target}
                type="button"
                className="library-bulk-target"
                onClick={() => { onMoveToFolder([...selected], target); setSelected(new Set()); }}
              >
                {target}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="control-button is-quiet library-bulk-remove"
            onClick={() => { onRemove([...selected]); setSelected(new Set()); }}
          >
            <Trash2 size={14} /> Remove
          </button>
        </div>
      )}

      <div className="library-footer-actions">
        <button type="button" className="control-button secondary-button library-import-button" onClick={onImport}>
          <FolderOpen size={16} /> Import
        </button>
        <button type="button" className="control-button library-clear-button" onClick={onClear} disabled={files.length === 0}>
          <Trash2 size={14} /> Clear library
        </button>
      </div>
    </section>
  );
}

export default AudioLibraryPanel;
