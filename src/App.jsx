import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useId } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronDown,
  FolderOpen,
  MoreVertical,
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
  isPerformanceCycleComplete,
  nextPlaylistIndex,
  promotePerformanceOrder,
  resolvePerformanceCompletion,
  shouldShowRunDeck,
  endFadeDecision,
  shouldSyncPlaybackProgress,
  startPerformanceFlow,
  visiblePerformanceOrder,
} from './audio/showFlow';
import {
  insertPlaylistItem,
  movePlaylistItem,
  queuePlaylistItemNext,
  removePlaylistItem,
  shufflePlaylist,
} from './audio/playlist';
import { processAudioFiles } from './audio/importAudio';
import {
  AUDIO_TRANSITION_SECONDS,
  CLICKLESS_MUTE_SECONDS,
  fadeStartValue,
  handoffLeadSeconds,
  setGainImmediately,
  scheduleGainEnvelope,
} from './audio/gainEnvelope';
import {
  audioIdFromRef,
  isManagedAudioRef,
  reconcileLibraryRemoval,
  toLibraryMetadata,
} from './audio/libraryStorage';
import { getPopoverPosition, nextOptionIndex } from './ui/combobox';
import AudioVisualizer from './components/AudioVisualizer';
import { ANALYSIS_SAMPLE_RATE } from './audio/waveform';
import { computeSpectrogram } from './audio/spectrogram';
import AudioLibraryPanel from './components/AudioLibraryPanel';
import { prefersAutoFocus } from './ui/focus';
import {
  ALL_FOLDERS,
  assignFolder,
  createFolder,
  deleteFolder,
  filesInFolder,
  foldersWithCounts,
  normalizeFolderState,
  renameFolder,
} from './audio/folders';
import BgmQueue from './components/BgmQueue';
import './App.css';

function StableVolumeSlider({ value, ariaLabel, onPreview, onCommit }) {
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const latestValueRef = useRef(value);
  const interactingRef = useRef(false);

  const preview = event => {
    const next = Number.parseFloat(event.currentTarget.value);
    latestValueRef.current = next;
    if (outputRef.current) outputRef.current.textContent = `${Math.round(next * 100)}%`;
    onPreview(next);
  };

  const commit = () => {
    interactingRef.current = false;
    onCommit(latestValueRef.current);
  };

  useEffect(() => {
    if (interactingRef.current) return;
    latestValueRef.current = value;
    if (inputRef.current) inputRef.current.value = String(value);
    if (outputRef.current) outputRef.current.textContent = `${Math.round(value * 100)}%`;
  }, [value]);

  return (
    <>
      <input
        ref={inputRef}
        type="range"
        min="0"
        max="1"
        step="0.01"
        defaultValue={value}
        onPointerDown={() => { interactingRef.current = true; }}
        onInput={preview}
        onPointerUp={commit}
        onPointerCancel={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label={ariaLabel}
      />
      <strong ref={outputRef}>{Math.round(value * 100)}%</strong>
    </>
  );
}

// Searchable Select Component
function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder,
  disabled,
  triggerLabel,
  triggerClassName = '',
  triggerAriaLabel,
  menuWidth,
  menuAlign,
  compactActions = false,
  onRemove,
  folders = [],
  folderValue,
  onFolderChange,
  multiple = false,
  onConfirmMultiple,
  confirmLabel = 'Add',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStage, setMenuStage] = useState('actions');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [picked, setPicked] = useState(() => []);
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
        setPicked([]);
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
        preferredWidth: compactActions && menuStage === 'actions' ? 190 : menuWidth,
        // A phone has the height; the old flat 320 left the track list showing
        // six rows and made a long library feel unscrollable.
        preferredHeight: compactActions && menuStage === 'actions'
          ? 108
          : Math.min(460, Math.max(280, Math.round(window.innerHeight * 0.58))),
        align: menuAlign,
      }));
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const focusFrame = window.requestAnimationFrame(() => {
      if (!prefersAutoFocus()) return;
      if (!compactActions || menuStage === 'tracks') searchRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [compactActions, isOpen, menuAlign, menuStage, menuWidth]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = filteredOptions.findIndex(option => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : (filteredOptions.length ? 0 : -1));
  }, [isOpen, searchTerm, value, filteredOptions.length]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setMenuStage('actions');
    setSearchTerm('');
  };

  const openSelect = () => {
    if (!disabled) {
      setMenuStage(compactActions ? 'actions' : 'tracks');
      setIsOpen(true);
    }
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
          className={`select-dropdown ${compactActions && menuStage === 'actions' ? 'is-action-menu' : ''}`}
          data-placement={position.placement}
          style={{
            position: 'fixed',
            ...(position.placement === 'top'
              ? { bottom: `${position.bottom}px` }
              : { top: `${position.top}px` }),
            left: `${position.left}px`,
            width: `${position.width}px`,
            '--menu-max-height': `${position.maxHeight}px`,
          }}
        >
          {compactActions && menuStage === 'actions' ? (
            <div className="performance-actions-menu" role="menu" aria-label="Performance options">
              <button type="button" role="menuitem" onClick={() => setMenuStage('tracks')}>
                <Search size={15} />
                <span>Change song</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  onRemove?.();
                  setIsOpen(false);
                  setMenuStage('actions');
                }}
              >
                <Trash2 size={15} />
                <span>Remove song</span>
              </button>
            </div>
          ) : (
            <>
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
              {folders.length > 0 && (
                <div className="select-folder-bar" role="tablist" aria-label="Folders">
                  {folders.map(entry => (
                    <button
                      key={entry.name}
                      type="button"
                      role="tab"
                      aria-selected={folderValue === entry.name}
                      className={`select-folder-chip ${folderValue === entry.name ? 'is-active' : ''}`}
                      onClick={() => onFolderChange?.(entry.name)}
                    >
                      <span>{entry.name}</span>
                      <em>{entry.count}</em>
                    </button>
                  ))}
                </div>
              )}
              <div id={listboxId} className="select-options" role="listbox" aria-multiselectable={multiple} aria-label="Audio tracks">
                {filteredOptions.length === 0 ? (
                  <div className="no-results">No tracks found</div>
                ) : filteredOptions.map((option, index) => {
                  const isPicked = multiple
                    ? picked.includes(option.value)
                    : option.value === value;
                  return (
                    <button
                      key={option.value}
                      id={`${listboxId}-${index}`}
                      type="button"
                      className={`select-option ${isPicked ? 'selected' : ''} ${index === activeIndex ? 'active' : ''}`}
                      onClick={() => {
                        if (!multiple) return handleSelect(option.value);
                        setPicked(previous => (previous.includes(option.value)
                          ? previous.filter(item => item !== option.value)
                          : [...previous, option.value]));
                      }}
                      onPointerEnter={() => setActiveIndex(index)}
                      role="option"
                      aria-selected={isPicked}
                    >
                      {multiple && (
                        <span className="select-check" aria-hidden="true">{isPicked && <Check size={12} />}</span>
                      )}
                      <span>{option.label}</span>
                      {!multiple && isPicked && <Check size={16} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              {multiple && (
                <div className="select-confirm-bar">
                  <span>{picked.length} selected</span>
                  <button
                    type="button"
                    className="select-confirm-button"
                    disabled={picked.length === 0}
                    onClick={() => {
                      onConfirmMultiple?.(picked);
                      setPicked([]);
                      setSearchTerm('');
                      setIsOpen(false);
                    }}
                  >
                    {confirmLabel}
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className={`searchable-select ${triggerClassName} ${compactActions ? 'is-compact-actions' : ''}`}>
        <button
          ref={triggerRef}
          type="button"
          className="select-trigger"
          onClick={() => {
            if (disabled) return;
            if (isOpen) {
              setIsOpen(false);
              setMenuStage('actions');
            } else {
              openSelect();
            }
          }}
          onKeyDown={handleTriggerKeyDown}
          disabled={disabled}
          aria-haspopup={compactActions ? 'menu' : 'listbox'}
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-label={triggerAriaLabel}
        >
          {compactActions ? (
            <MoreVertical size={17} aria-hidden="true" />
          ) : (
            <>
              <span className="select-value">
                {triggerLabel || (selectedOption ? selectedOption.label : placeholder)}
              </span>
              <ChevronDown size={16} className="select-icon" />
            </>
          )}
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

// WKWebView suspends an AudioContext the moment the app leaves the foreground,
// so anything routed through the Web Audio graph goes silent on the lock screen
// however the audio session is configured. Playing straight from the <audio>
// element keeps the show running; the fade paths already have an element-volume
// implementation for exactly this case. Set to false to get the live analyser
// back at the cost of background playback.
const ROUTE_AUDIO_THROUGH_WEB_AUDIO = false;


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
  const [loopCurrentTrack, setLoopCurrentTrack] = useState(false);
  const [bgPlaying, setBgPlaying] = useState(false);
  const [bgVolume, setBgVolume] = useState(0.5);
  const bgVolumeRef = useRef(0.5);
  const [pendingBgTrack, setPendingBgTrack] = useState('');
  const pendingBgTrackRef = useRef('');
  // Queuing a track for after a performance only changes which track is next.
  // Actually starting it has to wait for the lineup to hand the room back and
  // for that track's audio to be ready, so the intent is held here and an
  // effect below plays it the moment both are true.
  const resumeQueuedBgRef = useRef(false);
  // One offline spectrogram per track source: real frequency content for the
  // visualizer, without routing playback through the Web Audio graph.
  const trackPeaksRef = useRef(new Map());
  const bgPeaksRef = useRef(null);
  const perfPeaksRef = useRef(null);
  const peakWorkRef = useRef(new Set());
  const roomBackstopTimeoutRef = useRef(null);
  const bgPlaylistRef = useRef([]);
  const [bgQueueExpanded, setBgQueueExpanded] = useState(true);
  const [isPortraitLayout, setIsPortraitLayout] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches
  ));
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Folders are labels the operator puts on imported tracks so a 30-track
  // library sorts into room music and performances. They live beside the
  // library, never inside the audio.
  const [folderState, setFolderState] = useState(() => {
    try {
      return normalizeFolderState(JSON.parse(window.localStorage.getItem('dreamlive-folders-v1')));
    } catch {
      return normalizeFolderState();
    }
  });
  const [performanceFolder, setPerformanceFolder] = useState(ALL_FOLDERS);
  const bgAudioRef = useRef(null);
  const bgTrack = bgPlaylist[bgIndex] || '';

  // Performance tracks state
  const [perfTracks, setPerfTracks] = useState(() => performanceArray(''));
  const [perfPlaying, setPerfPlaying] = useState(() => performanceArray(false));
  const [perfVolumes, setPerfVolumes] = useState(() => performanceArray(0.8));
  const perfVolumesRef = useRef(performanceArray(0.8));
  const [perfProgress, setPerfProgress] = useState(() => performanceArray(0));
  const [perfDurations, setPerfDurations] = useState(() => performanceArray(0));
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [selectedPerformanceIndex, setSelectedPerformanceIndex] = useState(null);
  const [performanceStatus, setPerformanceStatus] = useState(() => performanceArray(false));
  const [performanceOrder, setPerformanceOrder] = useState(() => performanceArray(null).map((_, index) => index));
  const [draftPerformanceIndex, setDraftPerformanceIndex] = useState(null);
  const [lineupCommitted, setLineupCommitted] = useState(false);
  const perfAudioRefs = useRef(performanceArray(null));
  const [showPhase, setShowPhase] = useState(SHOW_PHASE.SETUP);
  const [showError, setShowError] = useState('');

  useEffect(() => {
    const portraitQuery = window.matchMedia('(orientation: portrait)');
    const syncOrientation = event => setIsPortraitLayout(event.matches);
    portraitQuery.addEventListener?.('change', syncOrientation);
    return () => portraitQuery.removeEventListener?.('change', syncOrientation);
  }, []);

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
  const bgTailTimeoutRef = useRef(null);
  const endFadeStartedRef = useRef({});
  const bgReturnStartedRef = useRef(false);
  const returnBackgroundRef = useRef(() => {});
  const fadeResolverRef = useRef(null);
  const transitionLockRef = useRef(false);
  const seekTimeoutRefs = useRef({ bg: null, perf: performanceArray(null) });
  const performanceSeekingRef = useRef(performanceArray(false));
  const performanceSeekReleaseRefs = useRef(performanceArray(null));
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

  useEffect(() => {
    window.localStorage.setItem('dreamlive-folders-v1', JSON.stringify(folderState));
  }, [folderState]);

  const performanceFolderChips = useMemo(
    () => foldersWithCounts(folderState, audioFiles),
    [folderState, audioFiles],
  );

  const moveTracksToFolder = (paths, folder) => {
    const targets = new Set(paths);
    setFolderState(previous => audioFiles
      .filter(file => targets.has(file.path))
      .reduce((state, file) => assignFolder(state, file, folder), previous));
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
    // Element playback needs no context, and gating every play path on a
    // context that iOS may have parked in "interrupted" is how an old iPad ends
    // up refusing to start anything after a few background trips.
    if (!ROUTE_AUDIO_THROUGH_WEB_AUDIO) return true;
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
    } catch (firstError) {
      // An older iPad releases a media element's decoder after enough
      // background trips; the element still exists and still has a src, but the
      // first play() rejects. Re-attaching the source recovers it, and a second
      // failure is a real one worth telling the operator about.
      console.warn(`Playback failed (${label}), reloading the source:`, firstError);
      try {
        const resumeAt = audio.currentTime;
        audio.load();
        if (Number.isFinite(resumeAt) && resumeAt > 0) {
          await new Promise(resolve => {
            const settle = () => { audio.removeEventListener('loadedmetadata', settle); resolve(); };
            audio.addEventListener('loadedmetadata', settle);
            window.setTimeout(settle, 600);
          });
          try { audio.currentTime = resumeAt; } catch (seekError) { /* start from zero */ }
        }
        await audio.play();
        return true;
      } catch (secondError) {
        console.warn(`Playback failed again (${label}):`, secondError);
        showNotice(`Couldn't start ${label}. Tap play again.`, 'error');
        return false;
      }
    }
  };

  // --- Glitch-free starts -------------------------------------------------
  // WebKit pipes each <audio> element into the AudioContext through a
  // MediaElementAudioSourceNode whose resampler takes ~200-300ms to lock on
  // whenever the file's sample rate differs from the iPad hardware rate. Every
  // play path silences its gain node first and fades up after playback begins,
  // keeping that warm-up inaudible.
  const START_FADE = AUDIO_TRANSITION_SECONDS.handoffIn;
  const RESUME_FADE = AUDIO_TRANSITION_SECONDS.resume;

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
      // Start the rise at an audible level. From the silence floor an
      // exponential ramp is inaudible for most of its length, which is why a
      // long fade-in used to sound like a gap followed by a sudden entrance.
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(fadeStartValue(target, gainNode.gain.value), now);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(target, 0.0002), now + seconds);
    } else if (ctx) {
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      gainNode.gain.setValueAtTime(target, ctx.currentTime);
    } else {
      gainNode.gain.value = target;
    }
  };

  const fadeElementVolume = (audio, target, seconds) => new Promise(resolve => {
    if (!audio || seconds <= 0) {
      if (audio) audio.volume = target;
      resolve();
      return;
    }
    const start = target > audio.volume ? fadeStartValue(target, audio.volume) : audio.volume;
    audio.volume = start;
    const startedAt = window.performance.now();
    const step = now => {
      const progress = Math.min(1, (now - startedAt) / (seconds * 1000));
      audio.volume = start + ((target - start) * progress);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    window.requestAnimationFrame(step);
  });

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

  // `holdSeconds` is how long the caller waits before moving on. Left at the
  // full duration this is a plain fade-out; set shorter, the fade keeps running
  // underneath whatever starts next, so a long transition has no silent gap.
  // A gain node only shapes what you hear once its media element is actually
  // connected to it. WebKit refuses that connection for a reused element, and a
  // fade scheduled on an unrouted node is silent - the track simply stops. Every
  // fade path resolves through these so it falls back to element volume instead.
  const routedBgGain = () => (bgSourceNodeRef.current ? bgGainNodeRef.current : null);
  const routedPerfGain = index => (
    perfSourceNodeRefs.current[index] ? perfGainNodeRefs.current[index] : null
  );

  const pauseClicklessly = async (
    audio,
    gainNode,
    duration = AUDIO_TRANSITION_SECONDS.pause,
    { holdSeconds = duration } = {},
  ) => {
    if (!audio || audio.paused) return;
    const hold = Math.max(0, Math.min(holdSeconds, duration));
    const context = audioContextRef.current;
    if (!gainNode || !context) {
      const restoreVolume = audio.volume;
      const tail = fadeElementVolume(audio, 0, duration).then(() => {
        audio.pause();
        audio.volume = restoreVolume;
      });
      if (hold >= duration) await tail;
      else await new Promise(resolve => window.setTimeout(resolve, hold * 1000));
      return;
    }
    const waitMs = scheduleGainEnvelope(gainNode.gain, {
      currentTime: context.currentTime,
      target: 0,
      duration,
    });
    const tail = new Promise(resolve => window.setTimeout(() => {
      audio.pause();
      resolve();
    }, waitMs + 8));
    if (hold >= duration) await tail;
    else await new Promise(resolve => window.setTimeout(resolve, hold * 1000));
  };

  const seekClicklessly = ({ audio, gainNode, value, restoreTo, timeoutKey, index = null }) => {
    if (!audio) return;
    const context = audioContextRef.current;
    const setPlayhead = () => {
      audio.currentTime = value;
      if (!audio.paused && gainNode) {
        fadeGainTo(gainNode, restoreTo, AUDIO_TRANSITION_SECONDS.seek);
      }
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
    // With playback routed straight through the <audio> elements, an
    // AudioContext is dead weight that still owns the iOS audio session. Waking
    // it on foreground return re-arms that session and interrupts the element
    // that is happily playing, which is exactly the "pauses when I come back"
    // report. No graph, no context.
    if (!ROUTE_AUDIO_THROUGH_WEB_AUDIO) return;

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

      if (ROUTE_AUDIO_THROUGH_WEB_AUDIO && bgAudioRef.current) {
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
        if (ROUTE_AUDIO_THROUGH_WEB_AUDIO && audio && !perfSourceNodeRefs.current[i]) {
          try {
            const source = ctx.createMediaElementSource(audio);
            source.connect(ensurePerformanceGain(i));
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
      loopCurrentTrack,
      performanceIds: perfTracks.map(keyForPath),
      bgVolume,
      perfVolumes,
    };
    window.localStorage.setItem('dreamlive-show-setup-v1', JSON.stringify(setup));
  }, [audioFiles, bgPlaylist, bgIndex, repeatPlaylist, loopCurrentTrack, perfTracks, bgVolume, perfVolumes]);

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
        // Coming back from the background, the rendered playhead is as stale as
        // the time the app spent away. Snap it to the element before anything
        // else reads it.
        if (audio && Number.isFinite(audio.currentTime)) {
          const elapsed = audio.currentTime;
          setPerfProgress(previous => previous.map((value, trackIndex) => (
            trackIndex === index ? elapsed : value
          )));
        }
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
    // Native side reactivated the audio session after a call, Siri, or a media
    // services reset. The app may still be in the background here, so this path
    // cannot wait for visibility the way the others do.
    const restoreAfterSession = async () => {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== 'running') {
        try { await ctx.resume(); } catch (error) { /* handled by the next user action */ }
      }
      const playback = playbackStateRef.current;
      if (playback.currentPerformance === null && playback.bgPlaying && bgAudioRef.current?.paused) {
        try { await bgAudioRef.current.play(); } catch (error) { /* the operator will see it stopped */ }
      }
    };

    document.addEventListener('visibilitychange', recover);
    window.addEventListener('focus', recover);
    window.addEventListener('dreamliveAudioSessionRestored', restoreAfterSession);
    return () => {
      document.removeEventListener('visibilitychange', recover);
      window.removeEventListener('focus', recover);
      window.removeEventListener('dreamliveAudioSessionRestored', restoreAfterSession);
    };
  }, []);

  // Update progress bars (only ticks while something is actually playing)
  useEffect(() => {
    const anyPlaying = perfPlaying.some(Boolean);
    if (!anyPlaying) return undefined;

    progressIntervalRef.current = setInterval(() => {
      // A track that simply runs out stops at full level, which reads as a cut.
      // Ride the last seconds down so a natural ending sounds like every other
      // transition, and undo it if the operator scrubs back into the track.
      const liveIndex = playbackStateRef.current.currentPerformance;
      const liveAudio = liveIndex === null ? null : perfAudioRefs.current[liveIndex];
      if (liveAudio && !liveAudio.paused && perfPlaying[liveIndex]) {
        const gainNode = routedPerfGain(liveIndex);
        const context = audioContextRef.current;
        const decision = endFadeDecision({
          duration: liveAudio.duration,
          currentTime: liveAudio.currentTime,
          fadeSeconds: AUDIO_TRANSITION_SECONDS.handoffOut,
          started: Boolean(endFadeStartedRef.current[liveIndex]),
          isSeeking: performanceSeekingRef.current[liveIndex],
        });
        if (decision === 'fade') {
          endFadeStartedRef.current[liveIndex] = true;
          returnBackgroundRef.current();
          const duration = Math.max(0.05, liveAudio.duration - liveAudio.currentTime);
          if (gainNode && context) {
            scheduleGainEnvelope(gainNode.gain, {
              currentTime: context.currentTime,
              target: 0,
              duration,
            });
          } else {
            fadeElementVolume(liveAudio, 0, duration);
          }
        } else if (decision === 'cancel') {
          endFadeStartedRef.current[liveIndex] = false;
          if (gainNode && context) {
            fadeGainTo(gainNode, perfVolumesRef.current[liveIndex], AUDIO_TRANSITION_SECONDS.seek);
          } else {
            liveAudio.volume = perfVolumesRef.current[liveIndex];
          }
        }
      }
      if (document.visibilityState !== 'visible') return;
      setPerfProgress(prev => {
        let changed = false;
        const next = prev.map((value, index) => {
          const audio = perfAudioRefs.current[index];
          if (audio && shouldSyncPlaybackProgress({
            isPlaying: perfPlaying[index],
            isSeeking: performanceSeekingRef.current[index],
            audioTime: audio.currentTime,
            renderedTime: value,
          })) {
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
        setLoopCurrentTrack(saved.loopCurrentTrack === true);
        setPerfTracks(restoredPerformances);
        setPerfPlaying(performanceArray(false, performanceCount));
        setPerfProgress(performanceArray(0, performanceCount));
        setPerfDurations(performanceArray(0, performanceCount));
        setPerformanceStatus(performanceArray(false, performanceCount));
        setPerformanceOrder(Array.from({ length: performanceCount }, (_, index) => index));
        perfAudioRefs.current = performanceArray(null, performanceCount);
        perfGainNodeRefs.current = performanceArray(null, performanceCount);
        perfSourceNodeRefs.current = performanceArray(null, performanceCount);
        seekTimeoutRefs.current.perf = performanceArray(null, performanceCount);
        performanceSeekingRef.current = performanceArray(false, performanceCount);
        performanceSeekReleaseRefs.current = performanceArray(null, performanceCount);
        if (Number.isFinite(saved.bgVolume)) {
          bgVolumeRef.current = saved.bgVolume;
          setBgVolume(saved.bgVolume);
        }
        const restoredVolumes = Array.from({ length: performanceCount }, (_, index) => (
          Number.isFinite(saved.perfVolumes?.[index]) ? saved.perfVolumes[index] : 0.8
        ));
        perfVolumesRef.current = restoredVolumes;
        setPerfVolumes(restoredVolumes);
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
    bgPlaylistRef.current = bgPlaylist;
  }, [bgPlaylist]);

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
    if (roomBackstopTimeoutRef.current) window.clearTimeout(roomBackstopTimeoutRef.current);
    if (seekTimeoutRefs.current.bg) window.clearTimeout(seekTimeoutRefs.current.bg);
    seekTimeoutRefs.current.perf.forEach(timer => timer && window.clearTimeout(timer));
    performanceSeekReleaseRefs.current.forEach(timer => timer && window.clearTimeout(timer));

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

  // Decode once, offline, at a low rate. An OfflineAudioContext renders into
  // memory and never claims the audio session, so this cannot interrupt a track
  // that is playing - which is exactly why the live analyser had to go.
  const loadTrackPeaks = async (source) => {
    if (!source) return null;
    const cached = trackPeaksRef.current.get(source);
    if (cached) return cached;
    if (peakWorkRef.current.has(source)) return null;
    peakWorkRef.current.add(source);
    try {
      const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OfflineContext) return null;
      const response = await fetch(source);
      const buffer = await response.arrayBuffer();
      const context = new OfflineContext(1, ANALYSIS_SAMPLE_RATE, ANALYSIS_SAMPLE_RATE);
      const decoded = await context.decodeAudioData(buffer);
      const peaks = computeSpectrogram(decoded.getChannelData(0));
      // Only the tracks in play are worth keeping in memory on an older iPad.
      if (trackPeaksRef.current.size > 12) trackPeaksRef.current.clear();
      trackPeaksRef.current.set(source, peaks);
      return peaks;
    } catch (error) {
      console.warn('Could not read levels for the visualizer:', error);
      return null;
    } finally {
      peakWorkRef.current.delete(source);
    }
  };

  const trackSource = trackRef => (
    isManagedAudioRef(trackRef) ? (managedSources[trackRef] || '') : trackRef
  );
  const bgTrackSource = trackSource(bgTrack);

  useEffect(() => {
    let cancelled = false;
    bgPeaksRef.current = null;
    if (!bgTrackSource) return undefined;
    loadTrackPeaks(bgTrackSource).then(peaks => {
      if (!cancelled) bgPeaksRef.current = peaks;
    });
    return () => { cancelled = true; };
  }, [bgTrackSource]);

  useEffect(() => {
    let cancelled = false;
    perfPeaksRef.current = null;
    const source = currentPerformance === null ? '' : trackSource(perfTracks[currentPerformance]);
    if (!source) return undefined;
    loadTrackPeaks(source).then(peaks => {
      if (!cancelled) perfPeaksRef.current = peaks;
    });
    return () => { cancelled = true; };
  }, [currentPerformance, perfTracks, managedSources]);

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
    setLoopCurrentTrack(false);
    showNotice(mode === 'next' ? 'Track added next.' : 'Track added to the BGM queue.');
  };

  const removeBackgroundTrack = async (index) => {
    const result = removePlaylistItem({
      playlist: bgPlaylist,
      index,
      currentIndex: bgIndex,
      lockedIndex: currentPerformance !== null ? bgIndex : null,
    });
    if (!result.changed) return;
    if (index === bgIndex && bgPlaying) {
      await pauseClicklessly(
        bgAudioRef.current,
        routedBgGain(),
        AUDIO_TRANSITION_SECONDS.handoffOut,
      );
    }
    if (index === bgIndex) setLoopCurrentTrack(false);
    setBgPlaylist(result.playlist);
    setBgIndex(result.currentIndex);
    if (result.playlist.length === 0) {
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

    clearBackgroundTail();
    const ready = await ensureAudioReady();
    if (!ready) {
      setShowError('DreamLIVE audio is paused by the device. Tap Play again.');
      setShowPhase(SHOW_PHASE.ERROR);
      return false;
    }

    if (ROUTE_AUDIO_THROUGH_WEB_AUDIO && audioContextRef.current && !bgSourceNodeRef.current) {
      try {
        const source = audioContextRef.current.createMediaElementSource(audio);
        source.connect(bgGainNodeRef.current);
        bgSourceNodeRef.current = source;
      } catch (error) {
        console.warn('Background audio connection failed:', error);
      }
    }

    const bgGain = routedBgGain();
    if (bgGain) {
      audio.volume = 1;
      muteGain(bgGain);
    } else {
      audio.volume = 0;
    }
    const ok = await playSafely(audio, 'background music');
    if (ok) {
      setBgPlaying(true);
      setShowError('');
      fadeGainTo(bgGain, bgVolumeRef.current, START_FADE);
      if (!bgGain) {
        await fadeElementVolume(audio, bgVolumeRef.current, START_FADE);
      }
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
      await pauseClicklessly(bgAudioRef.current, routedBgGain());
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
      loopCurrent: loopCurrentTrack,
    });
    if (next === null) {
      if (event?.type !== 'ended') {
        await pauseClicklessly(bgAudioRef.current, routedBgGain());
      }
      setBgPlaying(false);
      return;
    }

    if (event?.type === 'ended') {
      muteGain(routedBgGain());
    } else {
      await pauseClicklessly(bgAudioRef.current, routedBgGain());
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
    await pauseClicklessly(
      bgAudioRef.current,
      routedBgGain(),
      AUDIO_TRANSITION_SECONDS.handoffOut,
    );
    setBgPlaying(true);
    setBgIndex(index);
  };

  const queueBackgroundForReturn = index => {
    const track = bgPlaylist[index];
    if (!track || currentPerformance === null) return;
    const promoted = queuePlaylistItemNext({
      playlist: bgPlaylist,
      index,
      currentIndex: bgIndex,
    });
    if (promoted.changed) {
      setBgPlaylist(promoted.playlist);
      setBgIndex(promoted.currentIndex);
    }
    pendingBgTrackRef.current = track;
    resumeQueuedBgRef.current = false;
    setPendingBgTrack(track);
    setLoopCurrentTrack(false);
    showNotice(`${trackName(track)} will play after this performance.`);
  };

  useEffect(() => {
    if (!bgPlaying || currentPerformance !== null || !bgTrack || !bgTrackSource) return;
    if (!bgAudioRef.current) return;
    bgAudioRef.current.load();
    // A track queued during a performance owes the room the same fade back in
    // as any other return; a plain play() would drop it in at full level.
    if (resumeQueuedBgRef.current) {
      resumeQueuedBgRef.current = false;
      startBackgroundWithFade().catch(() => setIsFading(false));
      return;
    }
    playBackgroundAudio();
  }, [bgTrack, bgTrackSource, currentPerformance, bgPlaying]);

  const previewBgVolume = value => {
    const newVolume = Number.parseFloat(value);
    bgVolumeRef.current = newVolume;
    const bgGain = routedBgGain();
    if (bgGain) {
      const context = audioContextRef.current;
      if (context) {
        setGainImmediately(bgGain.gain, {
          currentTime: context.currentTime,
          target: newVolume,
        });
      } else {
        bgGain.gain.value = newVolume;
      }
      if (bgAudioRef.current) bgAudioRef.current.volume = 1;
    } else if (bgAudioRef.current) {
      bgAudioRef.current.volume = newVolume;
    }
  };

  const commitBgVolume = value => {
    previewBgVolume(value);
    setBgVolume(Number.parseFloat(value));
  };

  // Performance volume control
  const previewPerfVolume = (index, value) => {
    const newVolume = Number.parseFloat(value);
    perfVolumesRef.current[index] = newVolume;
    const perfGain = routedPerfGain(index);
    if (perfGain) {
      const context = audioContextRef.current;
      if (context) {
        setGainImmediately(perfGain.gain, {
          currentTime: context.currentTime,
          target: newVolume,
        });
      } else {
        perfGain.gain.value = newVolume;
      }
      if (perfAudioRefs.current[index]) perfAudioRefs.current[index].volume = 1;
    } else if (perfAudioRefs.current[index]) {
      perfAudioRefs.current[index].volume = newVolume;
    }
  };

  const commitPerfVolume = (index, value) => {
    previewPerfVolume(index, value);
    setPerfVolumes(previous => previous.map((volume, trackIndex) => (
      trackIndex === index ? Number.parseFloat(value) : volume
    )));
  };

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

  const clearBackgroundTail = () => {
    if (bgTailTimeoutRef.current) {
      window.clearTimeout(bgTailTimeoutRef.current);
      bgTailTimeoutRef.current = null;
    }
  };

  const fadeOutBackground = async () => {
    if (!bgAudioRef.current || !bgPlaying) return;
    setIsFading(true);
    clearBackgroundTail();
    const audio = bgAudioRef.current;
    const gainNode = routedBgGain();
    const duration = AUDIO_TRANSITION_SECONDS.handoffOut;
    const lead = handoffLeadSeconds({ out: duration });
    await pauseClicklessly(audio, gainNode, duration, { holdSeconds: lead });
    // The room still hears the tail; only silence the node once it is spent.
    bgTailTimeoutRef.current = window.setTimeout(() => {
      bgTailTimeoutRef.current = null;
      muteGain(gainNode);
    }, Math.max(0, (duration - lead) * 1000) + 24);
    setBgPlaying(false);
    setIsFading(false);
  };

  // Last line of defence for "the room went quiet after a performance". Every
  // return path above is expected to work; this one only fires when none of
  // them did, and it starts the queue's current track rather than nothing.
  const scheduleRoomAudioBackstop = () => {
    if (roomBackstopTimeoutRef.current) window.clearTimeout(roomBackstopTimeoutRef.current);
    roomBackstopTimeoutRef.current = window.setTimeout(async () => {
      roomBackstopTimeoutRef.current = null;
      const playback = playbackStateRef.current;
      if (playback.currentPerformance !== null) return;
      if (bgPlaylistRef.current.length === 0) return;
      const audio = bgAudioRef.current;
      if (audio && !audio.paused) return;
      resumeQueuedBgRef.current = true;
      setBgPlaying(true);
      setBgIndex(previous => {
        const last = bgPlaylistRef.current.length - 1;
        return Math.min(Math.max(previous, 0), last);
      });
      if (audio && audio.src) {
        try { await startBackgroundWithFade(); } catch (error) { /* the effect retries */ }
      }
    }, (AUDIO_TRANSITION_SECONDS.handoffIn * 1000) + 900);
  };

  const startBackgroundWithFade = async () => {
    const audio = bgAudioRef.current;
    if (!audio) return;
    const ready = await ensureAudioReady();
    if (!ready) throw new Error('DreamLIVE audio couldn’t resume. Tap Play in BGM again.');

    const returningGain = routedBgGain();
    if (returningGain && audioContextRef.current) {
      audio.volume = 1;
      muteGain(returningGain);
      const ok = await playSafely(audio, 'background music');
      if (!ok) throw new Error('BGM couldn’t resume. Tap Play in the BGM controls.');
      setBgPlaying(true);
      fadeGainTo(returningGain, bgVolumeRef.current, AUDIO_TRANSITION_SECONDS.handoffIn);
      const completed = await waitForFade((AUDIO_TRANSITION_SECONDS.handoffIn * 1000) + 8);
      if (!completed) throw new Error('Transition cancelled.');
    } else {
      audio.volume = 0;
      const ok = await playSafely(audio, 'background music');
      if (!ok) throw new Error('BGM couldn’t resume. Tap Play in the BGM controls.');
      setBgPlaying(true);
      await fadeElementVolume(audio, bgVolumeRef.current, AUDIO_TRANSITION_SECONDS.handoffIn);
    }
    setIsFading(false);
  };

  const fadeInBackground = async () => {
    if (!bgAudioRef.current) return;
    // The room never drops to silence between performances. If no BGM track is
    // selected but the queue has one, take the queue's current track.
    if (!bgTrack && bgPlaylist.length > 0) {
      resumeQueuedBgRef.current = true;
      setBgPlaying(true);
      setBgIndex(Math.min(Math.max(bgIndex, 0), bgPlaylist.length - 1));
      return;
    }
    if (!bgTrack) return;
    setIsFading(true);
    clearBackgroundTail();
    const pendingIndex = bgPlaylist.indexOf(pendingBgTrackRef.current);
    pendingBgTrackRef.current = '';
    setPendingBgTrack('');
    if (pendingIndex >= 0 && pendingIndex !== bgIndex) {
      // The queued track is a different file, so it has to load before it can
      // be faded up. Record the intent and let the effect below finish the job
      // once the source is attached and the stage is clear.
      resumeQueuedBgRef.current = true;
      setBgPlaying(true);
      setBgIndex(pendingIndex);
      return;
    }
    await startBackgroundWithFade();
  };

  // The room comes back UNDER the outgoing tail, not after it. Both endings -
  // finishing early and a track running out - call this, and it only ever runs
  // once per performance, so the later `ended` event cannot restart the fade.
  const returnBackground = async () => {
    if (bgReturnStartedRef.current) return;
    bgReturnStartedRef.current = true;
    await fadeInBackground();
  };
  returnBackgroundRef.current = returnBackground;

  const playPerformanceTrack = async (index) => {
    setCurrentPerformance(index);
    const audio = perfAudioRefs.current[index];
    if (!audio) throw new Error(`Performance ${index + 1} is not available.`);

    if (ROUTE_AUDIO_THROUGH_WEB_AUDIO && audioContextRef.current && !perfSourceNodeRefs.current[index]) {
      try {
        const source = audioContextRef.current.createMediaElementSource(audio);
        source.connect(ensurePerformanceGain(index));
        perfSourceNodeRefs.current[index] = source;
      } catch (error) {
        console.warn('Performance audio connection failed:', error);
      }
    }

    ensurePerformanceGain(index);
    const perfGain = routedPerfGain(index);
    const target = perfVolumesRef.current[index];
    audio.currentTime = 0;
    audio.volume = perfGain ? 1 : 0;
    muteGain(perfGain);
    const ready = await ensureAudioReady();
    if (!ready) throw new Error('DreamLIVE audio couldn’t start. Tap Start again.');
    const ok = await playSafely(audio, `Performance ${index + 1}`);
    if (!ok) throw new Error(`Performance ${index + 1} couldn’t start. Check the track, then try again.`);

    // The stage is live the moment the track starts. Awaiting the fade here
    // held the visualizer and the live controls back for the whole fade length.
    setPerfPlaying(previous => previous.map((playing, trackIndex) => (
      trackIndex === index ? true : playing
    )));
    fadeGainTo(perfGain, target, START_FADE);
    if (!perfGain) {
      void fadeElementVolume(audio, target, START_FADE);
    }
  };

  // Start performance through one ordered, test-covered show flow.
  const startPerformance = async (index) => {
    if (!trackSource(perfTracks[index]) || currentPerformance !== null || isFading || transitionLockRef.current) return;
    transitionLockRef.current = true;
    setShowError('');
    if (roomBackstopTimeoutRef.current) {
      window.clearTimeout(roomBackstopTimeoutRef.current);
      roomBackstopTimeoutRef.current = null;
    }
    endFadeStartedRef.current[index] = false;
    bgReturnStartedRef.current = false;
    setCurrentPerformance(index);
    setPerformanceStatus(previous => previous.map((done, trackIndex) => (
      trackIndex === index ? false : done
    )));
    try {
      await startPerformanceFlow({
        lowerBackground: fadeOutBackground,
        playPerformance: () => playPerformanceTrack(index),
        restoreBackground: returnBackground,
        onPhase: setShowPhase,
      });
      setLineupCommitted(true);
      setPerformanceOrder(previous => promotePerformanceOrder({
        order: previous,
        activeIndex: index,
        completed: performanceStatus,
      }));
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
      await pauseClicklessly(audio, routedPerfGain(index));
      setPerfPlaying(previous => previous.map((playing, trackIndex) => (
        trackIndex === index ? false : playing
      )));
      setShowPhase(SHOW_PHASE.PAUSED);
      return;
    }

    // A resumed context can repeat the warm-up, so mute then fade here too.
    endFadeStartedRef.current[index] = false;
    ensurePerformanceGain(index);
    const perfGain = routedPerfGain(index);
    await ensureAudioReady();
    muteGain(perfGain);
    if (!perfGain) audio.volume = 0;
    const ok = await playSafely(audio, `Performance ${index + 1}`);
    if (ok) {
      setPerfPlaying(previous => previous.map((playing, trackIndex) => (
        trackIndex === index ? true : playing
      )));
      fadeGainTo(perfGain, perfVolumesRef.current[index], RESUME_FADE);
      if (!perfGain) {
        void fadeElementVolume(audio, perfVolumesRef.current[index], RESUME_FADE);
      }
      setShowPhase(SHOW_PHASE.LIVE);
    } else if (perfGain) {
      fadeGainTo(perfGain, perfVolumesRef.current[index], 0);
    }
  };

  // Handle performance end
  const handlePerformanceEnd = async (index) => {
    endFadeStartedRef.current[index] = false;
    setPerfPlaying(previous => previous.map((playing, trackIndex) => (
      trackIndex === index ? false : playing
    )));
    const completion = resolvePerformanceCompletion({
      assignments: perfTracks.map(Boolean),
      completed: performanceStatus,
      finishedIndex: index,
    });
    setPerformanceStatus(completion.completed);
    if (completion.cycleComplete) {
      perfAudioRefs.current.forEach((audio, trackIndex) => {
        if (!audio) return;
        if (trackIndex === index && !audio.paused) return;
        audio.currentTime = 0;
      });
      setPerfPlaying(performanceArray(false, perfTracks.length));
      setBgQueueExpanded(false);
    }

    setCurrentPerformance(null);
    setSelectedPerformanceIndex(null);
    scheduleRoomAudioBackstop();
    try {
      await finishPerformanceFlow({
        restoreBackground: returnBackground,
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
      // Ending a performance early is a handoff, not a stop button: it gets the
      // same long fade the room hears when a track runs to its end.
      setIsFading(true);
      await pauseClicklessly(
        perfAudioRefs.current[index],
        routedPerfGain(index),
        AUDIO_TRANSITION_SECONDS.handoffOut,
        { holdSeconds: handoffLeadSeconds() },
      );
      setIsFading(false);
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
        gainNode: routedPerfGain(index),
        value: time,
        restoreTo: perfVolumesRef.current[index],
        timeoutKey: 'perf',
        index,
      });
      setPerfProgress(previous => previous.map((progress, trackIndex) => (
        trackIndex === index ? time : progress
      )));
    }
  };

  const beginPerformanceSeek = index => {
    performanceSeekingRef.current[index] = true;
    const releaseTimer = performanceSeekReleaseRefs.current[index];
    if (releaseTimer) window.clearTimeout(releaseTimer);
  };

  const finishPerformanceSeek = index => {
    const releaseTimer = performanceSeekReleaseRefs.current[index];
    if (releaseTimer) window.clearTimeout(releaseTimer);
    performanceSeekReleaseRefs.current[index] = window.setTimeout(() => {
      performanceSeekingRef.current[index] = false;
      performanceSeekReleaseRefs.current[index] = null;
    }, (CLICKLESS_MUTE_SECONDS * 1000) + 32);
  };

  const clearPerformanceCues = async () => {
    await Promise.all(perfAudioRefs.current.map((audio, index) => (
      pauseClicklessly(audio, routedPerfGain(index))
    )));
    perfAudioRefs.current.forEach(audio => {
      if (audio) audio.currentTime = 0;
    });
    perfSourceNodeRefs.current.slice(DEFAULT_PERFORMANCE_COUNT).forEach(source => source?.disconnect());
    perfGainNodeRefs.current.slice(DEFAULT_PERFORMANCE_COUNT).forEach(gain => gain?.disconnect());
    perfAudioRefs.current = perfAudioRefs.current.slice(0, DEFAULT_PERFORMANCE_COUNT);
    perfGainNodeRefs.current = perfGainNodeRefs.current.slice(0, DEFAULT_PERFORMANCE_COUNT);
    perfSourceNodeRefs.current = perfSourceNodeRefs.current.slice(0, DEFAULT_PERFORMANCE_COUNT);
    setPerfTracks(performanceArray(''));
    setPerfPlaying(performanceArray(false));
    perfVolumesRef.current = performanceArray(0.8);
    setPerfVolumes(performanceArray(0.8));
    setPerfProgress(performanceArray(0));
    setPerfDurations(performanceArray(0));
    setPerformanceStatus(performanceArray(false));
    setPerformanceOrder(performanceArray(null).map((_, index) => index));
    setDraftPerformanceIndex(null);
    setLineupCommitted(false);
    // Keep each MediaElementSourceNode paired with its mounted <audio> element.
    // Recreating a source for a reused media element throws and can leave the
    // newly assigned track connected to a muted, abandoned gain node.
    seekTimeoutRefs.current.perf = performanceArray(null);
    performanceSeekingRef.current = performanceArray(false);
    performanceSeekReleaseRefs.current.forEach(timer => timer && window.clearTimeout(timer));
    performanceSeekReleaseRefs.current = performanceArray(null);
    setCurrentPerformance(null);
    setSelectedPerformanceIndex(null);
    setShowPhase(SHOW_PHASE.SETUP);
    setResetConfirmOpen(false);
    showNotice('Performances cleared. BGM queue and imported tracks were kept.');
  };

  const addPerformance = () => {
    const newIndex = perfTracks.length;
    setPerfTracks(previous => [...previous, '']);
    setPerfPlaying(previous => [...previous, false]);
    perfVolumesRef.current.push(0.8);
    setPerfVolumes(previous => [...previous, 0.8]);
    setPerfProgress(previous => [...previous, 0]);
    setPerfDurations(previous => [...previous, 0]);
    setPerformanceStatus(previous => [...previous, false]);
    setPerformanceOrder(previous => [...previous, previous.length]);
    perfAudioRefs.current.push(null);
    perfGainNodeRefs.current.push(null);
    perfSourceNodeRefs.current.push(null);
    seekTimeoutRefs.current.perf.push(null);
    performanceSeekingRef.current.push(false);
    performanceSeekReleaseRefs.current.push(null);
    setDraftPerformanceIndex(newIndex);
    showNotice('Performance added.');
  };

  // Adding a set is one action: every chosen track becomes its own slot, in
  // the order they were picked.
  const addPerformances = (paths) => {
    const tracks = paths.filter(Boolean);
    if (tracks.length === 0) return;
    const startIndex = perfTracks.length;
    setPerfTracks(previous => [...previous, ...tracks]);
    setPerfPlaying(previous => [...previous, ...tracks.map(() => false)]);
    tracks.forEach(() => perfVolumesRef.current.push(0.8));
    setPerfVolumes(previous => [...previous, ...tracks.map(() => 0.8)]);
    setPerfProgress(previous => [...previous, ...tracks.map(() => 0)]);
    setPerfDurations(previous => [...previous, ...tracks.map(() => 0)]);
    setPerformanceStatus(previous => [...previous, ...tracks.map(() => false)]);
    setPerformanceOrder(previous => [...previous, ...tracks.map((_, offset) => startIndex + offset)]);
    tracks.forEach(() => {
      perfAudioRefs.current.push(null);
      perfGainNodeRefs.current.push(null);
      perfSourceNodeRefs.current.push(null);
      seekTimeoutRefs.current.perf.push(null);
      performanceSeekingRef.current.push(false);
      performanceSeekReleaseRefs.current.push(null);
    });
    setDraftPerformanceIndex(null);
    showNotice(`Added ${tracks.length} performance${tracks.length === 1 ? '' : 's'}.`);
  };

  const updatePerformanceTrack = (index, value) => {
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
    if (value && draftPerformanceIndex === index) setDraftPerformanceIndex(null);
    if (currentPerformance === null) setSelectedPerformanceIndex(value ? index : null);
  };

  const restartDreamLive = async () => {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;
    const shouldRestoreBackground = currentPerformance !== null && Boolean(bgTrack);
    try {
      await Promise.all(perfAudioRefs.current.map((audio, index) => (
        pauseClicklessly(audio, routedPerfGain(index))
      )));
      perfAudioRefs.current.forEach(audio => {
        if (audio) audio.currentTime = 0;
      });
      pendingBgTrackRef.current = '';
      setPendingBgTrack('');
      setPerfPlaying(previous => previous.map(() => false));
      setPerfProgress(previous => previous.map(() => 0));
      setPerformanceStatus(previous => previous.map(() => false));
      setDraftPerformanceIndex(null);
      setCurrentPerformance(null);
      setSelectedPerformanceIndex(null);
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
      if (removed.has(bgTrack) && bgPlaying) {
        await pauseClicklessly(
          bgAudioRef.current,
          routedBgGain(),
          AUDIO_TRANSITION_SECONDS.handoffOut,
        );
      }
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
        if (bgAudioRef.current) bgAudioRef.current.currentTime = 0;
        setBgPlaying(reconciled.playlist.length > 0 && bgPlaying);
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
  const dreamLiveComplete = isPerformanceCycleComplete({
    assignments: perfTracks.map(Boolean),
    completed: performanceStatus,
  });
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
  const runDeck = shouldShowRunDeck({
    mode: deckState.mode,
    hasAudio: audioFiles.length > 0,
  });
  const selectedReadyPerformance = selectedPerformanceIndex !== null
    && Boolean(perfTracks[selectedPerformanceIndex])
    && !performanceStatus[selectedPerformanceIndex]
    ? selectedPerformanceIndex
    : (performanceOrder.find(index => (
      Boolean(perfTracks[index])
      && !performanceStatus[index]
      && index !== currentPerformance
    )) ?? deckState.nextPerformanceIndex);
  const focusPerformanceIndex = deckState.activePerformanceIndex ?? selectedReadyPerformance;
  const visiblePerformanceIndexes = visiblePerformanceOrder({
    order: performanceOrder,
    assignments: perfTracks,
    hasStarted: hasPerformanceHistory || lineupCommitted,
    draftIndex: draftPerformanceIndex,
  });

  useEffect(() => {
    setBgQueueExpanded(!isPortraitLayout || (assignedCount === 0 && currentPerformance === null));
  }, [assignedCount, currentPerformance, isPortraitLayout]);

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
        onRemove={paths => requestLibraryRemoval(Array.isArray(paths) ? paths : [paths])}
        onClear={() => requestLibraryRemoval(audioFiles.map(file => file.path))}
        onClose={() => setLibraryOpen(false)}
        folderState={folderState}
        onMoveToFolder={moveTracksToFolder}
        onCreateFolder={name => setFolderState(previous => createFolder(previous, name))}
        onRenameFolder={(from, to) => setFolderState(previous => renameFolder(previous, from, to))}
        onDeleteFolder={name => setFolderState(previous => deleteFolder(previous, name))}
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
          <main className={`show-workspace deck-${deckState.mode} ${runDeck ? 'run-deck is-setup-open' : ''} ${audioFiles.length === 0 ? 'is-library-empty' : ''} ${currentPerformance !== null ? 'is-live' : ''} ${bgPlaying && currentPerformance === null ? 'is-bgm-active' : ''} ${bgQueueExpanded ? 'is-bgm-expanded' : ''} ${currentPerformance !== null && (perfPlaying[currentPerformance] || isFading) ? 'is-visualizing' : ''}`}>
            <section className={`background-section split-layout ${bgPlaying ? 'is-playing' : ''} ${currentPerformance !== null || isFading ? 'is-held' : ''} ${bgQueueExpanded ? 'queue-expanded' : 'queue-collapsed'}`}>
              <div className="section-header">
                {runDeck && isPortraitLayout ? (
                  <button
                    type="button"
                    className="section-title bgm-header-toggle"
                    onClick={() => setBgQueueExpanded(expanded => !expanded)}
                    aria-expanded={bgQueueExpanded}
                    aria-controls="dreamlive-bgm-queue"
                    aria-label={`${bgQueueExpanded ? 'Collapse' : 'Expand'} BGM playlist`}
                  >
                    <span className="bgm-header-expand-cue" aria-hidden="true">
                      <ChevronDown size={15} />
                    </span>
                    <span className="bgm-header-title">BGM <span className="japanese-label">バックグラウンド</span></span>
                  </button>
                ) : (
                  <h2 className="section-title bgm-header-static">BGM <span className="japanese-label">バックグラウンド</span></h2>
                )}
                <div className="bgm-header-actions">
                  <details className="bgm-level-menu bgm-header-level">
                    <summary aria-label={`BGM level ${Math.round(bgVolume * 100)} percent`}>
                      <Volume2 size={15} aria-hidden="true" />
                      <span>{Math.round(bgVolume * 100)}%</span>
                    </summary>
                    <label className="bgm-level-control">
                      <StableVolumeSlider
                        value={bgVolume}
                        ariaLabel="BGM volume"
                        onPreview={previewBgVolume}
                        onCommit={commitBgVolume}
                      />
                    </label>
                  </details>
                </div>
              </div>
              {audioFiles.length === 0 && (
                <div className="library-inline-state">
                  <FolderOpen size={20} />
                  <div>
                    <strong>Waiting for your soundtrack</strong>
                    <span>Imported audio becomes your BGM queue.</span>
                  </div>
                </div>
              )}
              <div id="dreamlive-bgm-queue" className="bg-music-container">
                {runDeck && (
                  <div className={`bgm-visualizer-slot ${bgPlaying && currentPerformance === null ? 'is-active' : ''}`}>
                    <AudioVisualizer
                      analyserRef={analyserNodeRef}
                      peaksRef={bgPeaksRef}
                      sourceRef={bgAudioRef}
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
                  collapsed={runDeck && !bgQueueExpanded}
                  playing={bgPlaying}
                  loopCurrent={loopCurrentTrack}
                  showPlayback={runDeck}
                  trackName={trackName}
                  onPlay={playBackgroundFrom}
                  onQueue={queueBackgroundForReturn}
                  onToggle={toggleBackgroundMusic}
                  onMove={moveBackgroundTrack}
                  onRemove={removeBackgroundTrack}
                  onShuffle={shuffleBackgroundTracks}
                  onToggleLoop={() => setLoopCurrentTrack(active => !active)}
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

            <section className={`performances-section ${currentPerformance !== null ? 'is-stage-active' : ''} ${audioFiles.length === 0 ? 'is-library-empty' : ''}`}>
              {audioFiles.length === 0 && (
                <div className="dreamlive-empty-stage">
                  <SakuraDrift />
                  <div className="empty-stage-copy">
                    <span className="empty-stage-kicker">
                      DREAMLIVE READY <span className="japanese-label">開演準備</span>
                    </span>
                    <h2>Let the show begin.</h2>
                    <p>Bring in your licensed tracks, then shape the room soundtrack and performance lineup in one effortless flow.</p>
                    <button
                      type="button"
                      className="empty-stage-import"
                      onClick={() => handleSelectFolder({ autoQueue: true })}
                      disabled={importState.active}
                    >
                      <FolderOpen size={17} />
                      <span>{importState.active ? `Checking ${importState.completed}/${importState.total}` : 'Import audio'}</span>
                    </button>
                  </div>
                  <div className="empty-stage-spectrum" aria-hidden="true" />
                  <div className="empty-stage-flow" aria-hidden="true">
                    <span>BGM</span><i /><span>PERFORMANCE</span><i /><span>SHOWTIME</span>
                  </div>
                </div>
              )}
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
              <div className={`run-focus-panel mode-${deckState.mode} ${deckState.activePerformanceIndex !== null ? 'has-active-performance' : ''} ${dreamLiveComplete ? 'is-complete' : ''}`}>
                <SakuraDrift />
                {dreamLiveComplete ? (
                  <div className="run-complete-state">
                    <span className="run-focus-kicker">
                      Complete <span className="japanese-label">終演</span>
                    </span>
                    <h2>That’s a wrap!</h2>
                    <p>DreamLIVE is complete.</p>
                    <button
                      type="button"
                      className="run-primary-action complete-restart-button"
                      onClick={restartDreamLive}
                      disabled={isFading}
                    >
                      <RotateCcw size={15} />
                      <span>Restart Dream Live</span>
                    </button>
                  </div>
                ) : deckState.mode === 'live' && focusPerformanceIndex !== null ? (
                  <>
                    <div className="run-focus-heading">
                      <div>
                        <span className="run-focus-kicker">
                          {isFading
                            ? <>Transition <span className="japanese-label">トランジション中</span></>
                            : (showPhase === SHOW_PHASE.PAUSED
                              ? <>Paused <span className="japanese-label">ポーズ中</span></>
                              : <>Now Performing <span className="japanese-label">パフォーマンス中</span></>)}
                        </span>
                        <h2 title={trackName(perfTracks[focusPerformanceIndex])}>{trackName(perfTracks[focusPerformanceIndex])}</h2>
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
                        className={`run-primary-action ${perfPlaying[focusPerformanceIndex] ? 'is-pause' : 'is-resume'}`}
                        onClick={() => togglePerfPause(focusPerformanceIndex)}
                        disabled={isFading}
                        aria-label={perfPlaying[focusPerformanceIndex] ? 'Pause performance' : 'Resume performance'}
                        title={perfPlaying[focusPerformanceIndex] ? 'Pause' : 'Resume'}
                      >
                        {perfPlaying[focusPerformanceIndex] ? <Pause size={18} /> : <Play size={18} />}
                        <span>
                          {perfPlaying[focusPerformanceIndex] ? 'Pause' : 'Resume'}
                          <span className="action-qualifier"> Performance</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="control-button run-end-button"
                        onClick={() => endPerformance(focusPerformanceIndex)}
                        disabled={isFading}
                        aria-label="Finish performance"
                      >
                        <Square size={14} fill="currentColor" />
                        <span>Finish</span>
                      </button>
                      <details className="run-level-menu">
                        <summary aria-label={`Performance level ${Math.round(perfVolumes[focusPerformanceIndex] * 100)} percent`}>
                          <Volume2 size={17} aria-hidden="true" />
                          <span>{Math.round(perfVolumes[focusPerformanceIndex] * 100)}%</span>
                        </summary>
                        <label className="run-level-control">
                          <StableVolumeSlider
                            value={perfVolumes[focusPerformanceIndex]}
                            ariaLabel="Live performance volume"
                            onPreview={value => previewPerfVolume(focusPerformanceIndex, value)}
                            onCommit={value => commitPerfVolume(focusPerformanceIndex, value)}
                          />
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
                        onPointerDown={() => beginPerformanceSeek(focusPerformanceIndex)}
                        onChange={event => handleSeek(focusPerformanceIndex, event.target.value)}
                        onPointerUp={() => finishPerformanceSeek(focusPerformanceIndex)}
                        onPointerCancel={() => finishPerformanceSeek(focusPerformanceIndex)}
                        onKeyDown={() => beginPerformanceSeek(focusPerformanceIndex)}
                        onKeyUp={() => finishPerformanceSeek(focusPerformanceIndex)}
                        onBlur={() => finishPerformanceSeek(focusPerformanceIndex)}
                        disabled={!perfDurations[focusPerformanceIndex]}
                        aria-label={`Seek performance ${focusPerformanceIndex + 1}`}
                      />
                      <span>{formatTime(perfDurations[focusPerformanceIndex])}</span>
                    </div>
                    <div className="run-signal-strip">
                      <AudioVisualizer
                        analyserRef={analyserNodeRef}
                        peaksRef={perfPeaksRef}
                        sourceRef={{ current: perfAudioRefs.current[focusPerformanceIndex] }}
                        active={perfPlaying[focusPerformanceIndex] || isFading}
                        variant="focus"
                        status={isFading
                          ? 'Transitioning'
                          : (perfPlaying[focusPerformanceIndex] ? 'Live' : 'Paused')}
                      />
                    </div>
                  </>
                ) : focusPerformanceIndex !== null ? (
                  <>
                    <div className="run-focus-heading ready-heading">
                      <div>
                        <span className="run-focus-kicker">Next on stage <span className="japanese-label">ネクストステージ</span></span>
                        <h2 title={trackName(perfTracks[focusPerformanceIndex])}>{trackName(perfTracks[focusPerformanceIndex])}</h2>
                      </div>
                    </div>
                    <div className="run-action-row">
                      <button
                        type="button"
                        className="run-primary-action is-start"
                        onClick={() => startPerformance(focusPerformanceIndex)}
                        disabled={isFading || !trackSource(perfTracks[focusPerformanceIndex])}
                      >
                        <Play size={18} />
                        <span>
                          Start<span className="action-qualifier"> Performance</span>!
                        </span>
                      </button>
                      <details className="run-level-menu">
                        <summary aria-label={`Performance level ${Math.round(perfVolumes[focusPerformanceIndex] * 100)} percent`}>
                          <Volume2 size={17} aria-hidden="true" />
                          <span>{Math.round(perfVolumes[focusPerformanceIndex] * 100)}%</span>
                        </summary>
                        <label className="run-level-control">
                          <StableVolumeSlider
                            value={perfVolumes[focusPerformanceIndex]}
                            ariaLabel="Next performance volume"
                            onPreview={value => previewPerfVolume(focusPerformanceIndex, value)}
                            onCommit={value => commitPerfVolume(focusPerformanceIndex, value)}
                          />
                        </label>
                      </details>
                    </div>
                    <div className="run-progress is-idle">
                      <span>0:00</span>
                      <input
                        type="range"
                        min="0"
                        max={perfDurations[focusPerformanceIndex] || 1}
                        value="0"
                        disabled
                        aria-label={`Performance ${focusPerformanceIndex + 1} ready`}
                      />
                      <span>{formatTime(perfDurations[focusPerformanceIndex])}</span>
                    </div>
                  </>
                ) : (
                  <div className="run-empty-state">
                    <span className="run-focus-kicker">Stage ready <span className="japanese-label">ステージ準備</span></span>
                    <h2>Not assigned</h2>
                    <p>Choose a track in the lineup below.</p>
                  </div>
                )}
              </div>
            )}
            {runDeck && (
              <div className="run-setup-header">
                <span>Lineup <span className="japanese-label">ラインナップ</span></span>
                <div className="lineup-header-actions">
                  {hasPerformanceHistory && !dreamLiveComplete && (
                    <button
                      type="button"
                      className="control-button restart-dreamlive-button"
                      onClick={restartDreamLive}
                      disabled={isFading}
                      title="Reset every performance to the beginning"
                    >
                      <RotateCcw size={14} />
                      <span>Restart<span className="action-qualifier"> Dream Live</span></span>
                    </button>
                  )}
                  {!dreamLiveComplete && (
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
                  )}
                </div>
              </div>
            )}
            <div className="performances-grid">
              {visiblePerformanceIndexes.map((index, position) => (
                <motion.div
                  key={index}
                  layout="position"
                  transition={{ layout: { duration: 0.26, ease: [0.16, 1, 0.3, 1] } }}
                  className={`performance-card ${currentPerformance === index ? 'active' : ''
                    } ${currentPerformance === null && focusPerformanceIndex === index && !performanceStatus[index] ? 'is-focused' : ''
                    } ${performanceStatus[index] ? 'completed' : ''} ${perfTracks[index] ? '' : 'is-empty'}`}
                  aria-label={`Performance ${position + 1}`}
                >
                  <div className="perf-header">
                    <div className="perf-number">{String(position + 1).padStart(2, '0')}</div>
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

                  <div className={`perf-select ${perfTracks[index] ? 'is-assigned' : ''} ${performanceStatus[index] ? 'is-completed' : ''}`}>
                    {perfTracks[index] && (
                      <button
                        type="button"
                        className="perf-track-focus"
                        onClick={() => setSelectedPerformanceIndex(index)}
                        disabled={currentPerformance !== null || performanceStatus[index] || isFading}
                        aria-label={`Select performance ${position + 1}: ${trackName(perfTracks[index])}`}
                        aria-pressed={currentPerformance === null && focusPerformanceIndex === index}
                      >
                        <span>{trackName(perfTracks[index])}</span>
                      </button>
                    )}
                    {currentPerformance === index ? (
                      <div className={`perf-playing-label ${perfPlaying[index] ? '' : 'is-paused'}`} aria-label={perfPlaying[index] ? 'Playing' : 'Paused'}>
                        <span aria-hidden="true" />
                        {perfPlaying[index] ? 'Playing' : 'Paused'}
                      </div>
                    ) : performanceStatus[index] ? (
                      <div className="perf-completed-label" aria-label="Completed performance">
                        <Check size={12} />
                        <span>Completed performance</span>
                      </div>
                    ) : (
                      <SearchableSelect
                        value={perfTracks[index]}
                        onChange={(value) => updatePerformanceTrack(index, value)}
                        onRemove={() => updatePerformanceTrack(index, '')}
                        options={filesInFolder(audioFiles, folderState, performanceFolder).map(file => ({
                          value: file.path,
                          label: displayTrackName(file.name)
                        }))}
                        placeholder="Not assigned"
                        disabled={currentPerformance === index}
                        triggerClassName={perfTracks[index] ? 'is-track-change' : 'is-track-empty'}
                        triggerAriaLabel={perfTracks[index]
                          ? `More options for performance ${position + 1}`
                          : `Assign track to performance ${position + 1}`}
                        compactActions={Boolean(perfTracks[index])}
                        menuWidth={320}
                        menuAlign={perfTracks[index] ? 'end' : 'start'}
                        folders={performanceFolderChips}
                        folderValue={performanceFolder}
                        onFolderChange={setPerformanceFolder}
                      />
                    )}
                  </div>

                  <span className="perf-duration" aria-hidden={!perfTracks[index]}>
                    {perfTracks[index] ? formatTime(perfDurations[index]) : ''}
                  </span>

                  <audio
                    ref={el => perfAudioRefs.current[index] = el}
                    src={trackSource(perfTracks[index]) || undefined}
                    preload="metadata"
                    onEnded={() => handlePerformanceEnd(index)}
                    onLoadedMetadata={() => handleLoadedMetadata(index)}
                  />
                </motion.div>
              ))}
              <div className="add-performance-row">
                <SearchableSelect
                  value=""
                  onChange={() => {}}
                  options={filesInFolder(audioFiles, folderState, performanceFolder).map(file => ({
                    value: file.path,
                    label: displayTrackName(file.name),
                  }))}
                  placeholder="Add performances"
                  triggerClassName="add-performance-trigger"
                  triggerAriaLabel="Add performances from your library"
                  menuWidth={340}
                  menuAlign="start"
                  folders={performanceFolderChips}
                  folderValue={performanceFolder}
                  onFolderChange={setPerformanceFolder}
                  multiple
                  confirmLabel="Add to lineup"
                  onConfirmMultiple={addPerformances}
                />
                <button type="button" className="add-performance-button" onClick={addPerformance}>
                  <Plus size={13} />
                  <span>Empty slot</span>
                </button>
              </div>
            </div>
            </section>
          </main>
        </>
      )}
    </div>
  );
}

export default App;
