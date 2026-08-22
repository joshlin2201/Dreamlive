import React from 'react';
import { Pause, Play, Square, Theater } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';

function LiveSetupDock({
  visible,
  analyserRef,
  performanceNumber,
  title,
  status,
  playing,
  elapsed,
  duration,
  formatTime,
  onToggle,
  onReturn,
  onStop,
}) {
  if (!visible) return null;
  return (
    <aside className="live-setup-dock" aria-label="Active performance controls">
      <div className="live-dock-identity">
        <span className="live-dock-badge">{status}</span>
        <div>
          <span>Performance {performanceNumber} ・ 出演中</span>
          <strong title={title}>{title}</strong>
        </div>
      </div>
      <AudioVisualizer analyserRef={analyserRef} active={playing} variant="compact" status={`Performance ${status.toLowerCase()}`} />
      <div className="live-dock-progress">
        <span>{formatTime(elapsed)}</span>
        <progress max={duration || 1} value={elapsed} />
        <span>{formatTime(duration)}</span>
      </div>
      <div className="live-dock-actions">
        <button type="button" className="control-button transport-button" onClick={onToggle}>
          {playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
          {playing ? 'Pause' : 'Resume'}
        </button>
        <button type="button" className="control-button primary-button" onClick={onReturn}>
          <Theater size={18} /> Return to live view
        </button>
        <button type="button" className="control-button ghost-button live-dock-stop" onClick={onStop}>
          <Square size={16} fill="currentColor" /> Stop audio
        </button>
      </div>
    </aside>
  );
}

export default LiveSetupDock;
