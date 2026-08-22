import React from 'react';
import { ChevronDown, ChevronUp, Play, Trash2 } from 'lucide-react';

function BgmQueue({ playlist, currentIndex, heldIndex, playbackLocked, trackName, onPlay, onMove, onRemove }) {
  return (
    <div className="bgm-queue" aria-label="Background playlist queue">
      <div className="bgm-queue-heading">
        <span>Autoplay queue ・ 自動再生</span>
        <strong>{playlist.length}</strong>
      </div>
      {playlist.length === 0 ? (
        <p className="queue-empty">Tracks you add will autoplay in this order.</p>
      ) : playlist.map((path, index) => {
        const current = index === currentIndex;
        const locked = index === heldIndex;
        return (
          <div className={`queue-row ${current ? 'is-current' : ''} ${locked ? 'is-locked' : ''}`} key={path}>
            <span className="queue-position">{String(index + 1).padStart(2, '0')}</span>
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
              <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0 || locked || index - 1 === heldIndex} aria-label={`Move ${trackName(path)} earlier`}><ChevronUp size={16} /></button>
              <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === playlist.length - 1 || locked || index + 1 === heldIndex} aria-label={`Move ${trackName(path)} later`}><ChevronDown size={16} /></button>
              <button type="button" onClick={() => onRemove(index)} disabled={locked} aria-label={`Remove ${trackName(path)} from BGM queue`}><Trash2 size={16} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default BgmQueue;
