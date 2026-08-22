import React, { useState, useEffect, useRef, useLayoutEffect, useId } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronDown,
  FolderOpen,
  Headphones,
  Pause,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
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
import {
  insertPlaylistItem,
  movePlaylistItem,
  previousPlaylistAction,
  removePlaylistItem,
} from './audio/playlist';
import { processAudioFiles } from './audio/importAudio';
import { CLICKLESS_MUTE_SECONDS, scheduleGainEnvelope } from './audio/gainEnvelope';
import { getPopoverPosition, nextOptionIndex } from './ui/combobox';
import AudioVisualizer from './components/AudioVisualizer';
import AudioLibraryPanel from './components/AudioLibraryPanel';
import BgmQueue from './components/BgmQueue';
import BgmTransport from './components/BgmTransport';
import LiveSetupDock from './components/LiveSetupDock';
import './App.css';

// Searchable Select Component
function SearchableSelect({ value, onChange, options = [], placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 320, placement: 'bottom' });
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const listboxId = useId();

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
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Keep the popover attached to its trigger and inside the viewport.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(getPopoverPosition({
        rect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }));
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const focusFrame = window.requestAnimationFrame(() => searchRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = filteredOptions.findIndex(option => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : (filteredOptions.length ? 0 : -1));
  }, [isOpen, searchTerm, value, filteredOptions.length]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const openSelect = () => {
    if (!disabled) setIsOpen(true);
  };

  const handleTriggerKeyDown = event => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key) || disabled) return;
    event.preventDefault();
    openSelect();
  };

  const handleSearchKeyDown = event => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setActiveIndex(index => nextOptionIndex(index, event.key, filteredOptions.length));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(filteredOptions[activeIndex].value);
    }
  };

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: position.placement === 'top' ? 4 : -4, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: position.placement === 'top' ? 4 : -4, scale: 0.985 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="select-dropdown"
          data-placement={position.placement}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
            '--menu-max-height': `${position.maxHeight}px`,
          }}
        >
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search tracks…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              ref={searchRef}
              aria-label="Search audio tracks"
              aria-controls={listboxId}
              aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
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
          <div id={listboxId} className="select-options" role="listbox" aria-label="Audio tracks">
            {filteredOptions.length === 0 ? (
              <div className="no-results">No tracks found</div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  id={`${listboxId}-${index}`}
                  type="button"
                  className={`select-option ${option.value === value ? 'selected' : ''} ${index === activeIndex ? 'active' : ''}`}
                  onClick={() => handleSelect(option.value)}
                  onPointerEnter={() => setActiveIndex(index)}
                  role="option"
                  aria-selected={option.value === value}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Check size={16} aria-hidden="true" />}
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
          onKeyDown={handleTriggerKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          title={selectedOption ? selectedOption.label : placeholder}
        >
          <span className="select-value">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown size={16} className="select-icon" />
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

function SakuraSoundscape({ active }) {
  return (
    <div className={`sound-sakura-layer ${active ? 'is-active' : ''}`} aria-hidden="true">
      {Array.from({ length: 24 }, (_, index) => (
        <i
          className="sound-sakura-petal"
          key={index}
          style={{
            '--petal-x': `${3 + ((index * 37) % 94)}%`,
            '--petal-delay': `${-((index * 0.83) % 9.4)}s`,
            '--petal-duration': `${7.6 + ((index * 11) % 37) / 10}s`,
            '--petal-drift': `${-34 + ((index * 29) % 78)}px`,
            '--petal-scale': `${0.62 + ((index * 17) % 52) / 100}`,
          }}
        />
      ))}
    </div>
  );
}

// No audio ships with the app — staff import their own licensed tracks
// via the Import Audio button (persisted in IndexedDB).
const DEFAULT_AUDIO_FILES = [];
const DEFAULT_MASTER_VOLUME = 0.82;
const MASTER_LEVEL_KEY = 'dreamlive-master-level-v1';
const displayTrackName = (name) => name.replace(/\.(mp3|m4a|aac|wav|ogg|flac)$/i, '');

function App() {
  const [audioFiles, setAudioFiles] = useState([]);
  const [customFolder, setCustomFolder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [importState, setImportState] = useState({ active: false, completed: 0, total: 0 });

  // Background music state
  const [bgPlaylist, setBgPlaylist] = useState([]);
  const [bgIndex, setBgIndex] = useState(0);
  const [repeatPlaylist, setRepeatPlaylist] = useState(true);
  const [bgPlaying, setBgPlaying] = useState(false);
  const [bgVolume, setBgVolume] = useState(0.5);
  const [bgProgress, setBgProgress] = useState(0);
  const [bgDuration, setBgDuration] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
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
  const analyserNodeRef = useRef(null);

  // Web Audio for Performance Tracks
  const perfGainNodeRefs = useRef([null, null, null, null]);
  const perfSourceNodeRefs = useRef([null, null, null, null]);

  // Fade + notice bookkeeping
  const fadeTimeoutRef = useRef(null);
  const fadeResolverRef = useRef(null);
  const transitionLockRef = useRef(false);
  const seekTimeoutRefs = useRef({ bg: null, perf: [null, null, null, null] });
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

  const pauseClicklessly = async (audio, gainNode) => {
    if (!audio || audio.paused) return;
    const context = audioContextRef.current;
    if (!gainNode || !context) {
      audio.pause();
      return;
    }
    const waitMs = scheduleGainEnvelope(gainNode.gain, {
      currentTime: context.currentTime,
      target: 0,
      duration: CLICKLESS_MUTE_SECONDS,
    });
    await new Promise(resolve => window.setTimeout(resolve, waitMs + 8));
    audio.pause();
  };

  const seekClicklessly = ({ audio, gainNode, value, restoreTo, timeoutKey, index = null }) => {
    if (!audio) return;
    const context = audioContextRef.current;
    const setPlayhead = () => {
      audio.currentTime = value;
      if (!audio.paused && gainNode) fadeGainTo(gainNode, restoreTo, 0.06);
    };
    if (audio.paused || !gainNode || !context) {
      setPlayhead();
      return;
    }
    scheduleGainEnvelope(gainNode.gain, {
      currentTime: context.currentTime,
      target: 0,
      duration: CLICKLESS_MUTE_SECONDS,
    });
    const timers = seekTimeoutRefs.current;
    if (timeoutKey === 'bg') {
      if (timers.bg) window.clearTimeout(timers.bg);
      timers.bg = window.setTimeout(setPlayhead, (CLICKLESS_MUTE_SECONDS * 1000) + 8);
    } else {
      if (timers.perf[index]) window.clearTimeout(timers.perf[index]);
      timers.perf[index] = window.setTimeout(setPlayhead, (CLICKLESS_MUTE_SECONDS * 1000) + 8);
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
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      analyser.minDecibels = -82;
      analyser.maxDecibels = -12;
      compressor.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);
      masterCompressorRef.current = compressor;
      masterGainNodeRef.current = masterGain;
      analyserNodeRef.current = analyser;

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
    if (!soundCheckOpen && !resetConfirmOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [soundCheckOpen, resetConfirmOpen]);

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
    if (importState.active) return;
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
        input.accept = 'audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac';

        input.onchange = async (e) => {
          const files = Array.from(e.target.files);
          if (files.length === 0) return;
          setImportState({ active: true, completed: 0, total: files.length });
          try {
            const { accepted, rejected } = await processAudioFiles(files, {
              onProgress: ({ completed, total }) => {
                setImportState({ active: true, completed, total });
              },
            });
            if (accepted.length === 0) {
              showNotice("These files couldn't be opened on this device. Try MP3, AAC, M4A, or WAV.", 'error');
              return;
            }

            const known = new Set(audioFiles.map(file => file.id));
            const additions = accepted.filter(file => !known.has(file.id));
            const merged = [...audioFiles, ...additions]
              .sort((a, b) => a.name.localeCompare(b.name));
            accepted.filter(file => known.has(file.id)).forEach(file => URL.revokeObjectURL(file.path));

            if (additions.length === 0) {
              showNotice('Those tracks are already in your library.');
              return;
            }

            setAudioFiles(merged);
            setCustomFolder(`${merged.length} track${merged.length === 1 ? '' : 's'} ready`);
            const rejectedCopy = rejected.length > 0
              ? ` ${rejected.length} couldn't be opened.`
              : '';
            showNotice(`Added ${additions.length} track${additions.length === 1 ? '' : 's'}.${rejectedCopy}`);

            // Save to IndexedDB for persistence
            await saveFilesToIndexedDB(merged);
          } catch (error) {
            console.error('Audio import failed:', error);
            showNotice("Audio import stopped unexpectedly. Try the files again.", 'error');
          } finally {
            setImportState(previous => ({ ...previous, active: false }));
          }
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

  const trackName = (path) => {
    const name = audioFiles.find(file => file.path === path)?.name;
    return name ? displayTrackName(name) : 'Unknown track';
  };

  const addBackgroundTrack = (path, mode = 'end') => {
    const result = insertPlaylistItem({
      playlist: bgPlaylist,
      item: path,
      mode,
      currentIndex: bgIndex,
    });
    if (!result.changed) {
      if (path) showNotice('That track is already in the BGM queue.');
      return;
    }
    setBgPlaylist(result.playlist);
    setBgIndex(result.currentIndex);
    showNotice(mode === 'next' ? 'Track added next.' : 'Track added to the BGM queue.');
  };

  const removeBackgroundTrack = (index) => {
    const result = removePlaylistItem({
      playlist: bgPlaylist,
      index,
      currentIndex: bgIndex,
      lockedIndex: currentPerformance !== null ? bgIndex : null,
    });
    if (!result.changed) return;
    setBgPlaylist(result.playlist);
    setBgIndex(result.currentIndex);
    if (result.playlist.length === 0) {
      if (bgAudioRef.current) bgAudioRef.current.pause();
      setBgPlaying(false);
      setBgProgress(0);
      setBgDuration(0);
    }
  };

  const moveBackgroundTrack = (fromIndex, toIndex) => {
    const result = movePlaylistItem({
      playlist: bgPlaylist,
      fromIndex,
      toIndex,
      currentIndex: bgIndex,
      lockedIndex: currentPerformance !== null ? bgIndex : null,
    });
    if (!result.changed) return;
    setBgPlaylist(result.playlist);
    setBgIndex(result.currentIndex);
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
    if (currentPerformance !== null) return;
    if (!soundCheckComplete && !bgPlaying) {
      setSoundCheckOpen(true);
      showNotice('Complete the sound check before starting BGM.', 'error');
      return;
    }

    if (bgPlaying) {
      await pauseClicklessly(bgAudioRef.current, bgGainNodeRef.current);
      setBgPlaying(false);
      return;
    }

    await playBackgroundAudio();
  };

  const advanceBackground = async (event) => {
    if (currentPerformance !== null || bgPlaylist.length === 0) return;
    const next = nextPlaylistIndex({
      currentIndex: bgIndex,
      length: bgPlaylist.length,
      repeat: repeatPlaylist,
    });
    if (next === null) {
      if (event?.type !== 'ended') {
        await pauseClicklessly(bgAudioRef.current, bgGainNodeRef.current);
      }
      setBgPlaying(false);
      return;
    }

    if (event?.type === 'ended') {
      muteGain(bgGainNodeRef.current);
    } else {
      await pauseClicklessly(bgAudioRef.current, bgGainNodeRef.current);
    }
    if (next === bgIndex) {
      bgAudioRef.current.currentTime = 0;
      await playBackgroundAudio();
    } else {
      setBgIndex(next);
    }
  };

  const previousBackground = async () => {
    if (currentPerformance !== null || bgPlaylist.length === 0 || !bgAudioRef.current) return;
    const action = previousPlaylistAction({
      currentIndex: bgIndex,
      length: bgPlaylist.length,
      currentTime: bgAudioRef.current.currentTime,
    });
    if (action.index === null) return;
    if (action.restart || action.index === bgIndex) {
      bgAudioRef.current.currentTime = 0;
      setBgProgress(0);
      return;
    }
    await pauseClicklessly(bgAudioRef.current, bgGainNodeRef.current);
    setBgIndex(action.index);
  };

  const playBackgroundFrom = async (index) => {
    if (currentPerformance !== null || isFading || !bgPlaylist[index]) return;
    if (!soundCheckComplete) {
      setSoundCheckOpen(true);
      showNotice('Complete the sound check before starting BGM.', 'error');
      return;
    }
    if (index === bgIndex) {
      if (bgAudioRef.current) {
        bgAudioRef.current.currentTime = 0;
        setBgProgress(0);
      }
      await playBackgroundAudio();
      return;
    }
    await pauseClicklessly(bgAudioRef.current, bgGainNodeRef.current);
    setBgPlaying(true);
    setBgIndex(index);
  };

  const handleBgSeek = value => {
    const time = Number.parseFloat(value);
    if (!bgAudioRef.current || !Number.isFinite(time)) return;
    seekClicklessly({
      audio: bgAudioRef.current,
      gainNode: bgGainNodeRef.current,
      value: time,
      restoreTo: bgVolume,
      timeoutKey: 'bg',
    });
    setBgProgress(time);
  };

  useEffect(() => {
    setBgProgress(0);
    setBgDuration(0);
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
    if (!soundCheckComplete) {
      setSoundCheckOpen(true);
      showNotice('Complete the sound check before starting a performance.', 'error');
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
      await pauseClicklessly(audio, perfGainNodeRefs.current[index]);
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
      const time = parseFloat(value);
      seekClicklessly({
        audio,
        gainNode: perfGainNodeRefs.current[index],
        value: time,
        restoreTo: perfVolumes[index],
        timeoutKey: 'perf',
        index,
      });
      setPerfProgress(previous => previous.map((progress, trackIndex) => (
        trackIndex === index ? time : progress
      )));
    }
  };

  const stopAllAudio = async (announce = true) => {
    transitionLockRef.current = false;
    cancelFade();
    setIsFading(false);
    setBgPlaying(false);
    setPerfPlaying([false, false, false, false]);
    setCurrentPerformance(null);
    setShowError('');
    setShowPhase(SHOW_PHASE.SETUP);
    await Promise.all([
      pauseClicklessly(bgAudioRef.current, bgGainNodeRef.current),
      ...perfAudioRefs.current.map((audio, index) => (
        pauseClicklessly(audio, perfGainNodeRefs.current[index])
      )),
    ]);
    if (announce) showNotice('All audio stopped. Your show setup is preserved.');
  };

  // Reset all
  const resetAll = async () => {
    await stopAllAudio(false);
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
      ? (bgPlaying
        ? `Lowering BGM → Performance ${currentPerformance + 1}`
        : `Starting Performance ${currentPerformance + 1}`) : '')
    || (visiblePhase === SHOW_PHASE.LIVE ? currentPerformanceName : '')
    || (visiblePhase === SHOW_PHASE.PAUSED ? `${currentPerformanceName} · Tap Resume when ready` : '')
    || (visiblePhase === SHOW_PHASE.RESTORING ? `Returning to ${trackName(bgTrack)}` : '')
    || (!soundCheckComplete ? 'Set device volume, test the room, then confirm output' : '')
    || (audioFiles.length === 0 ? 'Import audio, then assign the first performance' : '')
    || (assignedCount === 0 ? 'Assign the next performance track' : '')
    || `${assignedCount} performance${assignedCount === 1 ? '' : 's'} ready${bgPlaying ? ' · BGM playing' : (bgTrack ? ' · BGM ready' : '')}`;

  return (
    <div className="App">
      <SakuraSoundscape active={bgPlaying || perfPlaying.some(Boolean) || isFading || isCheckingSound} />
      {notice && (
        <div className={`app-toast ${notice.tone}`} role="status" aria-live="polite">
          {notice.message}
        </div>
      )}

      <header className={`app-header ${runDeck ? 'run-deck' : ''} ${(bgPlaying || currentPerformance !== null || isFading) ? 'audio-active' : ''}`}>
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
            <button
              className="folder-btn"
              onClick={handleSelectFolder}
              title="Add licensed tracks to this device"
              disabled={importState.active}
              aria-busy={importState.active}
            >
              <FolderOpen size={20} />
              <span>{importState.active
                ? `Checking ${importState.completed}/${importState.total}`
                : 'Import audio'}</span>
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
          <button
            className={`stop-audio-btn ${(bgPlaying || currentPerformance !== null || isFading) ? 'is-active' : ''}`}
            onClick={() => stopAllAudio()}
            title="Stop all audio"
          >
            <Square size={18} fill="currentColor" />
            <span>Stop audio</span>
          </button>
        </div>
      </header>

      {soundCheckOpen && (
        <div
          className="output-dialog-backdrop"
          onPointerDown={event => {
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
                <strong>Device baseline</strong>
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
                <strong>DreamLIVE output</strong>
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
                <span>Confirm clear sound</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {resetConfirmOpen && (
        <div
          className="output-dialog-backdrop reset-dialog-backdrop"
          onPointerDown={event => {
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
            <button type="button" onClick={() => setShowError('')}>Dismiss alert</button>
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
          <p>Loading your audio library…</p>
        </div>
      ) : (
        <>
          <LiveSetupDock
            visible={setupExpanded && currentPerformance !== null}
            analyserRef={analyserNodeRef}
            performanceNumber={currentPerformance === null ? '' : currentPerformance + 1}
            title={currentPerformanceName}
            status={isFading ? 'Starting' : (showPhase === SHOW_PHASE.PAUSED ? 'Paused' : 'Live')}
            playing={currentPerformance !== null && perfPlaying[currentPerformance]}
            elapsed={currentPerformance === null ? 0 : perfProgress[currentPerformance]}
            duration={currentPerformance === null ? 0 : perfDurations[currentPerformance]}
            formatTime={formatTime}
            onToggle={() => currentPerformance !== null && togglePerfPause(currentPerformance)}
            onReturn={() => setSetupExpanded(false)}
            onStop={() => stopAllAudio()}
          />
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
                    <span>Import licensed audio to build the show.</span>
                  </div>
                  <button type="button" onClick={handleSelectFolder} disabled={importState.active}>
                    {importState.active ? `Checking ${importState.completed}/${importState.total}` : 'Import audio'}
                  </button>
                </div>
              )}
              <div className="bg-music-container">
                <BgmTransport
                  analyserRef={analyserNodeRef}
                  currentTrack={bgTrack ? trackName(bgTrack) : ''}
                  nextTrack={nextBgTrack ? trackName(nextBgTrack) : ''}
                  status={isFading
                    ? 'Audio transitioning'
                    : (currentPerformance !== null ? 'BGM held' : (bgPlaying ? 'BGM playing' : 'BGM paused'))}
                  visualizerActive={(bgPlaying && currentPerformance === null) || isCheckingSound}
                  elapsed={bgProgress}
                  duration={bgDuration}
                  formatTime={formatTime}
                  playing={bgPlaying}
                  playbackLocked={currentPerformance !== null || isFading || (!soundCheckComplete && !bgPlaying)}
                  onPrevious={previousBackground}
                  onToggle={toggleBackgroundMusic}
                  onNext={advanceBackground}
                  onSeek={handleBgSeek}
                  repeat={repeatPlaylist}
                  onToggleRepeat={() => setRepeatPlaylist(previous => !previous)}
                  volume={bgVolume}
                  onVolumeChange={handleBgVolumeChange}
                  onOpenLibrary={() => setLibraryOpen(true)}
                  libraryCount={audioFiles.length}
                />

                <AudioLibraryPanel
                  open={libraryOpen}
                  files={audioFiles}
                  playlist={bgPlaylist}
                  displayName={displayTrackName}
                  onAdd={addBackgroundTrack}
                  onImport={handleSelectFolder}
                  onClose={() => setLibraryOpen(false)}
                />

                <BgmQueue
                  playlist={bgPlaylist}
                  currentIndex={bgIndex}
                  heldIndex={currentPerformance !== null ? bgIndex : null}
                  playbackLocked={currentPerformance !== null || isFading}
                  trackName={trackName}
                  onPlay={playBackgroundFrom}
                  onMove={moveBackgroundTrack}
                  onRemove={removeBackgroundTrack}
                />

                <audio
                  ref={bgAudioRef}
                  src={bgTrack || undefined}
                  preload="auto"
                  onTimeUpdate={event => setBgProgress(event.currentTarget.currentTime)}
                  onLoadedMetadata={event => {
                    setBgDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
                    setBgProgress(event.currentTarget.currentTime || 0);
                  }}
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
              <div className={`run-focus-panel mode-${deckState.mode} ${deckState.activePerformanceIndex === null && deckState.nextPerformanceIndex === null ? 'is-complete' : ''}`}>
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
                      <div className="run-focus-header-actions">
                        <span className={`run-live-badge ${showPhase === SHOW_PHASE.PAUSED ? 'paused' : ''}`}>
                          {isFading ? 'Starting' : (showPhase === SHOW_PHASE.PAUSED ? 'Paused' : 'Live')}
                        </span>
                        <button type="button" className="control-button secondary-button" onClick={() => setSetupExpanded(true)}>
                          <SlidersHorizontal size={18} /> Edit show setup
                        </button>
                      </div>
                    </div>
                    <AudioVisualizer
                      analyserRef={analyserNodeRef}
                      active={perfPlaying[focusPerformanceIndex] || isFading}
                      variant="focus"
                      status={isFading
                        ? 'Performance transitioning'
                        : (perfPlaying[focusPerformanceIndex] ? 'Performance live' : 'Performance paused')}
                    />
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
                    <AudioVisualizer
                      analyserRef={analyserNodeRef}
                      active={false}
                      variant="focus"
                      status="Performance ready"
                    />
                    <button
                      type="button"
                      className="run-primary-action"
                      onClick={() => startPerformance(deckState.nextPerformanceIndex)}
                      disabled={!soundCheckComplete || isFading}
                    >
                      <Play size={26} />
                      <span className="run-action-label">
                        <span>Start performance {deckState.nextPerformanceIndex + 1}</span>
                        <small>パフォーマンスを開始</small>
                      </span>
                    </button>
                    <p className="run-safety-note">
                      {bgPlaying
                        ? 'BGM lowers first, then returns automatically when the performance ends.'
                        : 'Starts directly. Queued BGM begins automatically when the performance ends.'}
                    </p>
                  </>
                ) : (
                  <div className="run-complete-state">
                    <Check size={28} />
                    <div>
                      <span className="run-focus-kicker">Show complete ・ 公演完了</span>
                      <h2>All assigned performances are done</h2>
                      <p>{bgTrack ? 'BGM continues. Edit setup if another cue is needed.' : 'Edit setup to add another cue.'}</p>
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
                        label: displayTrackName(file.name)
                      }))}
                      placeholder="Assign track"
                      disabled={currentPerformance === index}
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
                              disabled={!perfTracks[index] || currentPerformance !== null || !soundCheckComplete || isFading}
                              title={!soundCheckComplete
                                ? 'Complete the sound check first'
                                : (performanceStatus[index] ? 'Replay performance' : 'Start performance')}
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
