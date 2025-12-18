import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, RotateCcw, Play, Pause, Search, X } from 'lucide-react';
import './App.css';

// Searchable Select Component
function SearchableSelect({ value, onChange, options = [], placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calculate position once on open
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width
    });
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -5, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -5, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="select-dropdown"
          style={{
            position: 'absolute',
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
          }}
        >
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search tracks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearchTerm('')}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="select-options">
            {filteredOptions.length === 0 ? (
              <div className="no-results">No tracks found</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`select-option ${option.value === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className="searchable-select">
        <button
          ref={triggerRef}
          type="button"
          className="select-trigger"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <span className="select-value">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <Search size={16} className="select-icon" />
        </button>
      </div>
      {ReactDOM.createPortal(dropdownContent, document.body)}
    </>
  );
}

const DEFAULT_AUDIO_FILES = [
  { id: 'def-1', name: 'Aiscream 愛スクリム', path: './audio/Aiscream 愛スクリム.mp3' },
  { id: 'def-2', name: 'TWICE LIKEY', path: './audio/TWICE LIKEY.mp3' },
  { id: 'def-3', name: 'Watch Me', path: './audio/Watch Me.MP3' },
  { id: 'def-4', name: 'more jump more', path: './audio/more jump more.mp3' },
  { id: 'def-5', name: '碗碗Gravity=Reality', path: './audio/碗碗Gravity=Reality.mp3' },
];

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

  // Web Audio for BG Music
  const audioContextRef = useRef(null);
  const bgGainNodeRef = useRef(null);
  const bgSourceNodeRef = useRef(null);

  // Web Audio for Performance Tracks
  const perfGainNodeRefs = useRef([null, null, null, null]);
  const perfSourceNodeRefs = useRef([null, null, null, null]);

  // Initialize Web Audio on first interaction
  const initWebAudio = () => {
    if (audioContextRef.current) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();

      // BG Setup
      const bgGain = ctx.createGain();
      bgGain.connect(ctx.destination);
      bgGainNodeRef.current = bgGain;

      // Perf Setup
      perfGainNodeRefs.current = [0, 1, 2, 3].map(() => {
        const g = ctx.createGain();
        g.connect(ctx.destination);
        return g;
      });

      audioContextRef.current = ctx;

      if (bgAudioRef.current) {
        const source = ctx.createMediaElementSource(bgAudioRef.current);
        source.connect(bgGain);
        bgSourceNodeRef.current = source;
      }

      // Connect pending perf refs
      perfAudioRefs.current.forEach((audio, i) => {
        if (audio && !perfSourceNodeRefs.current[i]) {
          const source = ctx.createMediaElementSource(audio);
          source.connect(perfGainNodeRefs.current[i]);
          perfSourceNodeRefs.current[i] = source;
        }
      });

    } catch (e) {
      console.error('Web Audio init failed:', e);
    }
  };

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
        // Desktop Electron version
        const files = await window.electronAPI.getAudioFiles();
        setAudioFiles(files);
      } else {
        // PWA/iPad version - load from IndexedDB
        const savedFiles = await loadFilesFromIndexedDB();
        if (savedFiles && savedFiles.length > 0) {
          setAudioFiles(savedFiles);
          setCustomFolder('Saved audio files');
        } else {
          // Fallback to bundled files
          setAudioFiles(DEFAULT_AUDIO_FILES);
          setCustomFolder('Pre-loaded tracks');
        }
      }
    } catch (error) {
      console.error('Error loading audio files:', error);
      setAudioFiles(DEFAULT_AUDIO_FILES);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      if (window.electronAPI) {
        // Desktop Electron version
        const folderPath = await window.electronAPI.selectAudioFolder();
        if (folderPath) {
          setCustomFolder(folderPath);
          const files = await window.electronAPI.getAudioFilesFromPath(folderPath);
          setAudioFiles(files);
        }
      } else {
        // PWA/iPad version - use file input
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'audio/*,.mp3,.wav,.ogg,.m4a,.flac';

        input.onchange = async (e) => {
          const files = Array.from(e.target.files);
          const audioFiles = await processFilesForPWA(files);
          setAudioFiles(audioFiles);
          setCustomFolder(`${files.length} files selected`);

          // Save to IndexedDB for persistence
          await saveFilesToIndexedDB(audioFiles);
        };

        input.click();
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  // IndexedDB functions for PWA
  const openDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DreamlandAudioDB', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('audioFiles')) {
          db.createObjectStore('audioFiles', { keyPath: 'id' });
        }
      };
    });
  };

  const saveFilesToIndexedDB = async (files) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(['audioFiles'], 'readwrite');
      const store = transaction.objectStore('audioFiles');

      // Clear existing files
      store.clear();

      // Save new files
      for (const file of files) {
        await new Promise((resolve, reject) => {
          const request = store.add(file);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      console.log('Files saved to IndexedDB');
    } catch (error) {
      console.error('Error saving to IndexedDB:', error);
    }
  };

  const loadFilesFromIndexedDB = async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(['audioFiles'], 'readonly');
      const store = transaction.objectStore('audioFiles');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const files = request.result;
          // Recreate blob URLs from stored file data
          const filesWithUrls = files.map(file => {
            if (file.fileData) {
              return {
                ...file,
                path: URL.createObjectURL(file.fileData)
              };
            }
            return file;
          });
          resolve(filesWithUrls);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error loading from IndexedDB:', error);
      return [];
    }
  };

  const processFilesForPWA = async (files) => {
    const audioFiles = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
        // Create blob URL for the file
        const blobUrl = URL.createObjectURL(file);

        // Store file info and blob URL
        audioFiles.push({
          id: `file-${Date.now()}-${i}`,
          name: file.name,
          path: blobUrl,
          size: file.size,
          type: file.type,
          // Store the actual file object for persistence
          fileData: file
        });
      }
    }

    // Sort alphabetically
    return audioFiles.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Background music controls
  const toggleBackgroundMusic = () => {
    if (!bgTrack || !bgAudioRef.current) return;

    // Resume/Init AudioContext on interaction
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    } else if (!audioContextRef.current) {
      initWebAudio();
    }

    // Don't allow playing background music during a performance
    if (currentPerformance !== null && !bgPlaying) {
      return; // Do nothing - performance is active
    }

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
    if (bgGainNodeRef.current) {
      bgGainNodeRef.current.gain.value = newVolume;
    } else if (bgAudioRef.current) {
      bgAudioRef.current.volume = newVolume;
    }
  };

  // Performance volume control
  const handlePerfVolumeChange = (index, value) => {
    const newVolume = parseFloat(value);
    const newVolumes = [...perfVolumes];
    newVolumes[index] = newVolume;
    setPerfVolumes(newVolumes);

    if (perfGainNodeRefs.current[index]) {
      perfGainNodeRefs.current[index].gain.value = newVolume;
    } else if (perfAudioRefs.current[index]) {
      perfAudioRefs.current[index].volume = newVolume;
    }
  };

  // Fade background music out (1.5 seconds)
  const fadeOutBackground = (callback) => {
    if (!bgAudioRef.current || !bgPlaying) {
      if (callback) callback();
      return;
    }

    setIsFading(true);
    const audio = bgAudioRef.current;

    if (bgGainNodeRef.current && audioContextRef.current) {
      const g = bgGainNodeRef.current.gain;
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      // Smooth exponential fade to near-zero
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.exponentialRampToValueAtTime(0.001, now + 2.5);

      setTimeout(() => {
        audio.pause();
        g.setValueAtTime(0, ctx.currentTime);
        setBgPlaying(false);
        setIsFading(false);
        if (callback) callback();
      }, 2600);
    } else {
      // Fallback
      audio.pause();
      setBgPlaying(false);
      setIsFading(false);
      if (callback) callback();
    }
  };

  // Fade background music in (1.5 seconds)
  const fadeInBackground = () => {
    if (!bgAudioRef.current || !bgTrack) return;

    setIsFading(true);
    const audio = bgAudioRef.current;
    const target = bgVolume;

    if (bgGainNodeRef.current && audioContextRef.current) {
      const g = bgGainNodeRef.current.gain;
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      audio.play();
      setBgPlaying(true);

      g.cancelScheduledValues(now);
      g.setValueAtTime(0.001, now);
      g.exponentialRampToValueAtTime(target || 0.5, now + 2.5);

      setTimeout(() => {
        setIsFading(false);
      }, 2600);
    } else {
      audio.volume = target;
      audio.play();
      setBgPlaying(true);
      setIsFading(false);
    }
  };

  // Start performance
  const startPerformance = (index) => {
    if (!perfTracks[index] || currentPerformance !== null) return;

    if (!bgPlaying) {
      alert("Please start the background music first!");
      return;
    }

    // Fade out background music, then start performance
    fadeOutBackground(() => {
      setCurrentPerformance(index);
      const audio = perfAudioRefs.current[index];

      // Ensure Web Audio Connection for this track
      if (audioContextRef.current && audio && !perfSourceNodeRefs.current[index]) {
        try {
          const ctx = audioContextRef.current;
          const source = ctx.createMediaElementSource(audio);
          source.connect(perfGainNodeRefs.current[index]);
          perfSourceNodeRefs.current[index] = source;
        } catch (e) {
          console.log("Already connected or error", e);
        }
      }

      // Set initial volume on gain node
      if (perfGainNodeRefs.current[index]) {
        perfGainNodeRefs.current[index].gain.value = perfVolumes[index];
      }

      if (audio) {
        audio.currentTime = 0;
        audio.volume = perfVolumes[index]; // Fallback
        audio.play();

        const newPlaying = [...perfPlaying];
        newPlaying[index] = true;
        setPerfPlaying(newPlaying);
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

    // Mark performance as completed
    const newStatus = [...performanceStatus];
    newStatus[index] = true;
    setPerformanceStatus(newStatus);

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

    // Reset all state to initial values
    setBgTrack('');
    setPerfTracks(['', '', '', '']);
    setPerfPlaying([false, false, false, false]);
    setPerfProgress([0, 0, 0, 0]);
    setPerfDurations([0, 0, 0, 0]);
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
          <div className="title-container">
            <p className="app-subtitle">Live Performance Controller ・ ライブコントローラー</p>
          </div>
          <div className="logo-container">
            <img
              src="/icons/Dreamlive.png"
              alt="DreamLIVE! Performance Controller"
              className="logo-image"
            />
          </div>
        </div>
        <div className="header-controls">
          <button className="folder-btn" onClick={handleSelectFolder} title="Select Audio Folder">
            <FolderOpen size={20} />
            <span>Select Folder</span>
          </button>
          <button className="reset-all-btn" onClick={resetAll} title="Reset All">
            <RotateCcw size={20} />
            <span>Reset All</span>
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
          {/* Main Controls Row - BGM + Performance Counter */}
          <div className="main-controls-row">
            {/* Background Music Section */}
            <section className={`background-section split-layout ${bgPlaying ? 'is-playing' : ''}`}>
              {/* Sparkle overlay and particles when playing */}
              {bgPlaying && (
                <>
                  <div className="sparkle-overlay"></div>
                  <div className="audio-particles">
                    <div className="particle">🌸</div>
                    <div className="particle">🌸</div>
                    <div className="particle">🌸</div>
                    <div className="particle">🌸</div>
                    <div className="particle">🌸</div>
                    <div className="particle">🌸</div>
                    <div className="particle">🌸</div>
                    <div className="particle">🌸</div>
                  </div>
                </>
              )}
              <div className="section-header">
                <h2 className="section-title">Background Music ・ BGM</h2>
                {currentPerformance !== null ? (
                  <span className="bg-status-badge queued">⏸ Queued</span>
                ) : bgPlaying ? (
                  <span className="bg-status-badge playing">▶ Playing</span>
                ) : bgTrack ? (
                  <span className="bg-status-badge ready">● Ready</span>
                ) : (
                  <span className="bg-status-badge idle">Select Track</span>
                )}
              </div>
              <div className="bg-music-container">
                <div className="bg-select">
                  <SearchableSelect
                    value={bgTrack}
                    onChange={(value) => {
                      setBgTrack(value);
                      setBgPlaying(false);
                    }}
                    options={audioFiles.map(file => ({
                      value: file.path,
                      label: file.name
                    }))}
                    placeholder="Select background music..."
                    disabled={false}
                  />
                </div>

                <div className="bg-controls">
                  <button
                    className={`play-btn ${bgPlaying ? 'is-playing' : ''}`}
                    onClick={toggleBackgroundMusic}
                    disabled={!bgTrack || currentPerformance !== null}
                  >
                    {bgPlaying ? <Pause size={24} /> : <Play size={24} />}
                  </button>

                  <div className="volume-control">
                    <span className="volume-icon">🎵</span>
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

            {/* Performance Counter Card */}
            <div className="performance-counter-card">
              <div className="counter-label">Completed</div>
              <div className="counter-value">{completedCount}/4</div>
              <div className="counter-sublabel">Performances</div>
              <div className="counter-track-info">
                <span className="file-count">{audioFiles.length}</span>
              </div>
            </div>
          </div>

          {/* Performance Tracks Section */}
          <section className="performances-section">
            <div className="section-header">
              <h2 className="section-title">Live Performances ・ パフォーマンス</h2>
            </div>
            <div className="performances-grid">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`performance-card ${currentPerformance === index ? 'active' : ''
                    } ${performanceStatus[index] ? 'completed' : ''}`}
                >
                  {/* Particles and sparkle when this performance is playing */}
                  {currentPerformance === index && perfPlaying[index] && (
                    <>
                      <div className="sparkle-overlay"></div>
                      <div className="audio-particles">
                        <div className="particle">🌸</div>
                        <div className="particle">🌸</div>
                        <div className="particle">🌸</div>
                        <div className="particle">🌸</div>
                        <div className="particle">🌸</div>
                        <div className="particle">🌸</div>
                        <div className="particle">🌸</div>
                        <div className="particle">🌸</div>
                      </div>
                    </>
                  )}
                  <div className="perf-header">
                    <div className="perf-number">#{index + 1}</div>
                    <h3 className="perf-title">Performance {index + 1}</h3>
                    {performanceStatus[index] ? (
                      <span className="perf-status-badge completed">✓ Completed</span>
                    ) : currentPerformance === index && perfPlaying[index] ? (
                      <span className="perf-status-badge playing">▶ Playing</span>
                    ) : currentPerformance === index && !perfPlaying[index] ? (
                      <span className="perf-status-badge paused">⏸ Paused</span>
                    ) : perfTracks[index] ? (
                      <span className="perf-status-badge ready">● Ready</span>
                    ) : (
                      <span className="perf-status-badge idle">Select Track</span>
                    )}
                  </div>

                  <div className="perf-select">
                    <SearchableSelect
                      value={perfTracks[index]}
                      onChange={(value) => {
                        const newTracks = [...perfTracks];
                        newTracks[index] = value;
                        setPerfTracks(newTracks);
                      }}
                      options={audioFiles.map(file => ({
                        value: file.path,
                        label: file.name
                      }))}
                      placeholder="Select track..."
                      disabled={false}
                    />
                  </div>

                  {perfTracks[index] && (
                    <>
                      {/* Volume Control */}
                      <div className="perf-volume">
                        <span className="volume-icon">🎵</span>
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
                            className={`pause-btn ${perfPlaying[index] ? 'is-playing' : ''}`}
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
                            disabled={!perfTracks[index] || currentPerformance !== null || performanceStatus[index] || !bgPlaying} // Guardrail: Must be playing BGM
                            title={!bgPlaying ? "Start background music first" : "Start Performance"}
                          >
                            <Play size={18} />
                            <span>Start</span>
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

          {/* Instructions Component */}
          <section className="instructions-section">
            <div className="instructions-card">
              <div className="instructions-header">
                <span className="instructions-icon">💫</span>
                <h3 className="instructions-title">How to Use DreamLIVE!</h3>
                <span className="instructions-icon">💫</span>
              </div>
              <div className="instructions-content">
                <div className="instruction-step">
                  <span className="step-number">1</span>
                  <p><strong>Select Folder</strong> to load your audio files</p>
                </div>
                <div className="instruction-step">
                  <span className="step-number">2</span>
                  <p><strong>Choose BGM</strong> for background ambiance between performances</p>
                </div>
                <div className="instruction-step">
                  <span className="step-number">3</span>
                  <p><strong>Select tracks</strong> for each performance slot and adjust volumes</p>
                </div>
                <div className="instruction-step">
                  <span className="step-number">4</span>
                  <p><strong>Start Performance</strong> - BGM auto-fades, then returns after completion</p>
                </div>
                <div className="instruction-step">
                  <span className="step-number">5</span>
                  <p><strong>Reset All</strong> when you're ready to start fresh</p>
                </div>
              </div>
              <div className="instructions-footer">
                <span className="footer-sparkle">✨</span>
                <p className="instructions-tip">Tip: Performances play sequentially - start the next one when ready!</p>
                <span className="footer-sparkle">✨</span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default App;
