import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  FolderOpen,
  Headphones,
  ListMusic,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  Search,
  SkipForward,
  SlidersHorizontal,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  SHOW_PHASE,
  finishPerformanceFlow,
  getShowDeckState,
  getShowReadiness,
  nextPlaylistIndex,
  startPerformanceFlow,
} from './audio/showFlow';
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

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
        triggerRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
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
              aria-label="Search audio tracks"
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearchTerm('')}
                aria-label="Clear track search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="select-options" role="listbox" aria-label="Audio tracks">
            {filteredOptions.length === 0 ? (
              <div className="no-results">No tracks found</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`select-option ${option.value === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                  role="option"
                  aria-selected={option.value === value}
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
          aria-haspopup="listbox"
          aria-expanded={isOpen}
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

function SakuraDrift() {
  return (
    <div className="sakura-drift" aria-hidden="true">
      {[0, 1, 2, 3, 4].map(index => <i className="sakura-petal" key={index} />)}
    </div>
  );
}

// No audio ships with the app — staff import their own licensed tracks
// via the Import Audio button (persisted in IndexedDB).
const DEFAULT_AUDIO_FILES = [];
const DEFAULT_MASTER_VOLUME = 0.82;
const MASTER_LEVEL_KEY = 'dreamlive-master-level-v1';

function App() {
  const [audioFiles, setAudioFiles] = useState([]);
  const [customFolder, setCustomFolder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Background music state
  const [bgPlaylist, setBgPlaylist] = useState([]);
  const [bgIndex, setBgIndex] = useState(0);
  const [repeatPlaylist, setRepeatPlaylist] = useState(true);
  const [bgPlaying, setBgPlaying] = useState(false);
  const [bgVolume, setBgVolume] = useState(0.5);
  const bgAudioRef = useRef(null);
  const bgTrack = bgPlaylist[bgIndex] || '';

  // Performance tracks state
  const [perfTracks, setPerfTracks] = useState(['', '', '', '']);
  const [perfPlaying, setPerfPlaying] = useState([false, false, false, false]);
  const [perfVolumes, setPerfVolumes] = useState([0.8, 0.8, 0.8, 0.8]);
  const [perfProgress, setPerfProgress] = useState([0, 0, 0, 0]);
  const [perfDurations, setPerfDurations] = useState([0, 0, 0, 0]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [performanceStatus, setPerformanceStatus] = useState([false, false, false, false]);
  const perfAudioRefs = useRef([null, null, null, null]);
  const [showPhase, setShowPhase] = useState(SHOW_PHASE.SETUP);
  const [showError, setShowError] = useState('');

  // The device volume is a physical room baseline. This master is the one
  // global show level DreamLIVE can control and restore for every operator.
  const [masterVolume, setMasterVolume] = useState(DEFAULT_MASTER_VOLUME);
  const [savedMasterVolume, setSavedMasterVolume] = useState(DEFAULT_MASTER_VOLUME);
  const [soundCheckComplete, setSoundCheckComplete] = useState(false);
  const [soundCheckOpen, setSoundCheckOpen] = useState(false);
  const [isCheckingSound, setIsCheckingSound] = useState(false);
  const [setupExpanded, setSetupExpanded] = useState(true);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const soundCheckDialogRef = useRef(null);
  const soundCheckCloseRef = useRef(null);
  const soundCheckReturnFocusRef = useRef(null);
  const resetDialogRef = useRef(null);
  const resetCancelRef = useRef(null);
  const resetReturnFocusRef = useRef(null);
  const hasReachedReadyRef = useRef(false);

  // Fade state
  const [isFading, setIsFading] = useState(false);
  const progressIntervalRef = useRef(null);

  // Web Audio for BG Music
  const audioContextRef = useRef(null);
  const bgGainNodeRef = useRef(null);
  const bgSourceNodeRef = useRef(null);
  const masterGainNodeRef = useRef(null);
  const masterCompressorRef = useRef(null);

  // Web Audio for Performance Tracks
  const perfGainNodeRefs = useRef([null, null, null, null]);
  const perfSourceNodeRefs = useRef([null, null, null, null]);

  // Fade + notice bookkeeping
  const fadeTimeoutRef = useRef(null);
  const fadeResolverRef = useRef(null);
  const transitionLockRef = useRef(false);
  const settingsHydratedRef = useRef(false);
  const playbackStateRef = useRef({ bgPlaying: false, currentPerformance: null, perfPlaying: [] });
  const [notice, setNotice] = useState(null);
  const noticeTimeoutRef = useRef(null);

  const showNotice = (message, tone = 'info') => {
    setNotice({ message, tone });
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => setNotice(null), 3500);
  };

  const openSoundCheck = () => {
    soundCheckReturnFocusRef.current = document.activeElement;
    setSoundCheckOpen(true);
  };

  const closeSoundCheck = () => {
    setSoundCheckOpen(false);
    window.requestAnimationFrame(() => soundCheckReturnFocusRef.current?.focus());
  };

  const openResetConfirmation = () => {
    resetReturnFocusRef.current = document.activeElement;
    setResetConfirmOpen(true);
  };

  const closeResetConfirmation = () => {
    setResetConfirmOpen(false);
    window.requestAnimationFrame(() => resetReturnFocusRef.current?.focus());
  };

  // Bring the AudioContext back to life no matter what state iOS left it in.
  // After an audio interruption, WebKit can park the context in a non-standard
  // "interrupted" state — a plain `state === 'suspended'`
  // check misses it and tracks then "play" silently into a dead context.
  const ensureAudioReady = async () => {
    if (!audioContextRef.current) {
      initWebAudio();
    }
    const ctx = audioContextRef.current;
    if (!ctx) return false;

    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn('AudioContext resume failed:', e);
      }
      // iOS occasionally needs a second nudge right after an interruption
      if (ctx.state !== 'running') {
        await new Promise(r => setTimeout(r, 120));
        try { await ctx.resume(); } catch (e) { /* noop */ }
      }
    }
    return ctx.state === 'running';
  };

  // play() that never fails silently
  const playSafely = async (audio, label) => {
    if (!audio) return false;
    try {
      await audio.play();
      return true;
    } catch (e) {
      console.warn(`Playback failed (${label}):`, e);
      showNotice(`Couldn't start ${label}. Tap play again.`, 'error');
      return false;
    }
  };

  // --- Glitch-free starts -------------------------------------------------
  // WebKit pipes each <audio> element into the AudioContext through a
  // MediaElementAudioSourceNode whose resampler takes ~200-300ms to lock on
  // whenever the file's sample rate differs from the iPad hardware rate. Every
  // play path silences its gain node first and fades up after playback begins,
  // keeping that warm-up inaudible.
  const START_FADE = 0.4;
  const RESUME_FADE = 0.2;

  const muteGain = (gainNode) => {
    if (!gainNode) return;
    const ctx = audioContextRef.current;
    if (ctx) {
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    } else {
      gainNode.gain.value = 0.0001;
    }
  };

  const fadeGainTo = (gainNode, target, seconds = START_FADE) => {
    if (!gainNode) return;
    const ctx = audioContextRef.current;
    if (ctx && seconds > 0) {
      const now = ctx.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), now);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(target, 0.0002), now + seconds);
    } else if (ctx) {
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      gainNode.gain.setValueAtTime(target, ctx.currentTime);
    } else {
      gainNode.gain.value = target;
    }
  };

  // Initialize Web Audio on first interaction
  const initWebAudio = () => {
    if (audioContextRef.current) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -3;
      compressor.knee.value = 0;
      compressor.ratio.value = 20;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;

      const masterGain = ctx.createGain();
      masterGain.gain.value = masterVolume;
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);
      masterCompressorRef.current = compressor;
      masterGainNodeRef.current = masterGain;

      // BG Setup
      const bgGain = ctx.createGain();
      bgGain.connect(compressor);
      bgGainNodeRef.current = bgGain;

      // Perf Setup
      perfGainNodeRefs.current = [0, 1, 2, 3].map(() => {
        const g = ctx.createGain();
        g.connect(compressor);
        return g;
      });

      audioContextRef.current = ctx;

      if (bgAudioRef.current) {
        try {
          const source = ctx.createMediaElementSource(bgAudioRef.current);
          source.connect(bgGain);
          bgSourceNodeRef.current = source;
        } catch (error) {
          console.warn('Background audio connection will retry on play:', error);
        }
      }

      // Connect pending perf refs
      perfAudioRefs.current.forEach((audio, i) => {
        if (audio && !perfSourceNodeRefs.current[i]) {
          try {
            const source = ctx.createMediaElementSource(audio);
            source.connect(perfGainNodeRefs.current[i]);
            perfSourceNodeRefs.current[i] = source;
          } catch (error) {
            console.warn(`Performance ${i + 1} audio connection will retry on play:`, error);
          }
        }
      });

    } catch (e) {
      console.error('Web Audio init failed:', e);
    }
  };

  useEffect(() => {
    loadAudioFiles();
  }, []);

  useEffect(() => {
    const savedLevel = Number.parseFloat(window.localStorage.getItem(MASTER_LEVEL_KEY));
    if (!Number.isFinite(savedLevel)) return;
    const safeLevel = Math.min(Math.max(savedLevel, 0), 1);
    setMasterVolume(safeLevel);
    setSavedMasterVolume(safeLevel);
  }, []);

  useEffect(() => {
    if (!isLoading && !soundCheckComplete) setSoundCheckOpen(true);
  }, [isLoading, soundCheckComplete]);

  useEffect(() => {
    if (!soundCheckOpen) return undefined;

    const dialog = soundCheckDialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || []);
    const focusTimer = window.requestAnimationFrame(() => soundCheckCloseRef.current?.focus());
    const handleDialogKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSoundCheck();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', handleDialogKeyDown);
    };
  }, [soundCheckOpen]);

  useEffect(() => {
    if (!resetConfirmOpen) return undefined;

    const focusTimer = window.requestAnimationFrame(() => resetCancelRef.current?.focus());
    const handleResetDialogKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeResetConfirmation();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(resetDialogRef.current?.querySelectorAll('button:not([disabled])') || []);
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleResetDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', handleResetDialogKeyDown);
    };
  }, [resetConfirmOpen]);

  useEffect(() => {
    const masterGain = masterGainNodeRef.current;
    const context = audioContextRef.current;
    if (!masterGain) return;
    if (context) {
      masterGain.gain.cancelScheduledValues(context.currentTime);
      masterGain.gain.setTargetAtTime(masterVolume, context.currentTime, 0.015);
    } else {
      masterGain.gain.value = masterVolume;
    }
  }, [masterVolume]);

  useEffect(() => {
    playbackStateRef.current = { bgPlaying, currentPerformance, perfPlaying };
  }, [bgPlaying, currentPerformance, perfPlaying]);

  useEffect(() => {
    if (!settingsHydratedRef.current || audioFiles.length === 0) return;
    const keyForPath = path => {
      const file = audioFiles.find(item => item.path === path);
      return file ? (file.id || file.path) : null;
    };
    const setup = {
      playlistIds: bgPlaylist.map(keyForPath).filter(Boolean),
      bgIndex,
      repeatPlaylist,
      performanceIds: perfTracks.map(keyForPath),
      bgVolume,
      perfVolumes,
    };
    window.localStorage.setItem('dreamlive-show-setup-v1', JSON.stringify(setup));
  }, [audioFiles, bgPlaylist, bgIndex, repeatPlaylist, perfTracks, bgVolume, perfVolumes]);

  useEffect(() => {
    const recover = async () => {
      if (document.visibilityState !== 'visible') return;
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== 'running') {
        try { await ctx.resume(); } catch (error) { /* handled by the next user action */ }
      }

      const playback = playbackStateRef.current;
      if (playback.currentPerformance !== null) {
        const index = playback.currentPerformance;
        const audio = perfAudioRefs.current[index];
        if (playback.perfPlaying[index] && audio?.paused) {
          setPerfPlaying(previous => previous.map((playing, trackIndex) => (
            trackIndex === index ? false : playing
          )));
          setShowPhase(SHOW_PHASE.PAUSED);
          showNotice(`Performance ${index + 1} paused after an audio interruption.`);
        }
      } else if (playback.bgPlaying && bgAudioRef.current?.paused) {
        try {
          await bgAudioRef.current.play();
        } catch (error) {
          setBgPlaying(false);
          setShowError('BGM paused after an audio interruption. Tap Play to resume.');
          setShowPhase(SHOW_PHASE.ERROR);
        }
      }
    };
    document.addEventListener('visibilitychange', recover);
    window.addEventListener('focus', recover);
    return () => {
      document.removeEventListener('visibilitychange', recover);
      window.removeEventListener('focus', recover);
    };
  }, []);

  // Update progress bars (only ticks while something is actually playing)
  useEffect(() => {
    const anyPlaying = perfPlaying.some(Boolean);
    if (!anyPlaying) return undefined;

    progressIntervalRef.current = setInterval(() => {
      setPerfProgress(prev => {
        let changed = false;
        const next = prev.map((value, index) => {
          const audio = perfAudioRefs.current[index];
          if (audio && perfPlaying[index] && Math.abs(audio.currentTime - value) > 0.05) {
            changed = true;
            return audio.currentTime;
          }
          return value;
        });
        return changed ? next : prev;
      });
    }, 200);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [perfPlaying]);

  const loadAudioFiles = async () => {
    setIsLoading(true);
    const restoreShowSetup = (files) => {
      try {
        const raw = window.localStorage.getItem('dreamlive-show-setup-v1');
        if (!raw) return;
        const saved = JSON.parse(raw);
        const pathForKey = key => files.find(file => (file.id || file.path) === key)?.path || '';
        const restoredPlaylist = (saved.playlistIds || []).map(pathForKey).filter(Boolean);
        const restoredPerformances = [0, 1, 2, 3].map(index => pathForKey(saved.performanceIds?.[index]));
        setBgPlaylist(restoredPlaylist);
        setBgIndex(Math.min(saved.bgIndex || 0, Math.max(restoredPlaylist.length - 1, 0)));
        setRepeatPlaylist(saved.repeatPlaylist !== false);
        setPerfTracks(restoredPerformances);
        if (Number.isFinite(saved.bgVolume)) setBgVolume(saved.bgVolume);
        if (Array.isArray(saved.perfVolumes) && saved.perfVolumes.length === 4) {
          setPerfVolumes(saved.perfVolumes);
        }
      } catch (error) {
        console.warn('Saved show setup could not be restored:', error);
      } finally {
        settingsHydratedRef.current = true;
      }
    };
    try {
      if (window.electronAPI) {
        // Desktop Electron version
        const files = await window.electronAPI.getAudioFiles();
        setAudioFiles(files);
        restoreShowSetup(files);
      } else {
        // PWA/iPad version - load from IndexedDB
        const savedFiles = await loadFilesFromIndexedDB();
        if (savedFiles && savedFiles.length > 0) {
          setAudioFiles(savedFiles);
          setCustomFolder('Saved audio files');
          restoreShowSetup(savedFiles);
        } else {
          // Nothing imported yet — start empty
          setAudioFiles(DEFAULT_AUDIO_FILES);
          setCustomFolder(null);
          settingsHydratedRef.current = true;
        }
      }
    } catch (error) {
      console.error('Error loading audio files:', error);
      setAudioFiles(DEFAULT_AUDIO_FILES);
      settingsHydratedRef.current = true;
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
          if (files.length === 0) return;
          const { accepted, skipped } = await processFilesForPWA(files);
          if (accepted.length === 0) {
            showNotice('No playable audio files were found.', 'error');
            return;
          }

          const known = new Set(audioFiles.map(file => file.id));
          const additions = accepted.filter(file => !known.has(file.id));
          const merged = [...audioFiles, ...additions]
            .sort((a, b) => a.name.localeCompare(b.name));
          accepted.filter(file => known.has(file.id)).forEach(file => URL.revokeObjectURL(file.path));
          setAudioFiles(merged);
          setCustomFolder(`${merged.length} track${merged.length === 1 ? '' : 's'} ready`);
          const skippedCopy = skipped > 0 ? ` · ${skipped} skipped` : '';
          showNotice(`Added ${additions.length} track${additions.length === 1 ? '' : 's'}${skippedCopy}`);

          // Save to IndexedDB for persistence
          await saveFilesToIndexedDB(merged);
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
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(['audioFiles'], 'readwrite');
        const store = transaction.objectStore('audioFiles');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Audio save was interrupted.'));
        store.clear();
        files.forEach(file => store.put(file));
      });
      console.log('Files saved to IndexedDB');
      return true;
    } catch (error) {
      console.error('Error saving to IndexedDB:', error);
      showNotice('Tracks are loaded, but this iPad could not save them for next time.', 'error');
      return false;
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

  const inspectAudioFile = (blobUrl) => new Promise((resolve, reject) => {
    const probe = document.createElement('audio');
    const timeout = window.setTimeout(() => finish(new Error('Audio metadata timed out.')), 10000);
    let settled = false;

    const finish = (error, duration = 0) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      probe.onloadedmetadata = null;
      probe.onerror = null;
      probe.removeAttribute('src');
      if (error) reject(error);
      else resolve(duration);
    };

    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const duration = Number.isFinite(probe.duration) ? probe.duration : 0;
      if (duration <= 0) finish(new Error('Audio file has no playable duration.'));
      else finish(null, duration);
    };
    probe.onerror = () => finish(new Error('Audio format is not playable on this device.'));
    probe.src = blobUrl;
  });

  const processFilesForPWA = async (files) => {
    const accepted = [];
    let skipped = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const supportedName = file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i);
      if (file.size <= 0 || (!file.type.startsWith('audio/') && !supportedName)) {
        skipped += 1;
        continue;
      }

      const blobUrl = URL.createObjectURL(file);
      try {
        const duration = await inspectAudioFile(blobUrl);
        accepted.push({
          id: `file-${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          path: blobUrl,
          size: file.size,
          type: file.type,
          duration,
          fileData: file,
        });
      } catch (error) {
        console.warn(`Skipping ${file.name}:`, error);
        URL.revokeObjectURL(blobUrl);
        skipped += 1;
      }
    }

    return {
      accepted: accepted.sort((a, b) => a.name.localeCompare(b.name)),
      skipped,
    };
  };

  const trackName = (path) => audioFiles.find(file => file.path === path)?.name || 'Unknown track';

  const addBackgroundTrack = (path) => {
    if (!path || bgPlaylist.includes(path)) return;
    setBgPlaylist(previous => [...previous, path]);
    if (bgPlaylist.length === 0) setBgIndex(0);
  };

  const removeBackgroundTrack = (index) => {
    const nextPlaylist = bgPlaylist.filter((_, itemIndex) => itemIndex !== index);
    setBgPlaylist(nextPlaylist);
    if (nextPlaylist.length === 0) {
      if (bgAudioRef.current) bgAudioRef.current.pause();
      setBgPlaying(false);
      setBgIndex(0);
    } else if (index < bgIndex) {
      setBgIndex(previous => previous - 1);
    } else if (bgIndex >= nextPlaylist.length) {
      setBgIndex(nextPlaylist.length - 1);
    }
  };

  const playBackgroundAudio = async () => {
    const audio = bgAudioRef.current;
    if (!bgTrack || !audio || currentPerformance !== null) return false;

    const ready = await ensureAudioReady();
    if (!ready) {
      setShowError('DreamLIVE audio is paused by the device. Tap Output ready, then try again.');
      setShowPhase(SHOW_PHASE.ERROR);
      return false;
    }

    if (audioContextRef.current && !bgSourceNodeRef.current) {
      try {
        const source = audioContextRef.current.createMediaElementSource(audio);
        source.connect(bgGainNodeRef.current);
        bgSourceNodeRef.current = source;
      } catch (error) {
        console.warn('Background audio connection failed:', error);
      }
    }

    if (bgGainNodeRef.current) {
      audio.volume = 1;
      muteGain(bgGainNodeRef.current);
    } else {
      audio.volume = bgVolume;
    }
    const ok = await playSafely(audio, 'background music');
    if (ok) {
      setBgPlaying(true);
      setShowError('');
      fadeGainTo(bgGainNodeRef.current, bgVolume, START_FADE);
    } else {
      setShowError(`${trackName(bgTrack)} couldn’t start. Check Output ready, then try again.`);
      setShowPhase(SHOW_PHASE.ERROR);
    }
    return ok;
  };

  // Background playlist controls
  const toggleBackgroundMusic = async () => {
    if (!bgTrack || !bgAudioRef.current || isFading) return;
    if (currentPerformance !== null && !bgPlaying) return;
    if (!soundCheckComplete && !bgPlaying) {
      setSoundCheckOpen(true);
      showNotice('Complete the sound check before starting BGM.', 'error');
      return;
    }

    if (bgPlaying) {
      bgAudioRef.current.pause();
      setBgPlaying(false);
      return;
    }

    await playBackgroundAudio();
  };

  const advanceBackground = async () => {
    if (currentPerformance !== null || bgPlaylist.length === 0) return;
    const next = nextPlaylistIndex({
      currentIndex: bgIndex,
      length: bgPlaylist.length,
      repeat: repeatPlaylist,
    });
    if (next === null) {
      setBgPlaying(false);
      return;
    }

    if (bgAudioRef.current) bgAudioRef.current.pause();
    if (next === bgIndex) {
      bgAudioRef.current.currentTime = 0;
      await playBackgroundAudio();
    } else {
      setBgIndex(next);
    }
  };

  useEffect(() => {
    if (!bgPlaying || currentPerformance !== null || !bgTrack) return;
    if (bgAudioRef.current) {
      bgAudioRef.current.load();
      playBackgroundAudio();
    }
  }, [bgTrack]);

  const handleBgVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setBgVolume(newVolume);
    if (bgGainNodeRef.current) {
      bgGainNodeRef.current.gain.value = newVolume;
      if (bgAudioRef.current) bgAudioRef.current.volume = 1;
    } else if (bgAudioRef.current) {
      bgAudioRef.current.volume = newVolume;
    }
  };

  // Performance volume control
  const handlePerfVolumeChange = (index, value) => {
    const newVolume = parseFloat(value);
    setPerfVolumes(previous => previous.map((volume, trackIndex) => (
      trackIndex === index ? newVolume : volume
    )));

    if (perfGainNodeRefs.current[index]) {
      perfGainNodeRefs.current[index].gain.value = newVolume;
      if (perfAudioRefs.current[index]) perfAudioRefs.current[index].volume = 1;
    } else if (perfAudioRefs.current[index]) {
      perfAudioRefs.current[index].volume = newVolume;
    }
  };

  const handleMasterVolumeChange = (value) => {
    const nextVolume = Math.min(Math.max(Number.parseFloat(value), 0), 1);
    if (!Number.isFinite(nextVolume)) return;
    setMasterVolume(nextVolume);
  };

  const restoreShowLevel = () => {
    setMasterVolume(savedMasterVolume);
    showNotice(`Show level restored to ${Math.round(savedMasterVolume * 100)}%.`);
  };

  const playSoundCheck = async () => {
    if (bgPlaying || currentPerformance !== null || isFading || isCheckingSound) return;
    setIsCheckingSound(true);
    const ready = await ensureAudioReady();
    const context = audioContextRef.current;
    const destination = masterCompressorRef.current;
    if (!ready || !context || !destination) {
      setIsCheckingSound(false);
      showNotice('Sound check couldn’t start. Tap Play test sound again.', 'error');
      return;
    }

    const scheduleTone = (frequency, startAt) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.075, startAt + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.32);
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.34);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    };

    const now = context.currentTime + 0.03;
    scheduleTone(523.25, now);
    scheduleTone(659.25, now + 0.34);
    window.setTimeout(() => setIsCheckingSound(false), 850);
  };

  const confirmSoundCheck = () => {
    window.localStorage.setItem(MASTER_LEVEL_KEY, String(masterVolume));
    setSavedMasterVolume(masterVolume);
    setSoundCheckComplete(true);
    closeSoundCheck();
    showNotice(`Output ready at ${Math.round(masterVolume * 100)}%.`);
  };

  const BGM_FADE_SECONDS = 1.1;

  const cancelFade = () => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    if (fadeResolverRef.current) {
      fadeResolverRef.current(false);
      fadeResolverRef.current = null;
    }
  };

  const waitForFade = (milliseconds) => new Promise(resolve => {
    cancelFade();
    fadeResolverRef.current = resolve;
    fadeTimeoutRef.current = setTimeout(() => {
      fadeTimeoutRef.current = null;
      fadeResolverRef.current = null;
      resolve(true);
    }, milliseconds);
  });

  const fadeOutBackground = async () => {
    if (!bgAudioRef.current || !bgPlaying) return;
    setIsFading(true);
    const audio = bgAudioRef.current;

    if (bgGainNodeRef.current && audioContextRef.current) {
      const g = bgGainNodeRef.current.gain;
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(g.value, 0.0001), now);
      g.exponentialRampToValueAtTime(0.001, now + BGM_FADE_SECONDS);
      const completed = await waitForFade((BGM_FADE_SECONDS * 1000) + 50);
      if (!completed) throw new Error('Transition cancelled.');
      audio.pause();
      g.setValueAtTime(0.0001, ctx.currentTime);
    } else {
      audio.pause();
    }
    setBgPlaying(false);
    setIsFading(false);
  };

  const fadeInBackground = async () => {
    if (!bgAudioRef.current || !bgTrack) return;
    setIsFading(true);
    const audio = bgAudioRef.current;
    const ready = await ensureAudioReady();
    if (!ready) throw new Error('DreamLIVE audio couldn’t resume. Tap Stop audio, then start BGM again.');

    if (bgGainNodeRef.current && audioContextRef.current) {
      const g = bgGainNodeRef.current.gain;
      const ctx = audioContextRef.current;
      audio.volume = 1;
      muteGain(bgGainNodeRef.current);
      const ok = await playSafely(audio, 'background music');
      if (!ok) throw new Error('BGM couldn’t resume. Tap Play BGM.');
      setBgPlaying(true);
      g.exponentialRampToValueAtTime(Math.max(bgVolume, 0.0002), ctx.currentTime + BGM_FADE_SECONDS);
      const completed = await waitForFade((BGM_FADE_SECONDS * 1000) + 50);
      if (!completed) throw new Error('Transition cancelled.');
    } else {
      audio.volume = bgVolume;
      const ok = await playSafely(audio, 'background music');
      if (!ok) throw new Error('BGM couldn’t resume. Tap Play BGM.');
      setBgPlaying(true);
    }
    setIsFading(false);
  };

  const playPerformanceTrack = async (index) => {
    setCurrentPerformance(index);
    const audio = perfAudioRefs.current[index];
    if (!audio) throw new Error(`Performance ${index + 1} is not available.`);

    if (audioContextRef.current && !perfSourceNodeRefs.current[index]) {
      try {
        const source = audioContextRef.current.createMediaElementSource(audio);
        source.connect(perfGainNodeRefs.current[index]);
        perfSourceNodeRefs.current[index] = source;
      } catch (error) {
        console.warn('Performance audio connection failed:', error);
      }
    }

    const perfGain = perfGainNodeRefs.current[index];
    const target = perfVolumes[index];
    audio.currentTime = 0;
    audio.volume = perfGain ? 1 : target;
    muteGain(perfGain);
    const ready = await ensureAudioReady();
    if (!ready) throw new Error('DreamLIVE audio couldn’t resume. Tap Stop audio, then start BGM again.');
    const ok = await playSafely(audio, `Performance ${index + 1}`);
    if (!ok) throw new Error(`Performance ${index + 1} couldn’t start. Check the track, then try again.`);

    fadeGainTo(perfGain, target, START_FADE);
    setPerfPlaying(previous => previous.map((playing, trackIndex) => (
      trackIndex === index ? true : playing
    )));
  };

  // Start performance through one ordered, test-covered show flow.
  const startPerformance = async (index) => {
    if (!perfTracks[index] || currentPerformance !== null || isFading || transitionLockRef.current) return;
    if (!bgPlaying) {
      showNotice('Start BGM before starting a performance.', 'error');
      return;
    }
    transitionLockRef.current = true;
    setShowError('');
    setCurrentPerformance(index);
    setPerformanceStatus(previous => previous.map((done, trackIndex) => (
      trackIndex === index ? false : done
    )));

    try {
      await startPerformanceFlow({
        lowerBackground: fadeOutBackground,
        playPerformance: () => playPerformanceTrack(index),
        restoreBackground: fadeInBackground,
        onPhase: setShowPhase,
      });
      transitionLockRef.current = false;
    } catch (error) {
      transitionLockRef.current = false;
      setCurrentPerformance(null);
      setPerfPlaying(previous => previous.map((playing, trackIndex) => (
        trackIndex === index ? false : playing
      )));
      setIsFading(false);
      if (error.message !== 'Transition cancelled.') {
        setShowError(error.message);
        setShowPhase(SHOW_PHASE.ERROR);
      }
    }
  };

  // Toggle pause for individual performance
  const togglePerfPause = async (index) => {
    const audio = perfAudioRefs.current[index];
    if (!audio) return;

    if (perfPlaying[index]) {
      audio.pause();
      setPerfPlaying(previous => previous.map((playing, trackIndex) => (
        trackIndex === index ? false : playing
      )));
      setShowPhase(SHOW_PHASE.PAUSED);
      return;
    }

    // A resumed context can repeat the warm-up, so mute then fade here too.
    const perfGain = perfGainNodeRefs.current[index];
    await ensureAudioReady();
    muteGain(perfGain);
    const ok = await playSafely(audio, `Performance ${index + 1}`);
    if (ok) {
      fadeGainTo(perfGain, perfVolumes[index], RESUME_FADE);
      setPerfPlaying(previous => previous.map((playing, trackIndex) => (
        trackIndex === index ? true : playing
      )));
      setShowPhase(SHOW_PHASE.LIVE);
    } else if (perfGain) {
      fadeGainTo(perfGain, perfVolumes[index], 0);
    }
  };

  // Handle performance end
  const handlePerformanceEnd = async (index) => {
    setPerfPlaying(previous => previous.map((playing, trackIndex) => (
      trackIndex === index ? false : playing
    )));
    setPerformanceStatus(previous => previous.map((done, trackIndex) => (
      trackIndex === index ? true : done
    )));

    setCurrentPerformance(null);
    try {
      await finishPerformanceFlow({
        restoreBackground: fadeInBackground,
        onPhase: setShowPhase,
      });
    } catch (error) {
      setIsFading(false);
      setShowError(error.message);
      setShowPhase(SHOW_PHASE.ERROR);
    }
  };

  // Handle loaded metadata to get duration
  const handleLoadedMetadata = (index) => {
    const audio = perfAudioRefs.current[index];
    if (audio) {
      setPerfDurations(previous => previous.map((duration, trackIndex) => (
        trackIndex === index ? audio.duration : duration
      )));
    }
  };

  // Seek to position in performance
  const handleSeek = (index, value) => {
    const audio = perfAudioRefs.current[index];
    if (audio) {
      audio.currentTime = parseFloat(value);
      setPerfProgress(previous => previous.map((progress, trackIndex) => (
        trackIndex === index ? parseFloat(value) : progress
      )));
    }
  };

  const stopAllAudio = (announce = true) => {
    transitionLockRef.current = false;
    cancelFade();
    setIsFading(false);
    if (bgAudioRef.current) bgAudioRef.current.pause();
    perfAudioRefs.current.forEach(audio => audio && audio.pause());
    setBgPlaying(false);
    setPerfPlaying([false, false, false, false]);
    setCurrentPerformance(null);
    setShowError('');
    setShowPhase(SHOW_PHASE.SETUP);
    if (announce) showNotice('All audio stopped. Your show setup is preserved.');
  };

  // Reset all
  const resetAll = () => {
    stopAllAudio(false);
    if (bgAudioRef.current) {
      bgAudioRef.current.currentTime = 0;
    }

    perfAudioRefs.current.forEach((audio, index) => {
      if (audio) {
        audio.currentTime = 0;
      }
    });

    setBgPlaylist([]);
    setBgIndex(0);
    setPerfTracks(['', '', '', '']);
    setPerfProgress([0, 0, 0, 0]);
    setPerfDurations([0, 0, 0, 0]);
    setPerformanceStatus([false, false, false, false]);
    setResetConfirmOpen(false);

    showNotice('Show reset. Ready for a fresh setup.');
  };

  // Format time in mm:ss
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const completedCount = performanceStatus.filter(status => status).length;
  const assignedCount = perfTracks.filter(Boolean).length;
  const completedAssignedCount = performanceStatus.filter((status, index) => (
    status && Boolean(perfTracks[index])
  )).length;
  const readiness = getShowReadiness({
    outputReady: soundCheckComplete,
    playlistLength: bgPlaylist.length,
    bgPlaying,
    assignedPerformances: assignedCount,
  });
  const deckState = getShowDeckState({
    ready: readiness.ready,
    assignments: perfTracks.map(Boolean),
    completed: performanceStatus,
    currentPerformance,
  });
  const runDeck = deckState.mode !== 'prep' && !setupExpanded;
  const focusPerformanceIndex = deckState.activePerformanceIndex ?? deckState.nextPerformanceIndex;
  const queuedPerformanceIndexes = [0, 1, 2, 3].filter(index => (
    perfTracks[index]
    && !performanceStatus[index]
    && index !== deckState.activePerformanceIndex
    && index !== deckState.nextPerformanceIndex
  ));

  useEffect(() => {
    if (deckState.mode === 'prep') {
      hasReachedReadyRef.current = false;
      setSetupExpanded(true);
      return;
    }
    if (deckState.mode === 'ready' && !hasReachedReadyRef.current) {
      setSetupExpanded(false);
    }
    hasReachedReadyRef.current = true;
  }, [deckState.mode]);
  const activePhases = [
    SHOW_PHASE.TRANSITIONING,
    SHOW_PHASE.LIVE,
    SHOW_PHASE.PAUSED,
    SHOW_PHASE.RESTORING,
  ];
  const visiblePhase = showError
    ? SHOW_PHASE.ERROR
    : activePhases.includes(showPhase) ? showPhase : readiness.phase;
  const phaseLabels = {
    [SHOW_PHASE.SETUP]: readiness.label,
    [SHOW_PHASE.READY]: 'Show ready ・ 準備完了',
    [SHOW_PHASE.TRANSITIONING]: 'Transitioning ・ 切り替え中',
    [SHOW_PHASE.LIVE]: 'Performance live ・ 出演中',
    [SHOW_PHASE.PAUSED]: 'Performance paused ・ 一時停止',
    [SHOW_PHASE.RESTORING]: 'Restoring BGM ・ BGM復帰中',
    [SHOW_PHASE.ERROR]: 'Needs attention ・ 確認が必要',
  };
  const currentPerformanceName = currentPerformance === null
    ? ''
    : trackName(perfTracks[currentPerformance]);
  const nextBgIndex = nextPlaylistIndex({
    currentIndex: bgIndex,
    length: bgPlaylist.length,
    repeat: repeatPlaylist,
  });
  const nextBgTrack = nextBgIndex === null ? '' : bgPlaylist[nextBgIndex];
  const phaseDetail = showError
    || (visiblePhase === SHOW_PHASE.TRANSITIONING && currentPerformance !== null
      ? `Lowering BGM → Performance ${currentPerformance + 1}` : '')
    || (visiblePhase === SHOW_PHASE.LIVE ? currentPerformanceName : '')
    || (visiblePhase === SHOW_PHASE.PAUSED ? `${currentPerformanceName} · Tap Resume when ready` : '')
    || (visiblePhase === SHOW_PHASE.RESTORING ? `Returning to ${trackName(bgTrack)}` : '')
    || (!soundCheckComplete ? 'Set device volume, test the room, then confirm output' : '')
    || (bgPlaylist.length === 0
      ? (audioFiles.length === 0 ? 'Import audio, then add a BGM track' : 'Add a track to the BGM playlist')
      : '')
    || (!bgPlaying ? 'Start BGM to open the performance controls' : '')
    || (assignedCount === 0 ? 'Assign the next performance track' : '')
    || `${assignedCount} performance${assignedCount === 1 ? '' : 's'} assigned`;

  return (
    <div className="App">
      {notice && (
        <div className={`app-toast ${notice.tone}`} role="status" aria-live="polite">
          {notice.message}
        </div>
      )}

      <header className={`app-header ${runDeck ? 'run-deck' : ''}`}>
        <div className="header-content">
          <div className="logo-container">
            <img
              src="/icons/Dreamlive.png"
              alt="DreamLIVE! Performance Controller"
              className="logo-image"
            />
          </div>
          <p className="app-subtitle">Show controller ・ ライブコントローラー</p>
        </div>
        <div className="header-controls">
          {!runDeck && (
            <button className="folder-btn" onClick={handleSelectFolder} title="Add licensed tracks to this device">
              <FolderOpen size={20} />
              <span>Import audio</span>
            </button>
          )}
          {deckState.mode !== 'prep' && (
            <button
              type="button"
              className="setup-toggle-btn"
              onClick={() => setSetupExpanded(previous => !previous)}
              aria-pressed={!runDeck}
            >
              <SlidersHorizontal size={18} />
              <span>{runDeck ? 'Edit setup' : 'Run show'}</span>
            </button>
          )}
          <button
            className={`output-status-btn ${soundCheckComplete ? 'ready' : 'needs-check'}`}
            onClick={openSoundCheck}
            aria-label={`${soundCheckComplete ? 'Output ready' : 'Sound check'}, DreamLIVE level ${Math.round(masterVolume * 100)}%`}
          >
            {soundCheckComplete ? <Check size={18} /> : <SlidersHorizontal size={18} />}
            <span>{soundCheckComplete ? 'Output ready' : 'Sound check'}</span>
            <strong>{Math.round(masterVolume * 100)}%</strong>
          </button>
          <button className="stop-audio-btn" onClick={() => stopAllAudio()} title="Stop all audio">
            <Square size={18} fill="currentColor" />
            <span>Stop audio</span>
          </button>
        </div>
      </header>

      {soundCheckOpen && (
        <div
          className="output-dialog-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeSoundCheck();
          }}
        >
          <section
            ref={soundCheckDialogRef}
            className="output-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="output-dialog-title"
            tabIndex="-1"
          >
            <div className="output-dialog-header">
              <div className="output-dialog-icon" aria-hidden="true"><Headphones size={22} /></div>
              <div>
                <span className="section-kicker">Room output</span>
                <h2 id="output-dialog-title">Sound check ・ 音量確認</h2>
              </div>
              <button
                ref={soundCheckCloseRef}
                type="button"
                className="dialog-close"
                onClick={closeSoundCheck}
                aria-label="Close sound check"
              >
                <X size={20} />
              </button>
            </div>

            <div className="output-step">
              <span className="output-step-number">1</span>
              <div className="output-step-copy">
                <strong>Set device volume</strong>
                <span>Use the side buttons and leave it at 7 of 10 bars.</span>
              </div>
              <div className="device-level-meter" aria-label="Device volume target: 7 of 10 bars">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(bar => (
                  <span key={bar} className={bar < 7 ? 'filled' : ''} />
                ))}
              </div>
            </div>

            <div className="output-step output-step-master">
              <span className="output-step-number">2</span>
              <div className="output-step-copy">
                <strong>Set DreamLIVE output</strong>
                <span>This controls every BGM and performance track together.</span>
              </div>
              <div className="master-level-control">
                <Volume2 size={18} aria-hidden="true" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={masterVolume}
                  onChange={event => handleMasterVolumeChange(event.target.value)}
                  aria-label="DreamLIVE master output"
                />
                <strong>{Math.round(masterVolume * 100)}%</strong>
              </div>
              {Math.abs(masterVolume - savedMasterVolume) > 0.005 && (
                <button type="button" className="restore-level-btn" onClick={restoreShowLevel}>
                  Restore {Math.round(savedMasterVolume * 100)}%
                </button>
              )}
            </div>

            <p className="output-device-note">
              DreamLIVE cannot read or change the device’s physical volume. Keep the device at 7 bars during the show; use DreamLIVE for every other level change.
            </p>

            <div className="output-dialog-actions">
              <button
                type="button"
                className="test-sound-btn"
                onClick={playSoundCheck}
                disabled={bgPlaying || currentPerformance !== null || isFading || isCheckingSound}
              >
                <Play size={18} />
                <span>{isCheckingSound
                  ? 'Playing test…'
                  : (bgPlaying || currentPerformance !== null ? 'Show audio active' : 'Play test sound')}</span>
              </button>
              <button type="button" className="confirm-output-btn" onClick={confirmSoundCheck}>
                <Check size={18} />
                <span>Sound is clear</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {resetConfirmOpen && (
        <div
          className="output-dialog-backdrop reset-dialog-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeResetConfirmation();
          }}
        >
          <section
            ref={resetDialogRef}
            className="reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            aria-describedby="reset-dialog-description"
          >
            <div className="reset-dialog-mark" aria-hidden="true"><RotateCcw size={22} /></div>
            <span className="section-kicker">New show setup ・ 新しいセット</span>
            <h2 id="reset-dialog-title">Reset this show? ・ リセットしますか</h2>
            <p id="reset-dialog-description">
              This stops all audio and clears the BGM playlist, performance assignments, and completed cues. Imported audio stays on this device.
            </p>
            <div className="reset-dialog-actions">
              <button ref={resetCancelRef} type="button" className="keep-setup-btn" onClick={closeResetConfirmation}>
                Keep setup
              </button>
              <button type="button" className="confirm-reset-btn" onClick={resetAll}>
                <RotateCcw size={18} />
                Reset show
              </button>
            </div>
          </section>
        </div>
      )}

      <section className={`show-command-bar phase-${visiblePhase} ${runDeck ? 'run-deck' : ''}`} aria-live={visiblePhase === SHOW_PHASE.ERROR ? 'assertive' : 'polite'}>
        <div className="show-phase-block">
          <span className="show-phase-dot" aria-hidden="true" />
          <div>
            <span className="show-phase-eyebrow">Show status ・ 進行状況</span>
            <strong>{phaseLabels[visiblePhase]}</strong>
          </div>
        </div>
        <div className="show-phase-message">
          <p className="show-phase-detail">{phaseDetail}</p>
          {showError && (
            <button type="button" onClick={() => setShowError('')}>Acknowledge</button>
          )}
        </div>
        <div className="show-now-playing">
          <span>{currentPerformance !== null ? 'On stage' : 'BGM now'}</span>
          <strong>{currentPerformanceName || (bgTrack ? trackName(bgTrack) : 'Nothing selected')}</strong>
        </div>
      </section>

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
          <main className={`show-workspace deck-${deckState.mode} ${runDeck ? 'run-deck' : ''} ${currentPerformance !== null ? 'is-live' : ''}`}>
            <section className={`background-section split-layout ${bgPlaying ? 'is-playing' : ''}`}>
              <div className="section-header">
                <div>
                  <span className="section-kicker">Continuous room audio ・ 店内BGM</span>
                  <h2 className="section-title">BGM playlist</h2>
                </div>
                {isFading ? (
                  <span className="bg-status-badge fading">Transitioning</span>
                ) : currentPerformance !== null ? (
                  <span className="bg-status-badge queued">Held safely</span>
                ) : bgPlaying ? (
                  <span className="bg-status-badge playing">Playing</span>
                ) : bgPlaylist.length > 0 ? (
                  <span className="bg-status-badge ready">Ready</span>
                ) : (
                  <span className="bg-status-badge idle">Build playlist</span>
                )}
              </div>
              {audioFiles.length === 0 && (
                <div className="library-inline-state">
                  <FolderOpen size={20} />
                  <div>
                    <strong>No tracks on this device ・ 音源がありません</strong>
                    <span>Import audio to build the show.</span>
                  </div>
                </div>
              )}
              <div className="bg-music-container">
                <div className="bg-now-next">
                  <div><span>Now</span><strong>{bgTrack ? trackName(bgTrack) : 'No BGM queued'}</strong></div>
                  <div><span>Up next</span><strong>{nextBgTrack ? trackName(nextBgTrack) : 'End of playlist'}</strong></div>
                </div>

                <div className="bg-select" aria-label="Add a background track">
                  <SearchableSelect
                    value=""
                    onChange={addBackgroundTrack}
                    options={audioFiles.filter(file => !bgPlaylist.includes(file.path)).map(file => ({
                      value: file.path,
                      label: file.name
                    }))}
                    placeholder="Add BGM track"
                    disabled={audioFiles.length === 0 || currentPerformance !== null || isFading}
                  />
                </div>

                <div className="bg-playlist" aria-label="Background playlist">
                  {bgPlaylist.length === 0 ? (
                    <p className="playlist-empty"><ListMusic size={18} /> Your BGM queue will autoplay here.</p>
                  ) : bgPlaylist.map((path, index) => (
                    <div className={`playlist-row ${index === bgIndex ? 'current' : ''}`} key={path}>
                      <span className="playlist-position">{index + 1}</span>
                      <span className="playlist-track-name">{trackName(path)}</span>
                      {index === bgIndex && <span className="playlist-current-label">Now</span>}
                      <button
                        type="button"
                        className="playlist-remove"
                        onClick={() => removeBackgroundTrack(index)}
                        disabled={currentPerformance !== null || isFading}
                        aria-label={`Remove ${trackName(path)} from BGM playlist`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-controls">
                  <button
                    className={`play-btn ${bgPlaying ? 'is-playing' : ''}`}
                    onClick={toggleBackgroundMusic}
                    disabled={!bgTrack || !soundCheckComplete || currentPerformance !== null || isFading}
                    aria-label={bgPlaying ? 'Pause background music' : 'Play background music'}
                  >
                    {bgPlaying ? <Pause size={24} /> : <Play size={24} />}
                    <span>{bgPlaying ? 'Pause BGM' : 'Play BGM'}</span>
                  </button>
                  <button
                    type="button"
                    className="next-track-btn"
                    onClick={advanceBackground}
                    disabled={!bgTrack || currentPerformance !== null || isFading}
                  >
                    <SkipForward size={20} />
                    <span>Next track</span>
                  </button>
                  <button
                    type="button"
                    className={`repeat-playlist-btn ${repeatPlaylist ? 'active' : ''}`}
                    onClick={() => setRepeatPlaylist(previous => !previous)}
                    aria-pressed={repeatPlaylist}
                  >
                    <Repeat2 size={18} />
                    <span>Repeat</span>
                  </button>

                  <div className="volume-control">
                    <span className="volume-control-label">BGM level</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={bgVolume}
                      onChange={handleBgVolumeChange}
                      className="volume-slider"
                      aria-label="BGM volume"
                      disabled={currentPerformance !== null || isFading}
                    />
                    <span className="volume-label">{Math.round(bgVolume * 100)}%</span>
                  </div>
                </div>

                <audio
                  ref={bgAudioRef}
                  src={bgTrack || undefined}
                  preload="auto"
                  onEnded={advanceBackground}
                  onError={() => {
                    if (!bgTrack) return;
                    setBgPlaying(false);
                    setShowError(`${trackName(bgTrack)} couldn’t play. Choose another BGM track.`);
                    setShowPhase(SHOW_PHASE.ERROR);
                  }}
                />
              </div>
            </section>

            <section className="performances-section">
              <div className="section-header">
                <div>
                  <span className="section-kicker">On-stage cues ・ 出演キュー</span>
                  <h2 className="section-title">Performances ・ パフォーマンス</h2>
                </div>
                <div
                  className="performance-summary"
                  aria-label={runDeck
                    ? `${completedAssignedCount} of ${assignedCount} assigned performances complete`
                    : `${completedCount} of 4 performance slots complete, ${assignedCount} assigned`}
                >
                  <strong>{runDeck ? `${completedAssignedCount}/${assignedCount}` : `${completedCount}/4`}</strong>
                  <span>{runDeck ? 'complete' : `${assignedCount} assigned`}</span>
                </div>
              </div>
            {runDeck && (
              <div className={`run-focus-panel mode-${deckState.mode}`}>
                <SakuraDrift />
                {deckState.mode === 'live' && focusPerformanceIndex !== null ? (
                  <>
                    <div className="run-focus-heading">
                      <div>
                        <span className="run-focus-kicker">
                          {isFading
                            ? 'Transition in progress ・ 切り替え中'
                            : (showPhase === SHOW_PHASE.PAUSED ? 'Paused on stage ・ 一時停止' : 'On stage ・ 出演中')}
                        </span>
                        <p>Performance {focusPerformanceIndex + 1}</p>
                        <h2>{trackName(perfTracks[focusPerformanceIndex])}</h2>
                      </div>
                      <span className={`run-live-badge ${showPhase === SHOW_PHASE.PAUSED ? 'paused' : ''}`}>
                        {isFading ? 'Starting' : (showPhase === SHOW_PHASE.PAUSED ? 'Paused' : 'Live')}
                      </span>
                    </div>
                    <div className="run-progress">
                      <span>{formatTime(perfProgress[focusPerformanceIndex])}</span>
                      <input
                        type="range"
                        min="0"
                        max={perfDurations[focusPerformanceIndex] || 1}
                        step="0.1"
                        value={perfProgress[focusPerformanceIndex]}
                        onChange={event => handleSeek(focusPerformanceIndex, event.target.value)}
                        disabled={!perfDurations[focusPerformanceIndex]}
                        aria-label={`Seek performance ${focusPerformanceIndex + 1}`}
                      />
                      <span>{formatTime(perfDurations[focusPerformanceIndex])}</span>
                    </div>
                    <button
                      type="button"
                      className={`run-primary-action ${perfPlaying[focusPerformanceIndex] ? 'is-pause' : ''}`}
                      onClick={() => togglePerfPause(focusPerformanceIndex)}
                      disabled={isFading}
                    >
                      {perfPlaying[focusPerformanceIndex] ? <Pause size={24} /> : <Play size={24} />}
                      <span>{perfPlaying[focusPerformanceIndex] ? 'Pause performance' : 'Resume performance'}</span>
                    </button>
                    <div className="run-next-preview">
                      <span>Next cue</span>
                      <strong>
                        {deckState.nextPerformanceIndex === null
                          ? 'Final performance'
                          : `Performance ${deckState.nextPerformanceIndex + 1} · ${trackName(perfTracks[deckState.nextPerformanceIndex])}`}
                      </strong>
                    </div>
                  </>
                ) : deckState.nextPerformanceIndex !== null ? (
                  <>
                    <div className="run-focus-heading ready-heading">
                      <div>
                        <span className="run-focus-kicker">Next on stage ・ 次の出演</span>
                        <p>Performance {deckState.nextPerformanceIndex + 1}</p>
                        <h2>{trackName(perfTracks[deckState.nextPerformanceIndex])}</h2>
                      </div>
                      <span className="run-ready-count">{deckState.remainingAssignedCount} remaining</span>
                    </div>
                    <button
                      type="button"
                      className="run-primary-action"
                      onClick={() => startPerformance(deckState.nextPerformanceIndex)}
                      disabled={!bgPlaying || isFading}
                    >
                      <Play size={26} />
                      <span className="run-action-label">
                        <span>Start performance {deckState.nextPerformanceIndex + 1}</span>
                        <small>パフォーマンスを開始</small>
                      </span>
                    </button>
                    <p className="run-safety-note">BGM lowers first. The performance starts only after the room is clear.</p>
                  </>
                ) : (
                  <div className="run-complete-state">
                    <Check size={28} />
                    <div>
                      <span className="run-focus-kicker">Show complete ・ 公演完了</span>
                      <h2>All assigned performances are done</h2>
                      <p>BGM continues. Edit setup if another cue is needed.</p>
                    </div>
                  </div>
                )}

                {queuedPerformanceIndexes.length > 0 && (
                  <div className="run-cue-queue" aria-label="Later performance cues">
                    <span>Later</span>
                    {queuedPerformanceIndexes.map(index => (
                      <div key={index}>
                        <strong>#{index + 1}</strong>
                        <p>{trackName(perfTracks[index])}</p>
                        <span>Ready</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="performances-grid">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`performance-card ${currentPerformance === index ? 'active' : ''
                    } ${performanceStatus[index] ? 'completed' : ''}`}
                >
                  <div className="perf-header">
                    <div className="perf-number">#{index + 1}</div>
                    <h3 className="perf-title">Performance {index + 1}</h3>
                    {currentPerformance === index && perfPlaying[index] ? (
                      <span className="perf-status-badge playing">Live</span>
                    ) : currentPerformance === index && !perfPlaying[index] ? (
                      <span className="perf-status-badge paused">{isFading ? 'Transitioning' : 'Paused'}</span>
                    ) : performanceStatus[index] ? (
                      <span className="perf-status-badge completed">Done</span>
                    ) : perfTracks[index] ? (
                      <span className="perf-status-badge ready">Ready</span>
                    ) : (
                      <span className="perf-status-badge idle">Empty</span>
                    )}
                  </div>

                  <div className="perf-select">
                    <SearchableSelect
                      value={perfTracks[index]}
                      onChange={(value) => {
                        setPerfTracks(previous => previous.map((track, trackIndex) => (
                          trackIndex === index ? value : track
                        )));
                      }}
                      options={audioFiles.map(file => ({
                        value: file.path,
                        label: file.name
                      }))}
                      placeholder="Assign track"
                      disabled={currentPerformance !== null || isFading}
                    />
                  </div>

                  {perfTracks[index] && (
                    <>
                      {/* Volume Control */}
                      <div className="perf-volume">
                        <span className="volume-control-label">Track level</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={perfVolumes[index]}
                          onChange={(e) => handlePerfVolumeChange(index, e.target.value)}
                          className="volume-slider"
                          aria-label={`Performance ${index + 1} volume`}
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
                            aria-label={`Seek Performance ${index + 1}`}
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
                          <>
                            <button
                              className="start-performance-btn"
                              onClick={() => startPerformance(index)}
                              disabled={!perfTracks[index] || currentPerformance !== null || !bgPlaying || isFading}
                              title={!bgPlaying ? 'Start BGM first' : (performanceStatus[index] ? 'Replay performance' : 'Start performance')}
                              aria-label={`${performanceStatus[index] ? 'Replay' : 'Start'} performance ${index + 1}`}
                            >
                              <Play size={18} />
                              <span>{performanceStatus[index] ? 'Replay performance' : 'Start performance'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  <audio
                    ref={el => perfAudioRefs.current[index] = el}
                    src={perfTracks[index] || undefined}
                    preload="metadata"
                    onEnded={() => handlePerformanceEnd(index)}
                    onLoadedMetadata={() => handleLoadedMetadata(index)}
                  />
                </div>
              ))}
            </div>
            </section>
          </main>
          {!runDeck && (
            <footer className="setup-footer">
              <div>
                <strong>Show setup</strong>
                <span>Changes save on this device. Reset only when preparing a different show.</span>
              </div>
              <button
                type="button"
                className="reset-all-btn"
                onClick={openResetConfirmation}
                disabled={bgPlaylist.length === 0 && assignedCount === 0 && completedCount === 0}
                title="Clear this show setup"
              >
                <RotateCcw size={18} />
                <span>Reset show</span>
              </button>
            </footer>
          )}
        </>
      )}
    </div>
  );
}

export default App;
