import React from 'react';
import {
  ListMusic,
  Pause,
  Play,
  Repeat2,
  Search,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';

function BgmTransport({
  analyserRef,
  currentTrack,
  nextTrack,
  status,
  visualizerActive,
  elapsed,
  duration,
  formatTime,
  playing,
  playbackLocked,
  onPrevious,
  onToggle,
  onNext,
  onSeek,
  repeat,
  onToggleRepeat,
  volume,
  onVolumeChange,
  onOpenLibrary,
  libraryCount,
}) {
  const canPlay = Boolean(currentTrack) && !playbackLocked;
  return (
    <div className="bgm-transport-deck">
      <div className="bgm-track-signal">
        <div className="bgm-track-copy">
          <span className="control-eyebrow">Now playing ・ 再生中</span>
          <strong title={currentTrack || undefined}>{currentTrack || 'No BGM queued'}</strong>
          <span className="bgm-next-copy" title={nextTrack || undefined}>
            Up next: {nextTrack || 'End of playlist'}
          </span>
        </div>
        <AudioVisualizer
          analyserRef={analyserRef}
          active={visualizerActive}
          variant="compact"
          status={status}
        />
      </div>

      <div className="bgm-primary-controls" aria-label="BGM playback controls">
        <button
          type="button"
          className="control-button icon-button transport-button"
          onClick={onPrevious}
          disabled={!canPlay}
          aria-label="Previous BGM track"
          title={playbackLocked ? 'Available after the performance' : 'Previous track'}
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
          <span>{playing ? 'Pause BGM' : 'Play BGM'}</span>
        </button>
        <button
          type="button"
          className="control-button icon-button transport-button"
          onClick={onNext}
          disabled={!canPlay}
          aria-label="Next BGM track"
          title={playbackLocked ? 'Available after the performance' : 'Next track'}
        >
          <SkipForward size={20} />
        </button>
      </div>

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

      <div className="bgm-secondary-controls">
        <button type="button" className="control-button secondary-button" onClick={onOpenLibrary}>
          <Search size={18} />
          <span>Find track</span>
          <small>{libraryCount}</small>
        </button>
        <button
          type="button"
          className={`control-button ghost-button ${repeat ? 'is-active' : ''}`}
          onClick={onToggleRepeat}
          aria-pressed={repeat}
        >
          <Repeat2 size={18} />
          <span>Repeat</span>
        </button>
        <label className="bgm-level-control">
          <Volume2 size={18} aria-hidden="true" />
          <span>BGM</span>
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
      </div>

      {!currentTrack && (
        <p className="bgm-empty-prompt"><ListMusic size={18} /> Find a track to build the autoplay queue.</p>
      )}
    </div>
  );
}

export default BgmTransport;
