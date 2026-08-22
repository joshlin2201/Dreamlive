import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Play, Shuffle, Trash2 } from 'lucide-react';
import { queueDisplacement } from '../audio/playlist';

function BgmQueue({ playlist, currentIndex, heldIndex, playbackLocked, showPlayback = true, trackName, onPlay, onMove, onRemove, onShuffle }) {
  const dragRef = useRef({ from: null, to: null, pointerId: null });
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);

  const startDrag = (event, index) => {
    if (index === heldIndex) return;
    dragRef.current = { from: index, to: index, pointerId: event.pointerId };
    setDraggingIndex(index);
    setDropIndex(index);
    const row = event.currentTarget.closest('[data-queue-index]');
    const bounds = row?.getBoundingClientRect();
    if (bounds) {
      setDragGhost({
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        pointerOffset: event.clientY - bounds.top,
        path: playlist[index],
      });
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = event => {
    if (dragRef.current.from === null) return;
    setDragGhost(previous => previous ? {
      ...previous,
      top: event.clientY - previous.pointerOffset,
    } : previous);
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
    setDragGhost(null);
    if (from !== null && to !== null && from !== to) onMove(from, to);
  };

  const cancelDrag = event => {
    const { pointerId } = dragRef.current;
    if (pointerId !== null) event.currentTarget.releasePointerCapture?.(pointerId);
    dragRef.current = { from: null, to: null, pointerId: null };
    setDraggingIndex(null);
    setDropIndex(null);
    setDragGhost(null);
  };

  return (
    <>
    <div className={`bgm-queue ${draggingIndex !== null ? 'is-reordering' : ''}`} aria-label="Background playlist queue">
      <div className="bgm-queue-heading">
        <span>Autoplay <span className="japanese-label">オートプレイ</span></span>
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
        const displacement = queueDisplacement({
          index,
          fromIndex: draggingIndex,
          toIndex: dropIndex,
        });
        return (
          <div
            className={`queue-row ${current ? 'is-current' : ''} ${locked ? 'is-locked' : ''} ${draggingIndex === index ? 'is-dragging' : ''} ${displacement < 0 ? 'is-displaced-up' : ''} ${displacement > 0 ? 'is-displaced-down' : ''}`}
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
              {showPlayback && (
                <button
                  type="button"
                  onClick={() => onPlay(index)}
                  disabled={playbackLocked || current}
                  aria-label={`Play ${trackName(path)} from here`}
                  title={playbackLocked ? 'Available after the current performance' : 'Play from here'}
                ><Play size={16} fill="currentColor" /></button>
              )}
              <button type="button" onClick={() => onRemove(index)} disabled={locked} aria-label={`Remove ${trackName(path)} from BGM queue`}><Trash2 size={16} /></button>
            </div>
          </div>
        );
      })}
    </div>
    {dragGhost && createPortal(
      <div
        className="queue-drag-ghost"
        style={{ left: dragGhost.left, top: dragGhost.top, width: dragGhost.width }}
        aria-hidden="true"
      >
        <GripVertical size={15} />
        <div>
          <strong>{trackName(dragGhost.path)}</strong>
          <span>Move in queue</span>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

export default BgmQueue;
