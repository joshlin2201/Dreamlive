import React, { useState, useEffect, useRef } from 'react';
import { FolderOpen, RefreshCw, RotateCcw, Play, Pause } from 'lucide-react';
import './App.css';

function App() {
  const [audioFiles, setAudioFiles] = useState([]);
  const [customFolder, setCustomFolder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Background music state
  const [bgTrack, setBgTrack] = useState('');
  const [bgPlaying, setBgPlaying] = useState(false);
  const [bgVolume, setBgVolume] = useState(0.5);
  const bgAudioRef = useRef(null);

  // Performance tracks state
  const [perfTracks, setPerfTracks] = useState(['', '', '', '']);
  const [perfPlaying, setPerfPlaying] = useState([false, false, false, false]);
  const [perfVolumes, setPerfVolumes] = useState([0.8, 0.8, 0.8, 0.8]);
  const [perfProgress, setPerfProgress] = useState([0, 0, 0, 0]);
  const [perfDurations, setPerfDurations] = useState([0, 0, 0, 0]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [performanceStatus, setPerformanceStatus] = useState([false, false, false, false]);
  const perfAudioRefs = useRef([null, null, null, null]);

  // Fade state
  const [isFading, setIsFading] = useState(false);
  const fadeIntervalRef = useRef(null);
  const progressIntervalRef = useRef(null);

  useEffect(() => {
    loadAudioFiles();
  }, []);

  // Update progress bars
  useEffect(() => {
    progressIntervalRef.current = setInterval(() => {
      perfAudioRefs.current.forEach((audio, index) => {
        if (audio && perfPlaying[index]) {
          const newProgress = [...perfProgress];
          newProgress[index] = audio.currentTime;
          setPerfProgress(newProgress);
        }
      });
    }, 100);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [perfPlaying]);

  const loadAudioFiles = async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI) {
        const files = await window.electronAPI.getAudioFiles();
        setAudioFiles(files);
      }
    } catch (error) {
      console.error('Error loading audio files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      if (window.electronAPI) {
        const folderPath = await window.electronAPI.selectAudioFolder();
        if (folderPath) {
          setCustomFolder(folderPath);
          const files = await window.electronAPI.getAudioFilesFromPath(folderPath);
          setAudioFiles(files);
        }
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleRefresh = () => {
    if (customFolder) {
      window.electronAPI.getAudioFilesFromPath(customFolder).then(files => {
        setAudioFiles(files);
      });
    } else {
      loadAudioFiles();
    }
  };

  // Background music controls
  const toggleBackgroundMusic = () => {
    if (!bgTrack || !bgAudioRef.current) return;

    if (bgPlaying) {
      bgAudioRef.current.pause();
      setBgPlaying(false);
    } else {
      bgAudioRef.current.play();
      setBgPlaying(true);
    }
  };

  const handleBgVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setBgVolume(newVolume);
    if (bgAudioRef.current) {
      bgAudioRef.current.volume = newVolume;
    }
  };

  // Performance volume control
  const handlePerfVolumeChange = (index, value) => {
    const newVolume = parseFloat(value);
    const newVolumes = [...perfVolumes];
    newVolumes[index] = newVolume;
    setPerfVolumes(newVolumes);

    if (perfAudioRefs.current[index]) {
      perfAudioRefs.current[index].volume = newVolume;
    }
  };

  // Fade background music out (3 seconds)
  const fadeOutBackground = (callback) => {
    if (!bgAudioRef.current || !bgPlaying) {
      if (callback) callback();
      return;
    }

    setIsFading(true);
    const startVolume = bgVolume;
    const fadeSteps = 30; // 30 steps over 3 seconds = 100ms per step
    const volumeDecrement = startVolume / fadeSteps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = Math.max(0, startVolume - (volumeDecrement * currentStep));

      if (bgAudioRef.current) {
        bgAudioRef.current.volume = newVolume;
      }

      if (currentStep >= fadeSteps) {
        clearInterval(fadeIntervalRef.current);
        setIsFading(false);
        if (callback) callback();
      }
    }, 100);
  };

  // Fade background music in (3 seconds)
  const fadeInBackground = () => {
    if (!bgAudioRef.current || !bgPlaying) return;

    setIsFading(true);
    const targetVolume = bgVolume;
    const fadeSteps = 30;
    const volumeIncrement = targetVolume / fadeSteps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = Math.min(targetVolume, volumeIncrement * currentStep);

      if (bgAudioRef.current) {
        bgAudioRef.current.volume = newVolume;
      }

      if (currentStep >= fadeSteps) {
        clearInterval(fadeIntervalRef.current);
        setIsFading(false);
      }
    }, 100);
  };

  // Start performance
  const startPerformance = (index) => {
    if (!perfTracks[index] || currentPerformance !== null) return;

    // Fade out background music, then start performance
    fadeOutBackground(() => {
      setCurrentPerformance(index);
      const audio = perfAudioRefs.current[index];
      if (audio) {
        audio.currentTime = 0;
        audio.volume = perfVolumes[index];
        audio.play();

        const newPlaying = [...perfPlaying];
        newPlaying[index] = true;
        setPerfPlaying(newPlaying);

        // Mark as completed
        const newStatus = [...performanceStatus];
        newStatus[index] = true;
        setPerformanceStatus(newStatus);
      }
    });
  };

  // Toggle pause for individual performance
  const togglePerfPause = (index) => {
    const audio = perfAudioRefs.current[index];
    if (!audio) return;

    const newPlaying = [...perfPlaying];
    if (perfPlaying[index]) {
      audio.pause();
      newPlaying[index] = false;
    } else {
      audio.play();
      newPlaying[index] = true;
    }
    setPerfPlaying(newPlaying);
  };

  // Handle performance end
  const handlePerformanceEnd = (index) => {
    const newPlaying = [...perfPlaying];
    newPlaying[index] = false;
    setPerfPlaying(newPlaying);
    setCurrentPerformance(null);
    // Fade in background music
    fadeInBackground();
  };

  // Handle loaded metadata to get duration
  const handleLoadedMetadata = (index) => {
    const audio = perfAudioRefs.current[index];
    if (audio) {
      const newDurations = [...perfDurations];
      newDurations[index] = audio.duration;
      setPerfDurations(newDurations);
    }
  };

  // Seek to position in performance
  const handleSeek = (index, value) => {
    const audio = perfAudioRefs.current[index];
    if (audio) {
      audio.currentTime = parseFloat(value);
      const newProgress = [...perfProgress];
      newProgress[index] = parseFloat(value);
      setPerfProgress(newProgress);
    }
  };

  // Reset all
  const resetAll = () => {
    // Pause background
    if (bgAudioRef.current) {
      bgAudioRef.current.pause();
      bgAudioRef.current.currentTime = 0;
      setBgPlaying(false);
    }

    // Pause all performances
    perfAudioRefs.current.forEach((audio, index) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    setPerfPlaying([false, false, false, false]);
    setPerfProgress([0, 0, 0, 0]);
    setPerformanceStatus([false, false, false, false]);
    setCurrentPerformance(null);

    // Clear any fade intervals
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      setIsFading(false);
    }

    // Reset background volume
    if (bgAudioRef.current) {
      bgAudioRef.current.volume = bgVolume;
    }
  };

  // Format time in mm:ss
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const completedCount = performanceStatus.filter(status => status).length;

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-container">
            <div className="logo-circle">
              <span className="logo-text">DL</span>
            </div>
          </div>
          <div className="title-container">
            <h1 className="app-title">Dreamland Maid Cafe</h1>
            <p className="app-subtitle">Live Performance Controller</p>
          </div>
        </div>
        <div className="header-controls">
          <button className="folder-btn" onClick={handleSelectFolder} title="Select Audio Folder">
            <FolderOpen size={20} />
            <span>Select Folder</span>
          </button>
          <button className="refresh-btn" onClick={handleRefresh} title="Refresh Audio Files">
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      {customFolder && (
        <div className="folder-info">
          <span>📁 {customFolder}</span>
        </div>
      )}

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading audio files...</p>
        </div>
      ) : (
        <>
          {/* Background Music Section */}
          <section className="background-section">
            <div className="section-header">
              <h2 className="section-title">🎵 Background Music</h2>
              <span className="section-subtitle">Plays during MC talk time • Loops automatically</span>
            </div>
            <div className="bg-music-container">
              <div className="bg-select">
                <select
                  value={bgTrack}
                  onChange={(e) => {
                    setBgTrack(e.target.value);
                    setBgPlaying(false);
                  }}
                  className="track-select"
                >
                  <option value="">Select background music...</option>
                  {audioFiles.map((file, index) => (
                    <option key={index} value={file.path}>
                      {file.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-controls">
                <button
                  className={`play-btn ${bgPlaying ? 'playing' : ''}`}
                  onClick={toggleBackgroundMusic}
                  disabled={!bgTrack}
                >
                  {bgPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>

                <div className="volume-control">
                  <span className="volume-icon">🔊</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={bgVolume}
                    onChange={handleBgVolumeChange}
                    className="volume-slider"
                  />
                  <span className="volume-label">{Math.round(bgVolume * 100)}%</span>
                </div>
              </div>

              <audio
                ref={bgAudioRef}
                src={bgTrack}
                loop
                onEnded={() => setBgPlaying(false)}
              />
            </div>
          </section>

          {/* Performance Progress */}
          <div className="performance-progress">
            <div className="progress-badge">
              <span className="progress-number">{completedCount}</span>
              <span className="progress-divider">/</span>
              <span className="progress-total">4</span>
            </div>
            <span className="progress-label">Performances Completed</span>
          </div>

          {/* Performance Tracks Section */}
          <section className="performances-section">
            <div className="section-header">
              <h2 className="section-title">🎤 Live Performances</h2>
            </div>
            <div className="performances-grid">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`performance-card ${
                    currentPerformance === index ? 'active' : ''
                  } ${performanceStatus[index] ? 'completed' : ''}`}
                >
                  <div className="perf-header">
                    <div className="perf-number">#{index + 1}</div>
                    <h3 className="perf-title">Performance {index + 1}</h3>
                    {performanceStatus[index] && (
                      <span className="completed-badge">✓</span>
                    )}
                  </div>

                  <div className="perf-select">
                    <select
                      value={perfTracks[index]}
                      onChange={(e) => {
                        const newTracks = [...perfTracks];
                        newTracks[index] = e.target.value;
                        setPerfTracks(newTracks);
                      }}
                      className="track-select"
                      disabled={currentPerformance !== null}
                    >
                      <option value="">Select track...</option>
                      {audioFiles.map((file, i) => (
                        <option key={i} value={file.path}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {perfTracks[index] && (
                    <>
                      {/* Volume Control */}
                      <div className="perf-volume">
                        <span className="volume-icon">🔊</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={perfVolumes[index]}
                          onChange={(e) => handlePerfVolumeChange(index, e.target.value)}
                          className="volume-slider"
                        />
                        <span className="volume-label">{Math.round(perfVolumes[index] * 100)}%</span>
                      </div>

                      {/* Progress Bar */}
                      {perfDurations[index] > 0 && (
                        <div className="progress-bar-container">
                          <span className="time-label">{formatTime(perfProgress[index])}</span>
                          <input
                            type="range"
                            min="0"
                            max={perfDurations[index]}
                            step="0.1"
                            value={perfProgress[index]}
                            onChange={(e) => handleSeek(index, e.target.value)}
                            className="progress-bar"
                          />
                          <span className="time-label">{formatTime(perfDurations[index])}</span>
                        </div>
                      )}

                      {/* Play Controls */}
                      <div className="perf-controls">
                        {currentPerformance === index ? (
                          <button
                            className="pause-btn"
                            onClick={() => togglePerfPause(index)}
                          >
                            {perfPlaying[index] ? (
                              <>
                                <Pause size={20} />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play size={20} />
                                <span>Resume</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            className="start-performance-btn"
                            onClick={() => startPerformance(index)}
                            disabled={!perfTracks[index] || currentPerformance !== null}
                          >
                            <Play size={24} />
                            <span>Start Performance</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  <audio
                    ref={el => perfAudioRefs.current[index] = el}
                    src={perfTracks[index]}
                    onEnded={() => handlePerformanceEnd(index)}
                    onLoadedMetadata={() => handleLoadedMetadata(index)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Bottom Controls */}
          <footer className="app-footer">
            <button className="reset-all-btn" onClick={resetAll}>
              <RotateCcw size={24} />
              <span>Reset All</span>
            </button>
            <div className="footer-info">
              <span className="file-count">{audioFiles.length} audio files</span>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
