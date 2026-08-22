import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, GripVertical, ListPlus, MoreVertical, Pause, Play, Shuffle, Trash2 } from 'lucide-react';
import { playlistDisplayOrder, queueDisplacement } from '../audio/playlist';

function BgmQueue({ playlist, currentIndex, heldIndex, pendingIndex = null, playbackLocked, queueOnly = false, playing, showPlayback = true, trackName, onPlay, onQueue, onToggle, onMove, onRemove, onShuffle }) {
  const emptyDrag = () => ({
    from: null,
    to: null,
    pointerId: null,
    started: false,
    fromPosition: null,
    toPosition: null,
    armed: false,
    activationTimer: null,
    handle: null,
    originX: 0,
    originY: 0,
    bounds: null,
    pointerOffsetX: 0,
  });
  const dragRef = useRef(emptyDrag());
  const queueRef = useRef(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [draggingPosition, setDraggingPosition] = useState(null);
  const [dropPosition, setDropPosition] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const orderedPlaylist = playlistDisplayOrder({ playlist, currentIndex });

  const clearDragTimer = drag => {
    if (drag.activationTimer !== null) window.clearTimeout(drag.activationTimer);
  };

  useEffect(() => () => clearDragTimer(dragRef.current), []);

  useEffect(() => {
    queueRef.current?.scrollTo?.({ top: 0, left: 0, behavior: 'smooth' });
    setRowMenu(null);
  }, [currentIndex]);

  useEffect(() => {
    if (!rowMenu) return undefined;
    const dismiss = event => {
      if (event.target.closest?.('[data-queue-menu], [data-queue-menu-trigger]')) return;
      setRowMenu(null);
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') setRowMenu(null);
    };
    const close = () => setRowMenu(null);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', close);
    queueRef.current?.addEventListener('scroll', close, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', close);
      queueRef.current?.removeEventListener('scroll', close);
    };
  }, [rowMenu]);

  const activateTrack = index => (
    queueOnly ? onQueue(index) : (index === currentIndex ? onToggle() : onPlay(index))
  );

  const openRowMenu = (event, index) => {
    if (rowMenu?.index === index) {
      setRowMenu(null);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const width = 176;
    const height = showPlayback && queueOnly ? 94 : 50;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, bounds.right - width));
    const top = window.innerHeight - bounds.bottom > height + 8
      ? bounds.bottom + 4
      : Math.max(8, bounds.top - height - 4);
    setRowMenu({ index, left, top, width });
  };

  const startDrag = (event, index, position) => {
    if (index === heldIndex) return;
    const row = event.currentTarget.closest('[data-queue-index]');
    const bounds = row?.getBoundingClientRect();
    dragRef.current = {
      from: index,
      to: index,
      fromPosition: position,
      toPosition: position,
      pointerId: event.pointerId,
      started: false,
      armed: event.pointerType !== 'touch',
      activationTimer: null,
      handle: event.currentTarget,
      originX: event.clientX,
      originY: event.clientY,
      bounds,
      pointerOffsetX: bounds ? event.clientX - bounds.left : 0,
    };
    if (event.pointerType === 'touch') {
      dragRef.current.activationTimer = window.setTimeout(() => {
        if (dragRef.current.from === index) dragRef.current.armed = true;
      }, 180);
    }
  };

  const moveDrag = event => {
    const drag = dragRef.current;
    if (drag.from === null) return;
    if (!drag.started) {
      if (!drag.armed) return;
      const distance = Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY);
      if (distance < 7 || !drag.bounds) return;
      clearDragTimer(drag);
      drag.started = true;
      drag.handle?.setPointerCapture?.(drag.pointerId);
      setDraggingIndex(drag.from);
      setDraggingPosition(drag.fromPosition);
      setDropPosition(drag.fromPosition);
      setDragGhost({
        left: drag.bounds.left,
        top: drag.bounds.top,
        width: drag.bounds.width,
        pointerOffsetX: drag.pointerOffsetX,
        pointerOffset: drag.originY - drag.bounds.top,
        path: playlist[drag.from],
      });
    }
    event.preventDefault();
    setDragGhost(previous => previous ? {
      ...previous,
      left: event.clientX - previous.pointerOffsetX,
      top: event.clientY - previous.pointerOffset,
    } : previous);
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-queue-index]');
    const index = Number.parseInt(row?.dataset.queueIndex, 10);
    const position = Number.parseInt(row?.dataset.queuePosition, 10);
    if (!Number.isInteger(index) || index === heldIndex) return;
    dragRef.current.to = index;
    dragRef.current.toPosition = position;
    setDropPosition(position);
  };

  const finishDrag = event => {
    const drag = dragRef.current;
    const { from, to, pointerId, started } = drag;
    clearDragTimer(drag);
    if (pointerId !== null && event.currentTarget.hasPointerCapture?.(pointerId)) {
      event.currentTarget.releasePointerCapture?.(pointerId);
    }
    dragRef.current = emptyDrag();
    setDraggingIndex(null);
    setDraggingPosition(null);
    setDropPosition(null);
    setDragGhost(null);
    if (started && from !== null && to !== null && from !== to) onMove(from, to);
  };

  const cancelDrag = event => {
    const drag = dragRef.current;
    const { pointerId } = drag;
    clearDragTimer(drag);
    if (pointerId !== null && event.currentTarget.hasPointerCapture?.(pointerId)) {
      event.currentTarget.releasePointerCapture?.(pointerId);
    }
    dragRef.current = emptyDrag();
    setDraggingIndex(null);
    setDraggingPosition(null);
    setDropPosition(null);
    setDragGhost(null);
  };

  return (
    <>
    <div ref={queueRef} className={`bgm-queue ${draggingIndex !== null ? 'is-reordering' : ''}`} aria-label="Background playlist queue">
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
      ) : orderedPlaylist.map(({ path, sourceIndex: index }, position) => {
        const current = index === currentIndex;
        const locked = index === heldIndex;
        const pending = index === pendingIndex;
        const displacement = queueDisplacement({
          index: position,
          fromIndex: draggingPosition,
          toIndex: dropPosition,
        });
        return (
          <div
            className={`queue-row ${current ? 'is-current' : ''} ${pending ? 'is-pending' : ''} ${locked ? 'is-locked' : ''} ${draggingIndex === index ? 'is-dragging' : ''} ${displacement < 0 ? 'is-displaced-up' : ''} ${displacement > 0 ? 'is-displaced-down' : ''}`}
            data-queue-index={index}
            data-queue-position={position}
            key={path}
          >
            <button
              type="button"
              className="queue-drag-handle"
              disabled={locked}
              onPointerDown={event => startDrag(event, index, position)}
              onPointerMove={moveDrag}
              onPointerUp={finishDrag}
              onPointerCancel={cancelDrag}
              onKeyDown={event => {
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  const previous = orderedPlaylist[position - 1];
                  if (previous) onMove(index, previous.sourceIndex);
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  const next = orderedPlaylist[position + 1];
                  if (next) onMove(index, next.sourceIndex);
                }
              }}
              aria-label={`Reorder ${trackName(path)}. Use arrow keys or hold, then drag.`}
            >
              <GripVertical size={15} />
              <span>{String(position + 1).padStart(2, '0')}</span>
            </button>
            <div className="queue-track-cluster">
              {showPlayback && !queueOnly && (
                <button
                  type="button"
                  className="queue-playback-button"
                  onClick={() => activateTrack(index)}
                  disabled={playbackLocked}
                  aria-label={current && playing
                    ? `Pause ${trackName(path)}`
                    : `Play ${trackName(path)} from here`}
                  title={current && playing ? 'Pause' : 'Play'}
                >
                  {current && playing
                    ? <Pause size={16} fill="currentColor" />
                    : <Play size={16} fill="currentColor" />}
                </button>
              )}
              <button
                type="button"
                className="queue-track-copy"
                onClick={() => activateTrack(index)}
                disabled={playbackLocked}
                aria-label={queueOnly
                  ? `Select ${trackName(path)} to play after performance`
                  : (current && playing ? `Pause ${trackName(path)}` : `Play ${trackName(path)} from here`)}
              >
                <strong title={trackName(path)}>{trackName(path)}</strong>
              </button>
            </div>
            <div className="queue-row-actions">
              <button
                type="button"
                data-queue-menu-trigger
                onClick={event => openRowMenu(event, index)}
                aria-label={`More options for ${trackName(path)}`}
                aria-expanded={rowMenu?.index === index}
                title="More options"
              >
                <MoreVertical size={17} />
              </button>
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
    {rowMenu && playlist[rowMenu.index] && createPortal(
      <div
        className="queue-row-popover"
        data-queue-menu
        role="menu"
        aria-label={`Options for ${trackName(playlist[rowMenu.index])}`}
        style={{ left: rowMenu.left, top: rowMenu.top, width: rowMenu.width }}
      >
        {showPlayback && queueOnly && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              activateTrack(rowMenu.index);
              setRowMenu(null);
            }}
            disabled={playbackLocked}
          >
            {queueOnly
              ? (rowMenu.index === pendingIndex ? <Check size={15} /> : <ListPlus size={15} />)
              : (rowMenu.index === currentIndex && playing ? <Pause size={15} /> : <Play size={15} />)}
            <span>{queueOnly
              ? (rowMenu.index === pendingIndex ? 'Queued next' : 'Queue next')
              : (rowMenu.index === currentIndex && playing ? 'Pause' : 'Play from here')}</span>
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          className="is-danger"
          onClick={() => {
            onRemove(rowMenu.index);
            setRowMenu(null);
          }}
          disabled={rowMenu.index === heldIndex}
        >
          <Trash2 size={15} />
          <span>Remove</span>
        </button>
      </div>,
      document.body
    )}
    </>
  );
}

export default BgmQueue;
