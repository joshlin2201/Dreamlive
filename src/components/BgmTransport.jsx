import React from 'react';
import {
  ListMusic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';

function BgmTransport({
  currentTrack,
  nextTrack,
  elapsed,
  duration,
  formatTime,
  playing,
  playbackLocked,
  onPrevious,
  onToggle,
  onNext,
  onSeek,
  volume,
  onVolumeChange,
  showProgress = true,
}) {
  const canPlay = Boolean(currentTrack) && !playbackLocked;
  return (
    <div className={`bgm-transport-deck ${showProgress ? '' : 'is-progress-hidden'}`}>
      <div className="bgm-track-copy">
        {(playbackLocked || playing) && (
          <span className="control-eyebrow">
            {playbackLocked ? (
              <>Held <span className="japanese-label">ホールド中</span></>
            ) : (
              <>Playing <span className="japanese-label">プレイ中</span></>
            )}
          </span>
        )}
        <strong title={currentTrack || undefined}>{currentTrack || 'No BGM queued'}</strong>
        <span className="bgm-next-copy" title={nextTrack || undefined}>
          Up next: {nextTrack || 'End of playlist'}
        </span>
      </div>

      <div className="bgm-primary-controls" aria-label="BGM playback controls">
        <button
          type="button"
          className="control-button icon-button transport-button"
          onClick={onPrevious}
          disabled={!canPlay}
          aria-label="Previous BGM track"
          title={playbackLocked ? 'Available after the current performance' : 'Previous track'}
        >
          <SkipBack size={20} />
        </button>
        <button
          type="button"
          className={`control-button bgm-play-button ${playing ? 'is-playing' : ''}`}
          onClick={onToggle}
          disabled={!canPlay}
          aria-label={playing ? 'Pause background music' : 'Play background music'}
        >
          {playing ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
          <span>{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button
          type="button"
          className="control-button icon-button transport-button"
          onClick={onNext}
          disabled={!canPlay}
          aria-label="Next BGM track"
          title={playbackLocked ? 'Available after the current performance' : 'Next track'}
        >
          <SkipForward size={20} />
        </button>
        <details className="bgm-level-menu">
          <summary aria-label={`BGM level ${Math.round(volume * 100)} percent`}>
            <Volume2 size={17} aria-hidden="true" />
            <span>{Math.round(volume * 100)}%</span>
          </summary>
          <label className="bgm-level-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={onVolumeChange}
              aria-label="BGM volume"
            />
            <strong>{Math.round(volume * 100)}%</strong>
          </label>
        </details>
      </div>

      {showProgress && (
        <div className="bgm-progress-row">
          <span>{formatTime(elapsed)}</span>
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            value={Math.min(elapsed, duration || 1)}
            onChange={event => onSeek(event.target.value)}
            disabled={!duration || playbackLocked}
            aria-label="Seek background music"
          />
          <span>{formatTime(duration)}</span>
        </div>
      )}

      {!currentTrack && (
        <p className="bgm-empty-prompt"><ListMusic size={18} /> Find a track to build the autoplay queue.</p>
      )}
    </div>
  );
}

export default BgmTransport;
