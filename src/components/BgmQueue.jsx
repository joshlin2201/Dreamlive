import React, { useRef, useState } from 'react';
import { GripVertical, Play, Shuffle, Trash2 } from 'lucide-react';

function BgmQueue({ playlist, currentIndex, heldIndex, playbackLocked, trackName, onPlay, onMove, onRemove, onShuffle }) {
  const dragRef = useRef({ from: null, to: null, pointerId: null });
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  const startDrag = (event, index) => {
    if (index === heldIndex) return;
    dragRef.current = { from: index, to: index, pointerId: event.pointerId };
    setDraggingIndex(index);
    setDropIndex(index);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = event => {
    if (dragRef.current.from === null) return;
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-queue-index]');
    const index = Number.parseInt(row?.dataset.queueIndex, 10);
    if (!Number.isInteger(index) || index === heldIndex) return;
    dragRef.current.to = index;
    setDropIndex(index);
  };

  const finishDrag = event => {
    const { from, to, pointerId } = dragRef.current;
    if (pointerId !== null) event.currentTarget.releasePointerCapture?.(pointerId);
    dragRef.current = { from: null, to: null, pointerId: null };
    setDraggingIndex(null);
    setDropIndex(null);
    if (from !== null && to !== null && from !== to) onMove(from, to);
  };

  const cancelDrag = event => {
    const { pointerId } = dragRef.current;
    if (pointerId !== null) event.currentTarget.releasePointerCapture?.(pointerId);
    dragRef.current = { from: null, to: null, pointerId: null };
    setDraggingIndex(null);
    setDropIndex(null);
  };

  return (
    <div className="bgm-queue" aria-label="Background playlist queue">
      <div className="bgm-queue-heading">
        <span>Autoplay queue ・ 自動再生</span>
        <div className="queue-heading-actions">
          <button type="button" onClick={onShuffle} disabled={playlist.length < 3} aria-label="Shuffle BGM queue">
            <Shuffle size={14} /> Shuffle
          </button>
          <strong>{playlist.length}</strong>
        </div>
      </div>
      {playlist.length === 0 ? (
        <p className="queue-empty">Tracks you add will autoplay in this order.</p>
      ) : playlist.map((path, index) => {
        const current = index === currentIndex;
        const locked = index === heldIndex;
        return (
          <div
            className={`queue-row ${current ? 'is-current' : ''} ${locked ? 'is-locked' : ''} ${draggingIndex === index ? 'is-dragging' : ''} ${dropIndex === index && draggingIndex !== index ? 'is-drop-target' : ''}`}
            data-queue-index={index}
            key={path}
          >
            <button
              type="button"
              className="queue-drag-handle"
              disabled={locked}
              onPointerDown={event => startDrag(event, index)}
              onPointerMove={moveDrag}
              onPointerUp={finishDrag}
              onPointerCancel={cancelDrag}
              onKeyDown={event => {
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  onMove(index, index - 1);
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  onMove(index, index + 1);
                }
              }}
              aria-label={`Reorder ${trackName(path)}. Use arrow keys or drag.`}
            >
              <GripVertical size={15} />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </button>
            <div className="queue-track-copy">
              <strong title={trackName(path)}>{trackName(path)}</strong>
              <span>{locked ? 'Held for return' : (current ? 'Current track' : 'Queued')}</span>
            </div>
            <div className="queue-row-actions">
              <button
                type="button"
                onClick={() => onPlay(index)}
                disabled={playbackLocked || current}
                aria-label={`Play ${trackName(path)} from here`}
                title={playbackLocked ? 'Available after the performance' : 'Play from here'}
              ><Play size={16} fill="currentColor" /></button>
              <button type="button" onClick={() => onRemove(index)} disabled={locked} aria-label={`Remove ${trackName(path)} from BGM queue`}><Trash2 size={16} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default BgmQueue;
