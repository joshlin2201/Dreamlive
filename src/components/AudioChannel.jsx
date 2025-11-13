import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react';

const AudioChannel = ({ channelId, title, audioFiles, onAudioRef }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedFile, setSelectedFile] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && onAudioRef) {
      onAudioRef(audioRef.current);
    }
  }, [onAudioRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!selectedFile) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleReset = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const handleFileSelect = (e) => {
    const filePath = e.target.value;
    setSelectedFile(filePath);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-channel">
      <div className="channel-header">
        <h3 className="channel-title">{title}</h3>
      </div>

      <div className="channel-body">
        <div className="file-selector">
          <label className="file-label">Select Audio:</label>
          <select
            className="file-dropdown"
            value={selectedFile}
            onChange={handleFileSelect}
          >
            <option value="">-- Choose a file --</option>
            {audioFiles.map((file, index) => (
              <option key={index} value={file.path}>
                {file.name}
              </option>
            ))}
          </select>
        </div>

        <audio ref={audioRef} src={selectedFile} preload="metadata" />

        <div className="controls-section">
          <div className="playback-controls">
            <button
              className="control-btn play-btn"
              onClick={togglePlay}
              disabled={!selectedFile}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              className="control-btn reset-btn"
              onClick={handleReset}
              disabled={!selectedFile}
            >
              <RotateCcw size={20} />
            </button>
          </div>

          <div className="timeline-section">
            <span className="time-display">{formatTime(currentTime)}</span>
            <input
              type="range"
              className="timeline-slider"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              disabled={!selectedFile}
            />
            <span className="time-display">{formatTime(duration)}</span>
          </div>

          <div className="volume-section">
            <button className="control-btn mute-btn" onClick={toggleMute}>
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              className="volume-slider"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
            />
            <span className="volume-display">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {selectedFile && (
          <div className="file-info">
            <span className="file-name">
              {audioFiles.find(f => f.path === selectedFile)?.name || ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioChannel;
