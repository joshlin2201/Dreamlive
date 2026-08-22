import React, { useState, useEffect, useRef, useLayoutEffect, useId } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronDown,
  FolderOpen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
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
import {
  insertPlaylistItem,
  movePlaylistItem,
  removePlaylistItem,
  shufflePlaylist,
} from './audio/playlist';
import { processAudioFiles } from './audio/importAudio';
import { CLICKLESS_MUTE_SECONDS, scheduleGainEnvelope } from './audio/gainEnvelope';
import {
  audioIdFromRef,
  isManagedAudioRef,
  reconcileLibraryRemoval,
  toLibraryMetadata,
} from './audio/libraryStorage';
import { getPopoverPosition, nextOptionIndex } from './ui/combobox';
import AudioVisualizer from './components/AudioVisualizer';
import AudioLibraryPanel from './components/AudioLibraryPanel';
import BgmQueue from './components/BgmQueue';
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
    if (event.key === 'Tab') {
      setIsOpen(false);
      setSearchTerm('');
      return;
    }
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
      {Array.from({ length: 36 }, (_, index) => (
        <i
          className="sound-sakura-petal"
          key={index}
          style={{
            '--petal-x': `${3 + ((index * 37) % 94)}%`,
            '--petal-delay': `${-((index * 0.83) % 9.4)}s`,
            '--petal-duration': `${7.2 + ((index * 11) % 42) / 10}s`,
            '--petal-drift': `${-54 + ((index * 29) % 118)}px`,
            '--petal-scale': `${0.72 + ((index * 17) % 62) / 100}`,
          }}
        />
      ))}
    </div>
  );
}

// No audio ships with the app — staff import their own licensed tracks
// via the Import Audio button (persisted in IndexedDB).
const DEFAULT_AUDIO_FILES = [];
const DEFAULT_PERFORMANCE_COUNT = 4;
const performanceArray = (value, count = DEFAULT_PERFORMANCE_COUNT) => Array.from({ length: count }, () => value);
const displayTrackName = (name) => name.replace(/\.(mp3|m4a|aac|wav|ogg|flac)$/i, '');

function App() {
  const [audioFiles, setAudioFiles] = useState([]);
  const audioFilesRef = useRef([]);
  const [customFolder, setCustomFolder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [importState, setImportState] = useState({ active: false, completed: 0, total: 0 });

  // Background music state
  const [bgPlaylist, setBgPlaylist] = useState([]);
  const [bgIndex, setBgIndex] = useState(0);
  const [repeatPlaylist, setRepeatPlaylist] = useState(true);
  const [bgPlaying, setBgPlaying] = useState(false);
  const [bgVolume, setBgVolume] = useState(0.5);
  const [pendingBgTrack, setPendingBgTrack] = useState('');
  const pendingBgTrackRef = useRef('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const bgAudioRef = useRef(null);
  const bgTrack = bgPlaylist[bgIndex] || '';

  // Performance tracks state
  const [perfTracks, setPerfTracks] = useState(() => performanceArray(''));
  const [perfPlaying, setPerfPlaying] = useState(() => performanceArray(false));
  const [perfVolumes, setPerfVolumes] = useState(() => performanceArray(0.8));
  const [perfProgress, setPerfProgress] = useState(() => performanceArray(0));
  const [perfDurations, setPerfDurations] = useState(() => performanceArray(0));
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [performanceStatus, setPerformanceStatus] = useState(() => performanceArray(false));
  const perfAudioRefs = useRef(performanceArray(null));
  const [showPhase, setShowPhase] = useState(SHOW_PHASE.SETUP);
  const [showError, setShowError] = useState('');

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [libraryRemoval, setLibraryRemoval] = useState(null);
  const resetDialogRef = useRef(null);
  const resetCancelRef = useRef(null);
  const resetReturnFocusRef = useRef(null);
  const libraryCancelRef = useRef(null);
  const libraryReturnFocusRef = useRef(null);

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
  const perfGainNodeRefs = useRef(performanceArray(null));
  const perfSourceNodeRefs = useRef(performanceArray(null));
  const [managedSources, setManagedSources] = useState({});
  const managedSourceUrlsRef = useRef(new Map());
  const sourceLoadGenerationRef = useRef(0);

  // Fade + notice bookkeeping
  const fadeTimeoutRef = useRef(null);
  const fadeResolverRef = useRef(null);
  const transitionLockRef = useRef(false);
  const seekTimeoutRefs = useRef({ bg: null, perf: performanceArray(null) });
  const settingsHydratedRef = useRef(false);
  const playbackStateRef = useRef({ bgPlaying: false, currentPerformance: null, perfPlaying: [] });
  const [notice, setNotice] = useState(null);
  const noticeTimeoutRef = useRef(null);

  const showNotice = (message, tone = 'info') => {
    setNotice({ message, tone });
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => setNotice(null), 3500);
  };

  const openResetConfirmation = () => {
    resetReturnFocusRef.current = document.activeElement;
    setResetConfirmOpen(true);
  };

  const closeResetConfirmation = () => {
    setResetConfirmOpen(false);
    window.requestAnimationFrame(() => resetReturnFocusRef.current?.focus());
  };

  const requestLibraryRemoval = (paths) => {
    libraryReturnFocusRef.current = document.activeElement;
    setLibraryRemoval({ paths });
  };

  const closeLibraryRemoval = () => {
    setLibraryRemoval(null);
    window.requestAnimationFrame(() => libraryReturnFocusRef.current?.focus());
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

  const ensurePerformanceGain = (index) => {
    if (perfGainNodeRefs.current[index]) return perfGainNodeRefs.current[index];
    const ctx = audioContextRef.current;
    const compressor = masterCompressorRef.current;
    if (!ctx || !compressor) return null;
    const gain = ctx.createGain();
    gain.connect(compressor);
    perfGainNodeRefs.current[index] = gain;
    return gain;
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
      masterGain.gain.value = 1;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.16;
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
      perfGainNodeRefs.current = perfTracks.map(() => {
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
    if (!libraryRemoval) return undefined;
    const focusTimer = window.requestAnimationFrame(() => libraryCancelRef.current?.focus());
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLibraryRemoval();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [libraryRemoval]);

  useEffect(() => {
    if (!resetConfirmOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [resetConfirmOpen]);

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
        const performanceCount = Math.max(DEFAULT_PERFORMANCE_COUNT, saved.performanceIds?.length || 0);
        const restoredPerformances = Array.from({ length: performanceCount }, (_, index) => pathForKey(saved.performanceIds?.[index]));
        setBgPlaylist(restoredPlaylist);
        setBgIndex(Math.min(saved.bgIndex || 0, Math.max(restoredPlaylist.length - 1, 0)));
        setRepeatPlaylist(saved.repeatPlaylist !== false);
        setPerfTracks(restoredPerformances);
        setPerfPlaying(performanceArray(false, performanceCount));
        setPerfProgress(performanceArray(0, performanceCount));
        setPerfDurations(performanceArray(0, performanceCount));
        setPerformanceStatus(performanceArray(false, performanceCount));
        perfAudioRefs.current = performanceArray(null, performanceCount);
        perfGainNodeRefs.current = performanceArray(null, performanceCount);
        perfSourceNodeRefs.current = performanceArray(null, performanceCount);
        seekTimeoutRefs.current.perf = performanceArray(null, performanceCount);
        if (Number.isFinite(saved.bgVolume)) setBgVolume(saved.bgVolume);
        setPerfVolumes(Array.from({ length: performanceCount }, (_, index) => (
          Number.isFinite(saved.perfVolumes?.[index]) ? saved.perfVolumes[index] : 0.8
        )));
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

  const handleSelectFolder = async ({ autoQueue = false } = {}) => {
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

            const known = new Map(audioFiles.map(file => [file.id, file]));
            const importedAdditions = accepted.filter(file => !known.has(file.id));
            const persisted = await saveFilesToIndexedDB(importedAdditions);
            const additions = importedAdditions.map(file => {
              if (persisted) return toLibraryMetadata(file);
              const { fileData, ...sessionMetadata } = file;
              return sessionMetadata;
            });
            const additionsById = new Map(additions.map(file => [file.id, file]));
            const merged = [...audioFiles, ...additions]
              .sort((a, b) => a.name.localeCompare(b.name));
            accepted.forEach(file => {
              if (known.has(file.id) || persisted) URL.revokeObjectURL(file.path);
            });
            const queueAdditions = autoQueue
              ? accepted
                .map(file => known.get(file.id)?.path || additionsById.get(file.id)?.path)
                .filter(path => path && !bgPlaylist.includes(path))
              : [];

            if (additions.length === 0 && queueAdditions.length === 0) {
              showNotice('Those tracks are already in your library.');
              return;
            }

            if (additions.length > 0) {
              setAudioFiles(merged);
              setCustomFolder(`${merged.length} track${merged.length === 1 ? '' : 's'} ready`);
            }
            if (queueAdditions.length > 0) {
              setBgPlaylist(previous => [...previous, ...queueAdditions.filter(path => !previous.includes(path))]);
              setLibraryOpen(false);
            }
            const rejectedCopy = rejected.length > 0
              ? ` ${rejected.length} couldn't be opened.`
              : '';
            const addedCount = autoQueue ? queueAdditions.length : additions.length;
            showNotice(`${autoQueue ? 'Added' : 'Imported'} ${addedCount} track${addedCount === 1 ? '' : 's'}${autoQueue ? ' to the BGM queue' : ''}.${rejectedCopy}`);

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
      const request = indexedDB.open('DreamlandAudioDB', 2);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;
        const metadataStore = db.objectStoreNames.contains('audioMetadata')
          ? transaction.objectStore('audioMetadata')
          : db.createObjectStore('audioMetadata', { keyPath: 'id' });
        const blobStore = db.objectStoreNames.contains('audioBlobs')
          ? transaction.objectStore('audioBlobs')
          : db.createObjectStore('audioBlobs', { keyPath: 'id' });

        // Migrate the original all-in-one records without ever reading the
        // entire library into the renderer at once.
        if (db.objectStoreNames.contains('audioFiles')) {
          const cursorRequest = transaction.objectStore('audioFiles').openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const legacyFile = cursor.value;
            metadataStore.put(toLibraryMetadata(legacyFile));
            if (legacyFile.fileData) {
              blobStore.put({ id: legacyFile.id, fileData: legacyFile.fileData });
            }
            cursor.continue();
          };
        }
      };
    });
  };

  const saveFilesToIndexedDB = async (files) => {
    if (files.length === 0) return true;
    let db;
    try {
      db = await openDB();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(['audioMetadata', 'audioBlobs'], 'readwrite');
        const metadataStore = transaction.objectStore('audioMetadata');
        const blobStore = transaction.objectStore('audioBlobs');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Audio save was interrupted.'));
        files.forEach(file => {
          metadataStore.put(toLibraryMetadata(file));
          if (file.fileData) blobStore.put({ id: file.id, fileData: file.fileData });
        });
      });
      return true;
    } catch (error) {
      console.error('Error saving to IndexedDB:', error);
      showNotice('Tracks are loaded, but this iPad could not save them for next time.', 'error');
      return false;
    } finally {
      db?.close();
    }
  };

  const loadFilesFromIndexedDB = async () => {
    let db;
    try {
      db = await openDB();
      const transaction = db.transaction(['audioMetadata'], 'readonly');
      const store = transaction.objectStore('audioMetadata');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result.map(toLibraryMetadata));
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db?.close();
      });
    } catch (error) {
      db?.close();
      console.error('Error loading from IndexedDB:', error);
      return [];
    }
  };

  const loadTrackBlobFromIndexedDB = async (trackRef) => {
    const id = audioIdFromRef(trackRef);
    if (!id) return null;
    const db = await openDB();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(['audioBlobs'], 'readonly');
        const request = transaction.objectStore('audioBlobs').get(id);
        request.onsuccess = () => resolve(request.result?.fileData || null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  };

  const deleteTracksFromIndexedDB = async (trackRefs) => {
    const ids = trackRefs.map(audioIdFromRef).filter(Boolean);
    if (ids.length === 0) return;
    const db = await openDB();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(['audioMetadata', 'audioBlobs'], 'readwrite');
        const metadataStore = transaction.objectStore('audioMetadata');
        const blobStore = transaction.objectStore('audioBlobs');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Audio removal was interrupted.'));
        ids.forEach(id => {
          metadataStore.delete(id);
          blobStore.delete(id);
        });
      });
    } finally {
      db.close();
    }
  };

  useEffect(() => {
    audioFilesRef.current = audioFiles;
  }, [audioFiles]);

  useEffect(() => {
    const generation = sourceLoadGenerationRef.current + 1;
    sourceLoadGenerationRef.current = generation;
    const needed = new Set([bgTrack, ...perfTracks].filter(isManagedAudioRef));
    let changed = false;

    managedSourceUrlsRef.current.forEach((url, trackRef) => {
      if (needed.has(trackRef)) return;
      URL.revokeObjectURL(url);
      managedSourceUrlsRef.current.delete(trackRef);
      changed = true;
    });
    if (changed) setManagedSources(Object.fromEntries(managedSourceUrlsRef.current));

    needed.forEach(async trackRef => {
      if (managedSourceUrlsRef.current.has(trackRef)) return;
      try {
        const blob = await loadTrackBlobFromIndexedDB(trackRef);
        if (!blob || sourceLoadGenerationRef.current !== generation) return;
        const url = URL.createObjectURL(blob);
        managedSourceUrlsRef.current.set(trackRef, url);
        setManagedSources(Object.fromEntries(managedSourceUrlsRef.current));
      } catch (error) {
        console.error('Stored audio could not be loaded:', error);
      }
    });

    return () => {
      if (sourceLoadGenerationRef.current === generation) {
        sourceLoadGenerationRef.current += 1;
      }
    };
  }, [bgTrack, perfTracks]);

  useEffect(() => () => {
    sourceLoadGenerationRef.current += 1;
    if (noticeTimeoutRef.current) window.clearTimeout(noticeTimeoutRef.current);
    if (fadeTimeoutRef.current) window.clearTimeout(fadeTimeoutRef.current);
    if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
    if (seekTimeoutRefs.current.bg) window.clearTimeout(seekTimeoutRefs.current.bg);
    seekTimeoutRefs.current.perf.forEach(timer => timer && window.clearTimeout(timer));

    bgAudioRef.current?.pause();
    perfAudioRefs.current.forEach(audio => audio?.pause());
    managedSourceUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    managedSourceUrlsRef.current.clear();
    audioFilesRef.current.forEach(file => {
      if (file.path?.startsWith('blob:')) URL.revokeObjectURL(file.path);
    });

    bgSourceNodeRef.current?.disconnect();
    perfSourceNodeRefs.current.forEach(source => source?.disconnect());
    bgGainNodeRef.current?.disconnect();
    perfGainNodeRefs.current.forEach(gain => gain?.disconnect());
    masterCompressorRef.current?.disconnect();
    masterGainNodeRef.current?.disconnect();
    analyserNodeRef.current?.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  const trackSource = trackRef => (
    isManagedAudioRef(trackRef) ? (managedSources[trackRef] || '') : trackRef
  );
  const bgTrackSource = trackSource(bgTrack);

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

  const shuffleBackgroundTracks = () => {
    const result = shufflePlaylist({ playlist: bgPlaylist, currentIndex: bgIndex });
    if (!result.changed) return;
    setBgPlaylist(result.playlist);
    setBgIndex(result.currentIndex);
    showNotice('Upcoming BGM tracks shuffled.');
  };

  const playBackgroundAudio = async () => {
    const audio = bgAudioRef.current;
    if (!bgTrack || !bgTrackSource || !audio || currentPerformance !== null) return false;

    const ready = await ensureAudioReady();
    if (!ready) {
      setShowError('DreamLIVE audio is paused by the device. Tap Play again.');
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
      setShowError(`${trackName(bgTrack)} couldn’t start. Tap Play again or choose another track.`);
      setShowPhase(SHOW_PHASE.ERROR);
    }
    return ok;
  };

  // Background playlist controls
  const toggleBackgroundMusic = async () => {
    if (!bgTrack || !bgAudioRef.current || isFading) return;
    if (currentPerformance !== null) return;
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

  const playBackgroundFrom = async (index) => {
    if (currentPerformance !== null || isFading || !bgPlaylist[index]) return;
    pendingBgTrackRef.current = '';
    setPendingBgTrack('');
    if (index === bgIndex) {
      if (bgAudioRef.current) {
        bgAudioRef.current.currentTime = 0;
      }
      await playBackgroundAudio();
      return;
    }
    await pauseClicklessly(bgAudioRef.current, bgGainNodeRef.current);
    setBgPlaying(true);
    setBgIndex(index);
  };

  const queueBackgroundForReturn = index => {
    const track = bgPlaylist[index];
    if (!track || currentPerformance === null) return;
    pendingBgTrackRef.current = track;
    setPendingBgTrack(track);
    showNotice(`${trackName(track)} will play after this performance.`);
  };

  useEffect(() => {
    if (!bgPlaying || currentPerformance !== null || !bgTrack || !bgTrackSource) return;
    if (bgAudioRef.current) {
      bgAudioRef.current.load();
      playBackgroundAudio();
    }
  }, [bgTrack, bgTrackSource]);

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
    const pendingIndex = bgPlaylist.indexOf(pendingBgTrackRef.current);
    if (pendingIndex >= 0 && pendingIndex !== bgIndex) {
      pendingBgTrackRef.current = '';
      setPendingBgTrack('');
      setBgPlaying(true);
      setBgIndex(pendingIndex);
      setIsFading(false);
      return;
    }
    pendingBgTrackRef.current = '';
    setPendingBgTrack('');
    const audio = bgAudioRef.current;
    const ready = await ensureAudioReady();
    if (!ready) throw new Error('DreamLIVE audio couldn’t resume. Tap Play in BGM again.');

    if (bgGainNodeRef.current && audioContextRef.current) {
      const g = bgGainNodeRef.current.gain;
      const ctx = audioContextRef.current;
      audio.volume = 1;
      muteGain(bgGainNodeRef.current);
      const ok = await playSafely(audio, 'background music');
      if (!ok) throw new Error('BGM couldn’t resume. Tap Play in the BGM controls.');
      setBgPlaying(true);
      g.exponentialRampToValueAtTime(Math.max(bgVolume, 0.0002), ctx.currentTime + BGM_FADE_SECONDS);
      const completed = await waitForFade((BGM_FADE_SECONDS * 1000) + 50);
      if (!completed) throw new Error('Transition cancelled.');
    } else {
      audio.volume = bgVolume;
      const ok = await playSafely(audio, 'background music');
      if (!ok) throw new Error('BGM couldn’t resume. Tap Play in the BGM controls.');
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
        source.connect(ensurePerformanceGain(index));
        perfSourceNodeRefs.current[index] = source;
      } catch (error) {
        console.warn('Performance audio connection failed:', error);
      }
    }

    const perfGain = ensurePerformanceGain(index);
    const target = perfVolumes[index];
    audio.currentTime = 0;
    audio.volume = perfGain ? 1 : target;
    muteGain(perfGain);
    const ready = await ensureAudioReady();
    if (!ready) throw new Error('DreamLIVE audio couldn’t start. Tap Start again.');
    const ok = await playSafely(audio, `Performance ${index + 1}`);
    if (!ok) throw new Error(`Performance ${index + 1} couldn’t start. Check the track, then try again.`);

    fadeGainTo(perfGain, target, START_FADE);
    setPerfPlaying(previous => previous.map((playing, trackIndex) => (
      trackIndex === index ? true : playing
    )));
  };

  // Start performance through one ordered, test-covered show flow.
  const startPerformance = async (index) => {
    if (!trackSource(perfTracks[index]) || currentPerformance !== null || isFading || transitionLockRef.current) return;
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
    const perfGain = ensurePerformanceGain(index);
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

  const endPerformance = async (index) => {
    if (currentPerformance !== index || transitionLockRef.current) return;
    transitionLockRef.current = true;
    try {
      await pauseClicklessly(perfAudioRefs.current[index], perfGainNodeRefs.current[index]);
      setPerfProgress(previous => previous.map((progress, trackIndex) => (
        trackIndex === index ? (perfDurations[index] || progress) : progress
      )));
      await handlePerformanceEnd(index);
    } finally {
      transitionLockRef.current = false;
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

  const clearPerformanceCues = async () => {
    await Promise.all(perfAudioRefs.current.map((audio, index) => (
      pauseClicklessly(audio, perfGainNodeRefs.current[index])
    )));
    perfAudioRefs.current.forEach(audio => {
      if (audio) audio.currentTime = 0;
    });
    setPerfTracks(performanceArray(''));
    setPerfPlaying(performanceArray(false));
    setPerfVolumes(performanceArray(0.8));
    setPerfProgress(performanceArray(0));
    setPerfDurations(performanceArray(0));
    setPerformanceStatus(performanceArray(false));
    perfAudioRefs.current = performanceArray(null);
    perfGainNodeRefs.current = performanceArray(null);
    perfSourceNodeRefs.current = performanceArray(null);
    seekTimeoutRefs.current.perf = performanceArray(null);
    setCurrentPerformance(null);
    setShowPhase(SHOW_PHASE.SETUP);
    setResetConfirmOpen(false);
    showNotice('Performances cleared. BGM queue and imported tracks were kept.');
  };

  const addPerformance = () => {
    setPerfTracks(previous => [...previous, '']);
    setPerfPlaying(previous => [...previous, false]);
    setPerfVolumes(previous => [...previous, 0.8]);
    setPerfProgress(previous => [...previous, 0]);
    setPerfDurations(previous => [...previous, 0]);
    setPerformanceStatus(previous => [...previous, false]);
    perfAudioRefs.current.push(null);
    perfGainNodeRefs.current.push(null);
    perfSourceNodeRefs.current.push(null);
    seekTimeoutRefs.current.perf.push(null);
    showNotice('Performance added.');
  };

  const restartDreamLive = async () => {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;
    const shouldRestoreBackground = currentPerformance !== null && Boolean(bgTrack);
    try {
      await Promise.all(perfAudioRefs.current.map((audio, index) => (
        pauseClicklessly(audio, perfGainNodeRefs.current[index])
      )));
      perfAudioRefs.current.forEach(audio => {
        if (audio) audio.currentTime = 0;
      });
      pendingBgTrackRef.current = '';
      setPendingBgTrack('');
      setPerfPlaying(previous => previous.map(() => false));
      setPerfProgress(previous => previous.map(() => 0));
      setPerformanceStatus(previous => previous.map(() => false));
      setCurrentPerformance(null);
      setIsFading(false);
      if (shouldRestoreBackground) await fadeInBackground();
      setShowPhase(assignedCount > 0 ? SHOW_PHASE.READY : SHOW_PHASE.SETUP);
      showNotice('DreamLIVE restarted. Every performance is ready from the beginning.');
    } catch (error) {
      setIsFading(false);
      setShowError(error.message);
      setShowPhase(SHOW_PHASE.ERROR);
    } finally {
      transitionLockRef.current = false;
    }
  };

  const confirmLibraryRemoval = async () => {
    const paths = libraryRemoval?.paths || [];
    if (paths.length === 0) return;
    const removed = new Set(paths);
    const reconciled = reconcileLibraryRemoval({
      files: audioFiles,
      playlist: bgPlaylist,
      currentIndex: bgIndex,
      performances: perfTracks,
      completed: performanceStatus,
      paths,
    });
    try {
      await deleteTracksFromIndexedDB(paths);
      paths.forEach(path => {
        const managedUrl = managedSourceUrlsRef.current.get(path);
        if (managedUrl) {
          URL.revokeObjectURL(managedUrl);
          managedSourceUrlsRef.current.delete(path);
        } else if (path.startsWith('blob:')) {
          URL.revokeObjectURL(path);
        }
      });
      setManagedSources(Object.fromEntries(managedSourceUrlsRef.current));
      setAudioFiles(reconciled.files);
      setCustomFolder(reconciled.files.length ? `${reconciled.files.length} track${reconciled.files.length === 1 ? '' : 's'} ready` : null);
      setBgPlaylist(reconciled.playlist);
      setBgIndex(reconciled.currentIndex);
      if (removed.has(bgTrack)) {
        bgAudioRef.current?.pause();
        if (bgAudioRef.current) bgAudioRef.current.currentTime = 0;
        setBgPlaying(false);
      }
      setPerfTracks(reconciled.performances);
      setPerfProgress(previous => previous.map((value, index) => (removed.has(perfTracks[index]) ? 0 : value)));
      setPerfDurations(previous => previous.map((value, index) => (removed.has(perfTracks[index]) ? 0 : value)));
      setPerformanceStatus(reconciled.completed);
      setLibraryRemoval(null);
      showNotice(`Removed ${paths.length} track${paths.length === 1 ? '' : 's'} from this device.`);
    } catch (error) {
      console.error('Audio removal failed:', error);
      showNotice('Those tracks could not be removed. Try again.', 'error');
    }
  };

  // Format time in mm:ss
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const assignedCount = perfTracks.filter(Boolean).length;
  const hasPerformanceHistory = currentPerformance !== null
    || performanceStatus.some(Boolean)
    || perfProgress.some(progress => progress > 0.05);
  const readiness = getShowReadiness({ assignedPerformances: assignedCount });
  const deckState = getShowDeckState({
    ready: readiness.ready,
    assignments: perfTracks.map(Boolean),
    completed: performanceStatus,
    currentPerformance,
  });
  const runDeck = deckState.mode !== 'prep';
  const focusPerformanceIndex = deckState.activePerformanceIndex ?? deckState.nextPerformanceIndex;

  const libraryRemovalPaths = libraryRemoval?.paths || [];
  const libraryRemovalSet = new Set(libraryRemovalPaths);
  const libraryQueueReferences = bgPlaylist.filter(path => libraryRemovalSet.has(path)).length;
  const libraryCueReferences = perfTracks.filter(path => libraryRemovalSet.has(path)).length;
  const libraryRemovalBlocked = libraryRemovalPaths.some(path => (
    ((bgPlaying || isFading) && path === bgTrack)
    || (currentPerformance !== null && path === perfTracks[currentPerformance])
  ));
  return (
    <div className="App">
      <SakuraSoundscape active={bgPlaying || perfPlaying.some(Boolean) || isFading} />
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
          <button
            type="button"
            className={`tracks-library-button ${libraryOpen ? 'is-active' : ''}`}
            onClick={() => setLibraryOpen(previous => !previous)}
            aria-expanded={libraryOpen}
            aria-controls="bgm-library-panel"
          >
            <Search size={17} />
            <span>Tracks</span>
            <strong>{audioFiles.length}</strong>
          </button>
        </div>
      </header>

      <AudioLibraryPanel
        open={libraryOpen}
        files={audioFiles}
        playlist={bgPlaylist}
        displayName={displayTrackName}
        onAdd={addBackgroundTrack}
        onImport={() => handleSelectFolder({ autoQueue: true })}
        onRemove={path => requestLibraryRemoval([path])}
        onClear={() => requestLibraryRemoval(audioFiles.map(file => file.path))}
        onClose={() => setLibraryOpen(false)}
      />

      {showError && (
        <section className="show-alert-bar" role="alert">
          <strong>{showError}</strong>
          <button type="button" onClick={() => setShowError('')} aria-label="Dismiss audio alert">
            <X size={16} />
          </button>
        </section>
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
            <div className="reset-dialog-mark" aria-hidden="true"><Trash2 size={22} /></div>
            <span className="section-kicker">Performance assignments ・ 出演設定</span>
            <h2 id="reset-dialog-title">Clear all performances? ・ 出演を消去</h2>
            <p id="reset-dialog-description">
              This removes the four performance assignments and their completion history. Your BGM queue and imported tracks stay exactly as they are.
            </p>
            <div className="reset-dialog-actions">
              <button ref={resetCancelRef} type="button" className="keep-setup-btn" onClick={closeResetConfirmation}>
                Keep setup
              </button>
              <button type="button" className="confirm-reset-btn" onClick={clearPerformanceCues}>
                <Trash2 size={17} />
                Clear performances
              </button>
            </div>
          </section>
        </div>
      )}

      {libraryRemoval && (
        <div
          className="output-dialog-backdrop reset-dialog-backdrop"
          onPointerDown={event => {
            if (event.target === event.currentTarget) closeLibraryRemoval();
          }}
        >
          <section
            className="reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="library-remove-title"
            aria-describedby="library-remove-description"
          >
            <div className="reset-dialog-mark" aria-hidden="true"><Trash2 size={22} /></div>
            <span className="section-kicker">On-device library ・ 音源</span>
            <h2 id="library-remove-title">
              {libraryRemovalPaths.length === audioFiles.length ? 'Clear the track library?' : 'Remove this track?'}
            </h2>
            <p id="library-remove-description">
              This permanently removes {libraryRemovalPaths.length === 1 ? 'the track' : `${libraryRemovalPaths.length} tracks`} from this device
              {libraryQueueReferences || libraryCueReferences
                ? ` and clears ${libraryQueueReferences} queue reference${libraryQueueReferences === 1 ? '' : 's'} and ${libraryCueReferences} performance assignment${libraryCueReferences === 1 ? '' : 's'}.`
                : '. Your show assignments are otherwise unchanged.'}
            </p>
            {libraryRemovalBlocked && (
              <p className="dialog-danger-note">Pause the active track before removing it.</p>
            )}
            <div className="reset-dialog-actions">
              <button ref={libraryCancelRef} type="button" className="keep-setup-btn" onClick={closeLibraryRemoval}>
                Keep tracks
              </button>
              <button type="button" className="confirm-reset-btn" onClick={confirmLibraryRemoval} disabled={libraryRemovalBlocked}>
                <Trash2 size={17} />
                {libraryRemovalPaths.length === 1 ? 'Remove track' : 'Clear library'}
              </button>
            </div>
          </section>
        </div>
      )}

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
          <main className={`show-workspace deck-${deckState.mode} ${runDeck ? 'run-deck is-setup-open' : ''} ${currentPerformance !== null ? 'is-live' : ''} ${currentPerformance !== null && (perfPlaying[currentPerformance] || isFading) ? 'is-visualizing' : ''}`}>
            <section className={`background-section split-layout ${bgPlaying ? 'is-playing' : ''} ${currentPerformance !== null || isFading ? 'is-held' : ''}`}>
              <div className="section-header">
                <h2 className="section-title">BGM <span className="japanese-label">店内音楽</span></h2>
                <div className="bgm-header-actions">
                  <details className="bgm-level-menu bgm-header-level">
                    <summary aria-label={`BGM level ${Math.round(bgVolume * 100)} percent`}>
                      <Volume2 size={15} aria-hidden="true" />
                      <span>{Math.round(bgVolume * 100)}%</span>
                    </summary>
                    <label className="bgm-level-control">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={bgVolume}
                        onChange={handleBgVolumeChange}
                        aria-label="BGM volume"
                      />
                      <strong>{Math.round(bgVolume * 100)}%</strong>
                    </label>
                  </details>
                </div>
              </div>
              {audioFiles.length === 0 && (
                <div className="library-inline-state">
                  <FolderOpen size={20} />
                  <div>
                    <strong>No tracks on this device ・ 音源がありません</strong>
                    <span>Import licensed audio to build the show.</span>
                  </div>
                  <button type="button" onClick={() => handleSelectFolder({ autoQueue: true })} disabled={importState.active}>
                    {importState.active ? `Checking ${importState.completed}/${importState.total}` : 'Import & queue'}
                  </button>
                </div>
              )}
              <div className="bg-music-container">
                {runDeck && (
                  <div className={`bgm-visualizer-slot ${bgPlaying && currentPerformance === null ? 'is-active' : ''}`}>
                    <AudioVisualizer
                      analyserRef={analyserNodeRef}
                      active={bgPlaying && currentPerformance === null}
                      variant="compact"
                      status="BGM"
                    />
                  </div>
                )}
                <BgmQueue
                  playlist={bgPlaylist}
                  currentIndex={bgIndex}
                  heldIndex={bgPlaying || currentPerformance !== null ? bgIndex : null}
                  pendingIndex={pendingBgTrack ? bgPlaylist.indexOf(pendingBgTrack) : null}
                  playbackLocked={isFading && currentPerformance === null}
                  queueOnly={currentPerformance !== null}
                  playing={bgPlaying}
                  showPlayback={runDeck}
                  trackName={trackName}
                  onPlay={playBackgroundFrom}
                  onQueue={queueBackgroundForReturn}
                  onToggle={toggleBackgroundMusic}
                  onMove={moveBackgroundTrack}
                  onRemove={removeBackgroundTrack}
                  onShuffle={shuffleBackgroundTracks}
                />

                <audio
                  ref={bgAudioRef}
                  src={bgTrackSource || undefined}
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
                  <h2 className="section-title">Performances ・ パフォーマンス</h2>
                </div>
                <div className="setup-stage-actions">
                  <div
                    className="performance-summary"
                    aria-label={`${assignedCount} of ${perfTracks.length} performances assigned`}
                  >
                    <strong>{assignedCount}/{perfTracks.length}</strong>
                    <span>ready</span>
                  </div>
                </div>
              </div>
            {runDeck && (
              <div className={`run-focus-panel mode-${deckState.mode} ${deckState.activePerformanceIndex !== null ? 'has-active-performance' : ''} ${deckState.activePerformanceIndex === null && deckState.nextPerformanceIndex === null ? 'is-complete' : ''}`}>
                <SakuraDrift />
                {deckState.mode === 'live' && focusPerformanceIndex !== null ? (
                  <>
                    <div className="run-focus-heading">
                      <div>
                        <span className="run-focus-kicker">
                          {isFading
                            ? <>Transition <span className="japanese-label">トランジション中</span></>
                            : (showPhase === SHOW_PHASE.PAUSED
                              ? <>Paused <span className="japanese-label">ポーズ中</span></>
                              : <>On stage <span className="japanese-label">オンステージ</span></>)}
                        </span>
                        <h2>{trackName(perfTracks[focusPerformanceIndex])}</h2>
                      </div>
                    </div>
                    <div className="run-action-row">
                      <button
                        type="button"
                        className="control-button run-rail-button"
                        onClick={() => handleSeek(focusPerformanceIndex, 0)}
                        disabled={isFading}
                        aria-label="Restart performance"
                        title="Restart performance"
                      >
                        <RotateCcw size={17} />
                      </button>
                      <button
                        type="button"
                        className={`run-primary-action ${perfPlaying[focusPerformanceIndex] ? 'is-pause' : ''}`}
                        onClick={() => togglePerfPause(focusPerformanceIndex)}
                        disabled={isFading}
                        aria-label={perfPlaying[focusPerformanceIndex] ? 'Pause performance' : 'Resume performance'}
                        title={perfPlaying[focusPerformanceIndex] ? 'Pause' : 'Resume'}
                      >
                        {perfPlaying[focusPerformanceIndex] ? <Pause size={18} /> : <Play size={18} />}
                        {!perfPlaying[focusPerformanceIndex] && <span>Resume</span>}
                      </button>
                      <button
                        type="button"
                        className="control-button run-end-button"
                        onClick={() => endPerformance(focusPerformanceIndex)}
                        disabled={isFading}
                        aria-label="End performance"
                      >
                        <Square size={14} fill="currentColor" />
                        <span>End</span>
                      </button>
                      <details className="run-level-menu">
                        <summary aria-label={`Performance level ${Math.round(perfVolumes[focusPerformanceIndex] * 100)} percent`}>
                          <Volume2 size={17} aria-hidden="true" />
                          <span>{Math.round(perfVolumes[focusPerformanceIndex] * 100)}%</span>
                        </summary>
                        <label className="run-level-control">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={perfVolumes[focusPerformanceIndex]}
                            onChange={event => handlePerfVolumeChange(focusPerformanceIndex, event.target.value)}
                            aria-label="Live performance volume"
                          />
                          <strong>{Math.round(perfVolumes[focusPerformanceIndex] * 100)}%</strong>
                        </label>
                      </details>
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
                    <div className="run-signal-strip">
                      <AudioVisualizer
                        analyserRef={analyserNodeRef}
                        active={perfPlaying[focusPerformanceIndex] || isFading}
                        variant="focus"
                        status={isFading
                          ? 'Transitioning'
                          : (perfPlaying[focusPerformanceIndex] ? 'Live' : 'Paused')}
                      />
                    </div>
                  </>
                ) : deckState.nextPerformanceIndex !== null ? (
                  <>
                    <div className="run-focus-heading ready-heading">
                      <div>
                        <span className="run-focus-kicker">Next on stage <span className="japanese-label">ネクストステージ</span></span>
                        <h2>{trackName(perfTracks[deckState.nextPerformanceIndex])}</h2>
                      </div>
                    </div>
                    <div className="run-action-row">
                      <button
                        type="button"
                        className="run-primary-action"
                        onClick={() => startPerformance(deckState.nextPerformanceIndex)}
                        disabled={isFading || !trackSource(perfTracks[deckState.nextPerformanceIndex])}
                      >
                        <Play size={18} />
                        <span>Start</span>
                      </button>
                      <details className="run-level-menu">
                        <summary aria-label={`Performance level ${Math.round(perfVolumes[deckState.nextPerformanceIndex] * 100)} percent`}>
                          <Volume2 size={17} aria-hidden="true" />
                          <span>{Math.round(perfVolumes[deckState.nextPerformanceIndex] * 100)}%</span>
                        </summary>
                        <label className="run-level-control">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={perfVolumes[deckState.nextPerformanceIndex]}
                            onChange={event => handlePerfVolumeChange(deckState.nextPerformanceIndex, event.target.value)}
                            aria-label="Next performance volume"
                          />
                          <strong>{Math.round(perfVolumes[deckState.nextPerformanceIndex] * 100)}%</strong>
                        </label>
                      </details>
                    </div>
                    <div className="run-progress is-idle">
                      <span>0:00</span>
                      <input
                        type="range"
                        min="0"
                        max={perfDurations[deckState.nextPerformanceIndex] || 1}
                        value="0"
                        disabled
                        aria-label={`Performance ${deckState.nextPerformanceIndex + 1} ready`}
                      />
                      <span>{formatTime(perfDurations[deckState.nextPerformanceIndex])}</span>
                    </div>
                  </>
                ) : (
                  <div className="run-complete-state">
                    <Check size={28} />
                    <div>
                      <span className="run-focus-kicker">Show complete <span className="japanese-label">ショー完了</span></span>
                      <h2>All performances complete</h2>
                      <p>{bgTrack ? 'BGM continues. Add another performance below when needed.' : 'Add another performance below.'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {runDeck && (
              <div className="run-setup-header">
                <span>Lineup <span className="japanese-label">ラインナップ</span></span>
                <div className="lineup-header-actions">
                  {hasPerformanceHistory && (
                    <button
                      type="button"
                      className="control-button restart-dreamlive-button"
                      onClick={restartDreamLive}
                      disabled={isFading}
                      title="Reset every performance to the beginning"
                    >
                      <RotateCcw size={14} />
                      <span>Restart DreamLIVE</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="control-button clear-performances-button"
                    onClick={openResetConfirmation}
                    disabled={currentPerformance !== null || isFading}
                    title={currentPerformance !== null ? 'Finish the current performance before clearing assignments' : 'Clear performance assignments'}
                  >
                    <Trash2 size={14} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            )}
            <div className="performances-grid">
              {perfTracks.map((_, index) => (
                <div
                  key={index}
                  className={`performance-card ${currentPerformance === index ? 'active' : ''
                    } ${performanceStatus[index] ? 'completed' : ''} ${perfTracks[index] ? '' : 'is-empty'} ${currentPerformance === null && perfTracks[index] ? 'has-row-action' : ''}`}
                  aria-label={`Performance ${index + 1}`}
                >
                  <div className="perf-header">
                    <div className="perf-number">{String(index + 1).padStart(2, '0')}</div>
                    {currentPerformance === index && perfPlaying[index] ? (
                      <span className="perf-status-badge playing" aria-label="Live" title="Live" />
                    ) : currentPerformance === index && !perfPlaying[index] ? (
                      <span className="perf-status-badge paused" aria-label={isFading ? 'Transitioning' : 'Paused'} title={isFading ? 'Transitioning' : 'Paused'} />
                    ) : performanceStatus[index] ? (
                      <span className="perf-status-badge completed" aria-label="Done" title="Done" />
                    ) : perfTracks[index] ? (
                      <span className="perf-status-badge ready" aria-label="Ready" title="Ready" />
                    ) : (
                      <span className="perf-status-badge idle" aria-label="Empty" title="Empty" />
                    )}
                  </div>

                  <div className="perf-select">
                    <SearchableSelect
                      value={perfTracks[index]}
                      onChange={(value) => {
                        setPerfTracks(previous => previous.map((track, trackIndex) => (
                          trackIndex === index ? value : track
                        )));
                        setPerformanceStatus(previous => previous.map((done, trackIndex) => (
                          trackIndex === index ? false : done
                        )));
                        setPerfProgress(previous => previous.map((progress, trackIndex) => (
                          trackIndex === index ? 0 : progress
                        )));
                        setPerfDurations(previous => previous.map((duration, trackIndex) => (
                          trackIndex === index ? 0 : duration
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

                  <span className="perf-duration" aria-hidden={!perfTracks[index]}>
                    {perfTracks[index] ? formatTime(perfDurations[index]) : ''}
                  </span>

                  {currentPerformance === null && perfTracks[index] && (
                    <button
                      type="button"
                      className="perf-row-start"
                      onClick={() => startPerformance(index)}
                      disabled={isFading || !trackSource(perfTracks[index])}
                      aria-label={`${performanceStatus[index] ? 'Replay' : 'Start'} performance ${index + 1}`}
                      title={`${performanceStatus[index] ? 'Replay' : 'Start'} performance ${index + 1}`}
                    >
                      <Play size={13} fill="currentColor" />
                      <span>{performanceStatus[index] ? 'Replay' : 'Start'}</span>
                    </button>
                  )}

                  <audio
                    ref={el => perfAudioRefs.current[index] = el}
                    src={trackSource(perfTracks[index]) || undefined}
                    preload="metadata"
                    onEnded={() => handlePerformanceEnd(index)}
                    onLoadedMetadata={() => handleLoadedMetadata(index)}
                  />
                </div>
              ))}
              <button type="button" className="add-performance-button" onClick={addPerformance}>
                <Plus size={13} />
                <span>Add performance</span>
              </button>
            </div>
            </section>
          </main>
        </>
      )}
    </div>
  );
}

export default App;
