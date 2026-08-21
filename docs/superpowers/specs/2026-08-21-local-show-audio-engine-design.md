# DreamLIVE Local Show Audio Engine

## Outcome

DreamLIVE is the only playback surface used during a show. Staff import licensed audio files onto the iPad, assign one background track and up to four performance tracks, and run the entire sequence without changing apps or matching separate output controls.

## Operator experience

DreamLIVE is a pressure-safe performer console, not a DJ tool. Its working object is the show itself: one BGM playlist and four ordered on-stage cues. The interface progressively discloses only what the operator needs in the current state:

- **Prep:** room output, imports, assignments, and channel calibration are visible.
- **Ready:** setup condenses automatically into a compact BGM strip and one **Next on stage** surface. The earliest assigned incomplete cue owns the only large **Start performance** action.
- **Live / paused:** the active performance, elapsed progress, **Pause / Resume**, and emergency **Stop audio** dominate. BGM is reported as held safely; the following cue remains a quiet preview.
- **Complete:** the finished cue collapses and the next assigned incomplete cue becomes the ready surface. Unassigned cues never add noise to the run view.

**Edit setup** reversibly restores the prep controls. Emergency **Stop audio** remains available in the header without clearing assignments. The confirmed destructive **Reset show** action lives only in the setup footer, away from the live path.

The device and app volume are intentionally separated. At each launch, a sound check asks staff to set the device's physical volume to the fixed room baseline, play a short test tone through the real master chain, set DreamLIVE's global output, and confirm it is clear. DreamLIVE saves that room level and can restore it with one tap. The UI states plainly that browser/iOS code cannot read or change physical device volume, so rotating staff are never given a fake or misleading control. After confirmation, the setup sheet disappears into one compact **Output ready** control.

The supporting interface uses the approved DreamLIVE mark, a cream/pink/cocoa palette, matte tonal grouping, one structural edge per region, sentence-case English labels with concise Japanese microcopy, and consistent 44px-or-larger controls. Japanese language and sakura are core brand elements: Japanese stays secondary to the time-critical English action, while a subtle sakura canvas texture and restrained petal drift identify ready/live states without obscuring controls. Decorative card stacks, uppercase utility labels, glass effects, excessive gradients, and duplicated setup guidance are removed from the live path. A fixed light operational theme is intentional so the handed-off device always presents the same legible controls.

## Application paradigm

DreamLIVE follows the **editor → presenter view** paradigm used by polished presentation and professional media applications:

- The editor is comprehensive but calm: import, sequence, assign, calibrate, and verify.
- Entering readiness is the equivalent of starting presenter view: configuration condenses automatically and the working surface becomes **now / next**.
- Live mode is a contextual transport, not a second dashboard: the active object owns the canvas, its one safe action owns the strongest color, and the following cue stays visible without competing.
- Persistent utilities form a narrow transport rail: room output and emergency stop never move; editing and destructive reset do.
- Mode changes alter information density, not the underlying audio objects. This preserves continuity and gives future features one clear placement rule: configuration belongs to the editor, time-critical action belongs to presenter view, and global safety belongs to the transport rail.
- Brand expression is structural, not ornamental: Japanese microcopy establishes DreamLIVE voice, sakura texture lives behind content, and short petal motion marks state entry. Neither may reduce the clarity, size, or contrast of the primary action.

This paradigm is the build standard for future DreamLIVE UI work. New controls must declare which of those three layers they belong to and must not appear in more than one layer unless they are a true safety control.

## Surface contract

| State | Primary object | Primary action | Feedback | Recovery |
| --- | --- | --- | --- | --- |
| Prep | Room output and show setup | Complete the named setup step | Readiness rail names the missing requirement | Edit or reset setup |
| Ready | Earliest assigned incomplete cue | Start performance | BGM status and next cue are visible | Edit setup or stop audio |
| Transitioning | Cue being started | None; duplicate input is locked | BGM lowers before performance begins | Start failure restores BGM and shows an error |
| Live | Active performance | Pause performance | Elapsed time and progress update | Resume or stop audio |
| Paused | Paused active performance | Resume performance | Paused status remains visually dominant | Stop audio |
| Error | Failed cue | Return to the next safe action | Human-readable error and restored BGM state | Retry from ready state or edit setup |

The sound-check overlay traps attention while open, closes from its explicit action, Escape, or a backdrop tap, and restores focus to its launcher. It remains absent from the accessibility tree when closed. Imported audio elements stay mounted when the deck condenses so hiding setup cannot interrupt playback.

## Audio architecture

Use the browser and iOS platform audio primitives already in the app. Long imported files continue to stream through `HTMLAudioElement` instances so the iPad does not decode every track into memory. Each element routes through its own `GainNode`; every channel then converges on one safety compressor and one master gain before the device output. This keeps all tracks on a single output path and makes channel calibration predictable.

A small pure orchestration module owns show phases and transition ordering. Starting a performance lowers and pauses BGM before performance playback is audible. A failed performance start restores BGM and reports a visible error. Natural completion restores BGM. Reset, emergency stop, duplicate taps, and an interrupted audio context cannot leave a delayed callback that starts audio later.

The existing mute-then-fade warm-up is retained for iPad sample-rate recovery. BGM and performance volume controls remain per-channel calibration knobs. The master chain supplies conservative peak protection, not aggressive loudness processing.

## Import and readiness

Imported files must be non-empty and match a supported audio type or extension. DreamLIVE reads metadata before accepting a file, stores its duration with the file in IndexedDB, and reports skipped files rather than silently adding broken tracks. Selected audio elements preload metadata. Show readiness requires a completed sound check, a selected BGM, active BGM playback, and at least one assigned performance.

## Verification

Automated tests prove transition ordering, start-failure restoration, completion restoration, output-gated readiness, deterministic next-cue selection, live-state selection, and playlist advancement. The production build, Capacitor sync, signed native iOS archive, and App Store export must succeed. Browser QA must exercise sound-check playback and confirmation, saved show-level restoration, import, BGM start, automatic ready condensation, performance transition, pause/resume, completion-to-next-cue restoration, setup reveal, Stop audio, Reset show, keyboard dismissal of the sound check, and responsive tablet/phone layouts.
