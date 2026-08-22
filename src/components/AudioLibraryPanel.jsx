import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, ListPlus, Search, X } from 'lucide-react';
import { filterAudioLibrary } from '../audio/playlist';

function AudioLibraryPanel({ open, files, playlist, displayName, onAdd, onImport, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const { total, results } = useMemo(() => filterAudioLibrary(files, query), [files, query]);

  useEffect(() => {
    if (!open) return undefined;
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-library-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(index => Math.max(0, Math.min(results.length - 1, index + direction)));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      onAdd(results[activeIndex].path, 'next');
    }
  };

  return (
    <section className="audio-library-panel" aria-label="Audio library">
      <div className="audio-library-header">
        <div>
          <span className="control-eyebrow">On-device library ・ 音源</span>
          <h3>Find a track</h3>
        </div>
        <button type="button" className="control-button icon-button ghost-button" onClick={onClose} aria-label="Close audio library">
          <X size={19} />
        </button>
      </div>
      <div className="library-search-field">
        <Search size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={event => { setQuery(event.target.value); setActiveIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Search hundreds of tracks…"
          aria-label="Search track library"
        />
        <span>{total} result{total === 1 ? '' : 's'}</span>
      </div>
      {results.length > 0 ? (
        <div ref={listRef} className="library-results" role="listbox" aria-label="Matching tracks">
          {results.map((file, index) => {
            const queued = playlist.includes(file.path);
            return (
              <div
                key={file.id || file.path}
                data-library-index={index}
                className={`library-track-row ${index === activeIndex ? 'is-active' : ''}`}
                onPointerEnter={() => setActiveIndex(index)}
                role="option"
                aria-selected={index === activeIndex}
              >
                <span className="library-track-index">{String(index + 1).padStart(2, '0')}</span>
                <strong title={displayName(file.name)}>{displayName(file.name)}</strong>
                {queued ? (
                  <span className="queued-label">Queued</span>
                ) : (
                  <div className="library-row-actions">
                    <button type="button" onClick={() => onAdd(file.path, 'next')}>Add next</button>
                    <button type="button" onClick={() => onAdd(file.path, 'end')}>Add to end</button>
                  </div>
                )}
              </div>
            );
          })}
          {total > results.length && <p className="library-result-cap">Showing the first {results.length} of {total}. Refine your search to narrow the list.</p>}
        </div>
      ) : (
        <div className="library-empty-state">
          <ListPlus size={22} />
          <strong>No matching tracks</strong>
          <span>Import another file or try a different title.</span>
        </div>
      )}
      <button type="button" className="control-button secondary-button library-import-button" onClick={onImport}>
        <FolderOpen size={18} /> Import audio
      </button>
    </section>
  );
}

export default AudioLibraryPanel;
