# DreamLIVE Production-Quality Release

## Outcome

DreamLIVE becomes a dependable show instrument: a rotating performer can open the handed-off iPad or Mac, import licensed tracks, set the room level, build the rundown, and operate the show without interpreting a dashboard or recovering from misleading file errors.

This release corrects the current import false-negative and replaces the component-collage presentation with one professional surface grammar. It preserves the approved local-audio architecture, Japanese microcopy, sakura identity, and editor-to-presenter behavior.

## Product resolution

- **Transformation:** uncertainty at handoff becomes visible readiness and one obvious next action.
- **Emotional tone:** calm backstage confidence with unmistakable Dreamland warmth.
- **Aesthetic direction:** a professional broadcast rundown translated through Dreamland's controlled kawaii commercial language.
- **Signature moment:** when the show becomes ready, configuration folds into a focused presenter deck; the next cue advances into the focal plane, then the live track owns the workspace while recovery remains one tap away.

## Evidence and visual anchors

The interface uses the existing wide `DreamLIVE!` mark and the Dreamland entertainment-mode rules. The relevant confirmed references are:

1. `01-denver-recruitment.png`: broad cream, pink, and yellow fields; concise utility bar; controlled stars.
2. `03-five-year-merchandise.png`: strong focal hierarchy, flat overlap, compact supporting facts, intentional asymmetry.
3. `04-combo-menu.png`: organized abundance, obvious zones, pink/cocoa structure, consistent control geometry.
4. `Dreamland Visual Grammar.md` entertainment mode and `BI-0071`: Japanese secondary voice and sakura continuity are required in DreamLIVE.

Concrete DNA anchors: cream ground; pink-led action color; cocoa structural text; restrained yellow status accent; wide DreamLIVE mark; diagonal field rhythm; controlled sakura texture; compact utility bands; focal depth through tonal planes and overlap rather than nested borders.

## Surface contract

| Contract | Decision |
| --- | --- |
| User goal | Prepare and run a reliable show under time pressure. |
| Working object | One saved show: BGM playlist, four ordered performance cues, and calibrated room output. |
| Primary action | The next incomplete prerequisite in setup; `Start performance` in ready mode; `Pause performance` or `Resume performance` while live. |
| Feedback signal | A persistent state rail names readiness, current audio, next cue, and recovery action. |
| Surface grammar | One shell, one toolbar geometry, one row language, one focal plane, 8px rhythm, sentence case, touch-safe controls. |
| Layer contract | Header and state rail are sticky; menus use one popover layer; dialogs use one modal layer; closed overlays are absent and inert. |
| Media-fit contract | Wide mark is contained and never stretched; audio elements remain mounted; file names truncate without hiding cue identity. |
| Responsive contract | Landscape tablet is the operational reference; portrait tablet and phone stack the same hierarchy without giant buttons, clipped copy, or sideways overflow. |

## Experience architecture

### Global command rail

The header is one compact command rail. Brand occupies the left. Show mode and output state occupy the center/right. Import and sound check are ordinary tools; emergency stop remains persistent but becomes visually dominant only while audio is active. Controls share a 44px hit area, 36-40px visual height, 8px radius, 16px horizontal padding, aligned icons, visible focus, and pressed feedback.

The separate floating status card is replaced by a slim state rail attached to the shell. It presents one state label, one actionable sentence, and current BGM. It does not become another card.

### Setup workspace

The workspace uses a stable split:

- BGM is a compact left transport lane containing now/next, the ordered queue, transport controls, repeat state, and level.
- Performance cues are a right-side rundown. Four equal-height rows replace four oversized cards. Each row aligns cue number, track assignment, state, level, duration, and contextual action on shared columns.
- Empty states occupy only the space their message needs. Import is available in the header and the first empty-state action, never repeated throughout the canvas.

### Presenter workspace

Ready and live states retain the compact BGM lane and transform the performance side into a focal cue plane. The cue number, track name, progress, and primary transport action share one visual center. Later cues become quiet rows. The sakura layer sits behind this plane and moves only on state entry. Reduced motion keeps the same composition without drift.

### Sound check

The sound-check dialog is a compact two-stage calibration surface:

1. `Device baseline` shows the physical target as seven of ten bars and makes clear that DreamLIVE cannot control it.
2. `DreamLIVE output` exposes the saved master level, test tone, and restore action.

The footer contains `Play test sound` and the single confirmation action `Confirm clear sound`. The dialog traps focus, closes from Escape/backdrop/close, and returns focus to its launcher.

## Import architecture

The metadata probe becomes a small testable audio module. It must set the blob URL, register success/error handlers, call `audio.load()` explicitly, and always clean up handlers and the source. A supported, non-empty audio file is accepted only after a positive duration is available.

Imports run through a bounded worker pool so a large folder does not freeze the interface or create an unbounded number of media elements. The UI exposes progress as `Checking 3 of 18 tracks` and disables duplicate import taps while work is active.

Results are specific:

- success: `Added 18 tracks`;
- partial: `Added 16 tracks. 2 couldn't be opened.`;
- failure: `These files couldn't be opened on this device. Try MP3, AAC, M4A, or WAV.`;
- persistence failure: tracks stay usable for the session and the message says they were not saved for next launch.

No provider integration or bundled copyrighted audio is introduced.

## Component system

The implementation uses the existing React, Framer Motion, and Lucide stack. No new dependency is needed.

- `SearchableSelect` becomes an anchored combobox with focus-on-open, Escape close, outside-click close, viewport collision handling, clear selected/hover/focus states, and no detached body-portal position after resize or scroll.
- Buttons share primary, secondary, quiet, and destructive semantics. A fill style has one meaning per state.
- Status treatments are compact text-plus-dot labels; metadata does not receive decorative pills.
- Range controls share one track/thumb treatment, a visible numeric value, and touch-safe hit area.
- Rows use tonal selection and a single hairline where scanning needs it. No card-within-card construction remains.

## Motion and depth

- Micro feedback: 120-150ms, color/opacity/scale only.
- Popover: 160ms enter, 120ms exit with anchored transform origin.
- Dialog: 220ms backdrop and 240ms surface entry.
- Presenter transition: 280ms layout transition; no looping motion except restrained petals on state entry.
- Reduced-motion removes nonessential translation and petal animation.

Depth is monotonic: canvas, workspace, focal plane, popover, dialog. Ordinary rows stay flat. Shadows are reserved for the focal plane, popover, and dialog.

## State matrix

The release verifies loading, first launch, empty library, importing, import success, import partial failure, import total failure, unsaved persistence failure, setup incomplete, sound check open, ready, transitioning, live, paused, complete, playback interruption, dropdown open/closed, and reset confirmation.

## Quality target

Baseline served DQS is 29/60: the app works, but hierarchy, density, component integrity, responsive composition, and polish are below ship quality. Release target is at least 50/60 with no dimension below 4, no fabricated content, no console errors, no clipped content, no detached overlay, no horizontal overflow, and no dead-end interaction.

## Release proof

Completion requires:

- regression tests that fail without explicit metadata loading and pass with it;
- the full Jest suite and production build;
- browser proof at 390x844, 768x1024, 1024x768, and 1366x1024;
- a real M4A import, saved reload, BGM start, ready transition, performance start, pause/resume, completion, stop, and reset;
- Capacitor sync, native archive/export validation, App Store Connect upload, and exact TestFlight processing status.

Uploading a build is not equivalent to TestFlight availability. The final report names the last state Apple actually confirms.
