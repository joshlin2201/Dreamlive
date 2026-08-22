# DreamLIVE Live Audio Deck Design

**Date:** 2026-08-22  
**Status:** Approved for implementation
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

## Cohesive interface system

Use Apple Music's Now Playing hierarchy as the transport reference: track identity first, one centered playback cluster, progress next, and secondary controls last. Use Ableton Live's state precision as the operational reference: active, held, queued, and disabled sources must read differently without turning the page into a mixer.

### Typography

Use one role-based type system across the app:

- `--font-display`: self-hosted Poppins with `Hiragino Sans`, `Yu Gothic`, and sans-serif fallbacks for Japanese;
- `--font-ui`: self-hosted Poppins with the same Japanese fallbacks;
- focus-player title: `clamp(2rem, 3.2vw, 3.25rem)`, weight 700, line height 1.06;
- section title: `clamp(1.35rem, 1.8vw, 1.8rem)`, weight 650, line height 1.15;
- control label: 0.875rem to 1rem, weight 600;
- body and track title: 0.9375rem to 1rem, weight 450 to 550, line height 1.4;
- eyebrow and metadata: 0.75rem to 0.8125rem, weight 600, modest letter spacing.

Do not render every label in bold. Japanese text receives at least 1.3 line height and never uses a synthetic weight above 700. The focus title must wrap into at most two balanced lines and leave room for the active controls and spectrum.

### Buttons

All buttons share the same base component grammar:

- 40-pixel compact or 48-pixel primary height;
- 10- to 12-pixel corner radius; pills are reserved for status badges;
- 12- to 16-pixel horizontal padding, never oversized padding;
- 18- to 20-pixel icons aligned to an 8-pixel label gap;
- one 140-millisecond hover/press transition;
- one `:focus-visible` ring: 2-pixel Dreamland rose with a 2-pixel cream offset;
- disabled controls keep their geometry and reduce contrast without becoming invisible.

Use six semantic variants only:

1. **Primary:** saturated Dreamland rose for the next intended action.
2. **Transport:** cocoa text on warm cream for Previous, Pause/Resume, and Next; the active center control may use a rose wash, never unrelated yellow.
3. **Secondary:** neutral cream for setup and library actions.
4. **Ghost:** low-priority inline actions with no permanent fill.
5. **Status control:** pale mint for Output ready; it remains clickable but reads as calibrated state.
6. **Destructive:** deep berry for Stop audio only while audio is active; idle Stop audio uses the neutral secondary treatment.

Icon-only controls use the same 40- or 44-pixel square geometry and always carry an accessible name. Replace mismatched filled-square glyphs with the existing Lucide icon set.

### Surfaces and depth

Use three elevation levels across the page:

- page ground: warm cream with restrained sakura texture;
- player surface: one tonal blush or white plane with one soft shadow;
- floating surface: library and combobox popovers with one hairline and one controlled shadow.

Avoid borders inside bordered cards, broad empty white canvases, and stacked fill-plus-stroke-plus-shadow treatments. The visualizer, track identity, and controls must occupy the large player deliberately. Reduce diagonal color bands to one edge accent so they support the content instead of filling unused space.

### Selection and focus states

Comboboxes and library lists use one selection language:

- remove the browser-blue input outline;
- apply the shared rose `:focus-visible` ring to the complete search field;
- use a 3-pixel rose accent rail, a 6-percent blush wash, and one check icon for the selected option;
- use a quiet cocoa wash for hover and keyboard-active options;
- keep option rows at least 44 pixels high with medium-weight text;
- use one 12-pixel popover radius, one hairline, and one shadow;
- keep the menu attached to its trigger and collision-safe at every viewport.

Selected options must not appear as a second rounded card inside the popover. Text selection may use a low-contrast rose tint, but focus remains visible independently.

### Interaction motion

Use 140 milliseconds for button feedback, 180 milliseconds for popovers and row selection, and 240 milliseconds for panel expansion. Motion uses `cubic-bezier(0.16, 1, 0.3, 1)`. Animate opacity and transform only; never animate layout dimensions during playback. Reduced-motion mode removes translation and keeps short opacity changes.

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

Selecting another queued track while BGM is playing uses the existing safe fade path, then resumes the selected track. While a performance is live, operators may add tracks and manage future queue items, but playback selection waits until BGM resumes. The held BGM item remains locked against removal or reordering so the performance handoff returns to the correct track. The current row stays visually distinct without a nested bordered card.

## Performance focus player

The large run-focus player keeps its current one-action hierarchy. Add the focus visualizer between the track title and progress scrubber. It reflects the audible performance signal during live playback, settles when paused, and shows the fade handoff during transitions.

The focus player retains:

- performance number and title;
- Live, Paused, or Starting state;
- elapsed time, scrubber, and duration;
- one large Pause or Resume action;
- the next cue preview.

Remove the duplicated `Next on stage ・ 次の出演` label while editing this surface.

## Live setup access

The focused performance player must contain a prominent secondary action labeled `Edit show setup`. It remains visible beside the live state, not hidden in the global header. Selecting it opens the setup workspace without pausing, restarting, or seeking the performance.

While setup is open during a performance:

- pin a compact live transport above the workspace with the active title, visualizer, elapsed time, Pause or Resume, `Return to live view`, and emergency `Stop audio` access;
- keep the full library import action available;
- allow assignment or replacement of future performance slots, including empty slots;
- allow BGM search, add-next, add-to-end, and edits to future queue items;
- lock the active performance slot and held BGM item against replacement, removal, or reorder;
- disable playback-changing actions such as Play from here, Previous, and Next until the performance ends;
- preserve every live timer, fade, gain, and completion state while the operator edits setup.

On a 390-pixel viewport, the pinned live transport uses one compact title row, one progress row, and one action row. It must not cover the setup controls or consume more than one-third of the viewport height.

## State and safety rules

- The visualizer follows the audible master signal; it never invents motion when audio is silent.
- Playback-changing BGM transport controls lock during a fade transition or while a performance owns the output; library and future-queue editing remain available.
- Setup editing never interrupts a live performance, changes its assigned file, or loses its progress.
- The active performance slot and held BGM item are the only setup records locked during live playback.
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
- `LiveSetupDock`: keeps essential active-performance controls visible while setup is expanded.
- `App`: remains the show-state and audio-routing owner.

Pure playlist helpers own previous-index, next-index, insertion, reorder, and select-from-queue rules so the live logic stays testable outside React.

## Verification

Automated checks must cover:

- native MP3/M4A import without detached metadata rejection;
- previous-track restart and boundary behavior;
- next-track repeat boundary behavior;
- add-next, add-to-end, reorder, remove, and play-from-here rules;
- spectrum normalization, decay, idle state, and reduced-motion sampling;
- live setup expansion without pausing or resetting the current performance;
- active-slot and held-BGM locking while future slots, imports, and future queue edits remain available;
- cleanup of animation frames, observers, and analyser connections.

Browser proof must use the production build with at least 300 generated library entries plus real MP3 and M4A files. Verify search latency, keyboard navigation, import, queue edits, previous/play-pause/next, seek, repeat, BGM visualization, performance visualization, live setup expansion, future-slot assignment during playback, return to the live view, pause, transition, and console cleanliness at 390, 768, 1024, and 1366 pixels.

Native proof must repeat real MP3 and M4A import and playback in the Apple-silicon TestFlight app before build 7 is called fixed.

## Release boundary

Build 7 may enter the internal `DreamLIVE team` TestFlight group after all automated, browser, archive, and App Store Connect processing gates pass. This work does not authorize a public App Store submission.
