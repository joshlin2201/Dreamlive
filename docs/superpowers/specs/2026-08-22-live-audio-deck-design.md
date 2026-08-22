# DreamLIVE Live Audio Deck Design

**Date:** 2026-08-22  
**Status:** Approved direction; written spec awaiting operator review  
**Release target:** DreamLive Pro 1.1.0 (7)

## Outcome

Give performers one calm, high-confidence audio deck that remains fast with hundreds of imported tracks. The BGM player must expose the controls needed during a live show. The performance focus player and BGM player must display the real mixed audio signal, not decorative animation.

Success means an employee can import a large library, find a track, build and manage the BGM queue, move backward or forward, pause or resume, seek, and identify the active source without leaving the playback surface.

## Chosen approach

Build a shared master-spectrum engine and render it at two densities:

- a compact spectrum inside the BGM player;
- a larger spectrum inside the focused performance player.

Both views read one `AnalyserNode` attached to the existing final Web Audio path. Only the active surface animates. A shared sampler prevents duplicate animation loops and duplicate audio processing.

The BGM player becomes a transport deck rather than a row of unrelated controls. It owns track identity, progress, previous/play-pause/next, repeat, level, library search, and queue management.

### Rejected alternatives

1. **Waveform-only display.** Elegant, but less useful for confirming live energy and frequency content from across the room.
2. **DAW-style mixer.** More detailed, but too dense for performers under pressure and unnecessary for a fixed BGM/performance handoff.

## Audio architecture

The existing graph remains the playback authority:

`BGM/performance source → channel gain → compressor → master gain → analyser → device output`

The analyser must not alter gain, routing, fades, or playback order. Use these settings as the starting contract:

- `fftSize: 256`;
- `smoothingTimeConstant: 0.82`;
- `minDecibels: -82`;
- `maxDecibels: -12`.

A `useAudioSpectrum` hook owns one reusable `Uint8Array` and one `requestAnimationFrame` loop. It samples at no more than 30 frames per second while BGM, a performance, a transition, or the test tone is active. It stops when the app is idle or backgrounded.

If Web Audio is unavailable, playback still works. The visualizer shows a quiet baseline and exposes an accessible `Audio visualization unavailable` status.

## Shared visualizer

Create one `AudioVisualizer` component with `compact` and `focus` variants.

- Draw 48 rounded vertical bands on a transparent canvas.
- Use the current Dreamland rose-to-lilac palette for BGM.
- Shift the active performance treatment toward rose and warm gold so the source change reads instantly.
- Use restrained bloom inside the bars; add no container border, glass panel, or ornamental card.
- Freeze to a low baseline when paused and decay smoothly when audio stops.
- Cap canvas pixel density at 2x and resize through `ResizeObserver`.
- Mark the canvas `aria-hidden`; nearby text states `BGM playing`, `Performance live`, `Paused`, or `Transitioning`.
- Under reduced motion, update a stable low-frequency/peak shape at a reduced rate instead of continuously dancing.

## BGM transport deck

The active BGM deck has four zones inside one surface.

### 1. Track identity and signal

Show the current track, the next queued track, playback status, compact spectrum, elapsed time, and duration. Long Japanese titles truncate visually but remain available to assistive technology and on hover.

### 2. Primary transport

Present one centered control cluster with 44-pixel minimum targets:

- Previous;
- Play or Pause;
- Next.

Previous restarts the current track when playback has advanced more than three seconds; otherwise it selects the previous queue item. Next follows the current repeat boundary. Disabled states must explain why through accessible labels or titles.

Place the progress scrubber directly below the transport. Seeking updates the mounted BGM element and its elapsed-time label. Keep repeat and BGM level secondary but visible.

### 3. Searchable library

Use one `Find track` action to open a responsive library panel. The panel contains:

- an immediately focused search field;
- a visible result count;
- a scrollable result list sized for hundreds of tracks;
- `Add next` and `Add to end` actions for each result;
- keyboard support for arrows, Enter, and Escape;
- an import action when no result exists.

Filter a memoized normalized index by title. Hundreds of records do not justify a new virtualization dependency; a bounded scroll region and memoized filtering are sufficient. Limit visible results to the first 100 matches and show the exact count so broad searches remain honest and fast.

### 4. Queue management

The queue remains separate from the full library. Each row shows position, title, current state, and compact actions:

- select `Play from here`;
- move earlier;
- move later;
- remove.

Selecting another queued track while BGM is playing uses the existing safe fade path, then resumes the selected track. While a performance is live, queue edits remain available but playback selection waits until BGM resumes. The current row stays visually distinct without a nested bordered card.

## Performance focus player

The large run-focus player keeps its current one-action hierarchy. Add the focus visualizer between the track title and progress scrubber. It reflects the audible performance signal during live playback, settles when paused, and shows the fade handoff during transitions.

The focus player retains:

- performance number and title;
- Live, Paused, or Starting state;
- elapsed time, scrubber, and duration;
- one large Pause or Resume action;
- the next cue preview.

Remove the duplicated `Next on stage ・ 次の出演` label while editing this surface.

## State and safety rules

- The visualizer follows the audible master signal; it never invents motion when audio is silent.
- BGM transport controls lock only during the short fade transition or when a performance owns the output.
- Queue edits never interrupt a live performance.
- Search and queue state never reset playback progress.
- Import retains the build-7 native fix: supported nonempty files enter the library immediately in Capacitor, while mounted players perform real media loading.
- A failed selected track stops that channel, names the track, and keeps the queue intact so the operator can choose Next.
- `Stop audio` remains the single emergency control and preserves setup.

## Responsive behavior

- **1366 and 1024 pixels:** track identity and spectrum share the upper player row; transport and progress span the player width; library and queue use a two-column management region when open.
- **768 pixels:** spectrum stays full width; transport remains centered; library opens as an attached sheet above the queue.
- **390 pixels:** track identity, spectrum, transport, progress, and secondary controls stack in that order. Previous, Play/Pause, and Next remain on one row. Queue actions use icon buttons with accessible names.

No breakpoint may create horizontal scrolling, detached popovers, or controls below the safe-area inset.

## Component boundaries

- `useAudioSpectrum`: samples and normalizes the analyser output.
- `AudioVisualizer`: renders compact or focus spectrum bars.
- `BgmTransport`: owns transport presentation and progress input.
- `AudioLibraryPanel`: searches the imported library and adds tracks to the queue.
- `BgmQueue`: selects, reorders, and removes queued tracks.
- `App`: remains the show-state and audio-routing owner.

Pure playlist helpers own previous-index, next-index, insertion, reorder, and select-from-queue rules so the live logic stays testable outside React.

## Verification

Automated checks must cover:

- native MP3/M4A import without detached metadata rejection;
- previous-track restart and boundary behavior;
- next-track repeat boundary behavior;
- add-next, add-to-end, reorder, remove, and play-from-here rules;
- spectrum normalization, decay, idle state, and reduced-motion sampling;
- cleanup of animation frames, observers, and analyser connections.

Browser proof must use the production build with at least 300 generated library entries plus real MP3 and M4A files. Verify search latency, keyboard navigation, import, queue edits, previous/play-pause/next, seek, repeat, BGM visualization, performance visualization, pause, transition, and console cleanliness at 390, 768, 1024, and 1366 pixels.

Native proof must repeat real MP3 and M4A import and playback in the Apple-silicon TestFlight app before build 7 is called fixed.

## Release boundary

Build 7 may enter the internal `DreamLIVE team` TestFlight group after all automated, browser, archive, and App Store Connect processing gates pass. This work does not authorize a public App Store submission.
