# DreamLIVE Production-Quality Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the next DreamLIVE TestFlight build with reliable local-audio import and a professional, responsive performer console.

**Architecture:** Extract browser audio inspection into a pure, dependency-injected module, retain the current HTMLMediaElement/Web Audio playback chain, and restyle the existing app around one command-rail, rundown, and presenter grammar. Keep audio elements mounted across UI states and preserve saved IndexedDB show data.

**Tech Stack:** React 19, Create React App/Jest, Web Audio API, IndexedDB, Framer Motion, Lucide React, Capacitor 7, Xcode.

## Global Constraints

- No Spotify or external music-provider workflow.
- No bundled copyrighted audio.
- English time-critical actions remain primary; Japanese microcopy remains secondary.
- Sakura texture stays behind controls and respects reduced motion.
- Minimum touch target is 44x44px; spacing follows a 4/8px grid.
- One surface grammar; no nested card stacks, glass, gradients, decorative metadata pills, or oversized button padding.
- The exact wide DreamLIVE mark remains contained and undistorted.
- A release claim stops at the last Apple state directly verified.

---

### Task 1: Make WebKit audio inspection deterministic

**Files:**
- Create: `src/audio/importAudio.js`
- Create: `src/audio/importAudio.test.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `inspectAudioFile(blobUrl, options): Promise<number>`.
- Produces: `processAudioFiles(files, options): Promise<{ accepted, rejected }>`.
- `rejected` entries contain `{ file, reason }`; accepted entries retain `fileData` for IndexedDB.

- [x] Write a failing test whose fake media element emits metadata only after `load()` and assert `load()` is called once.
- [x] Run `CI=true npm test -- --runInBand src/audio/importAudio.test.js` and confirm the explicit-load test fails.
- [x] Implement handler registration, `src` assignment, explicit `load()`, duration validation, timeout, and cleanup.
- [x] Add failing tests for unsupported/empty files, media errors, cleanup, stable IDs, and bounded processing order.
- [x] Implement `processAudioFiles` with a three-worker pool and dependency-injected URL functions.
- [x] Run the focused suite and full Jest suite.

### Task 2: Give imports professional progress and recovery

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `processAudioFiles` from Task 1.
- Adds: `importState = { active, completed, total }` and actionable result messages.

- [x] Replace the in-component probe and sequential processor with the shared module.
- [x] Disable duplicate import actions while scanning and expose `Checking N of M tracks` through the header action and live region.
- [x] Keep accepted tracks when some fail; summarize rejected files without technical error text.
- [x] Keep session playback usable when IndexedDB persistence fails and say exactly what will not persist.
- [x] Verify an actual AAC-LC M4A that failed in build 5 imports with a positive duration.

### Task 3: Establish the unified shell and control primitives

**Files:**
- Modify: `src/App.jsx`
- Replace: `src/App.css`
- Modify: `src/index.css`

**Interfaces:**
- Preserves all existing playback handlers and class hooks required by Task 4.
- Establishes CSS tokens for canvas, surface tiers, text, action, semantic state, radius, elevation, control height, and motion.

- [x] Replace the detached header/status-card hierarchy with one sticky command rail and attached state rail.
- [x] Normalize button, icon, range, status, focus, pressed, loading, and disabled geometry.
- [x] Reserve solid pink for the current primary action and deep red for destructive stop/reset only.
- [x] Use one structural hairline per region; remove child card borders and redundant shadows.
- [x] Preserve the wide DreamLIVE mark, cream/pink/cocoa palette, Japanese microcopy, diagonal ground rhythm, and quiet sakura texture.
- [x] Add reduced-motion coverage and safe-area padding.

### Task 4: Replace setup cards with a professional rundown

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- BGM remains the left transport lane on landscape tablet/desktop.
- Performance assignments remain the same four indexed audio elements and state arrays.

- [x] Compress the BGM empty state, now/next block, queue, transport, repeat, and volume into one aligned lane.
- [x] Render four performance cues as aligned rundown rows instead of a 2x2 field of oversized cards.
- [x] Keep cue assignment, level, duration, state, and contextual start/replay behavior in the shared row grammar.
- [x] Ensure long names truncate with the full name available to assistive technology and native tooltip/title.
- [x] Keep reset in the setup footer and stop audio in the persistent command rail.

### Task 5: Polish the presenter and overlay interactions

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Preserves `getShowDeckState` as the sole presenter-mode selector.
- Keeps dropdown and dialog overlays conditional, focus-managed, and inert while closed.

- [x] Refine the ready/live focal plane around cue identity, progress, primary transport, and one quiet next-cue preview.
- [x] Upgrade `SearchableSelect` to focus search on open, track viewport position, avoid bottom collision, and remain attached through resize/scroll.
- [x] Tighten sound-check dialog layout and action wording without changing the physical-device-volume truth.
- [x] Verify Escape, backdrop close, focus return, keyboard list navigation, and outside-click behavior.
- [x] Limit petal movement to state entry and preserve the still composition for reduced motion.

### Task 6: Perform the two required design reviews

**Files:**
- Review: `src/App.jsx`
- Review: `src/App.css`
- Review: `src/audio/importAudio.js`
- Review: `docs/superpowers/specs/2026-08-22-production-quality-release-design.md`

- [x] Run a local VP Design pass because subagents are not authorized; spot-check the served implementation for one-second hierarchy, density, component integrity, responsiveness, and Dreamland identity.
- [x] Run a separate local Content Design pass without reading the VP verdict; inventory labels, errors, empty states, confirmations, and bilingual priority.
- [x] Incorporate every blocking finding and record both verdicts in this plan.

### Task 7: Prove web and native behavior

**Files:**
- Modify only if a verification finding requires it: `src/App.jsx`, `src/App.css`, `src/audio/importAudio.js`
- Modify: `ios/App/App.xcodeproj/project.pbxproj`

- [x] Run `CI=true npm test -- --runInBand` and record exact suites/tests/failures: 3 suites, 16 tests, 0 failures.
- [x] Run `npm run build`, `npm run cap:sync`, and `npm run verify:ios-release`.
- [x] Serve the production build and capture 390x844, 768x1024, 1024x768, and 1366x1024 screenshots.
- [x] Walk empty, importing, populated setup, sound-check, ready, live, paused, complete, error, dropdown, and reset states; confirm no clipping, overflow, detached overlay, stale state, dead action, or console error.
- [x] Import the known AAC-LC M4A, reload its saved IndexedDB entry, play BGM, start/pause/resume/finish a performance, stop audio, and reset.
- [ ] Build and validate the signed generic-device archive and App Store export.

### Task 8: Deliver one release

**Files:**
- Commit the product, regression tests, spec, plan, iOS build number, and release receipt together.

- [x] Re-check the intended branch and remote drift without resetting or discarding local work.
- [x] Review the final diff and rerun the complete verification gate from the final tree.
- [ ] Commit and push the release branch once.
- [ ] Upload the signed build to App Store Connect with the existing authenticated account.
- [ ] Poll until Apple reports the exact processing/TestFlight state and report that state without calling it live prematurely.

## Plan self-review

- Spec coverage: import reliability, progress, shell, rundown, presenter, overlays, responsive behavior, native release, and exact Apple state each have a task.
- Placeholder scan: no TBD, TODO, or unspecified implementation steps remain.
- Interface consistency: Task 1 owns import helpers; Task 2 consumes them; Tasks 3-5 preserve the playback state model; Tasks 7-8 own proof and release.
- Deferrals: loudness normalization, waveform analysis, cloud sync, remote control, and device-volume automation remain deferred until measured operating evidence justifies them.

## Pre-implementation review record

Subagents are not authorized in this session, so the two required reviews were completed as isolated local passes against the real files and baseline screenshots.

- **VP Design — ALMOST_THERE, incorporated.** Spot-checked `src/App.jsx:1369-1577`, `src/App.jsx:1578-1945`, `src/App.css:78-340`, the 1200x400 DreamLIVE mark, and the 390x844/1200x850 served baselines. Required changes added to Tasks 3-5: merge the detached status card into the shell; prevent three equal-weight mobile header buttons; replace the 2x2 empty card field with a rundown; make emergency stop visually dominant only while audio is active; keep import progress persistent rather than toast-only; test popover collision and attachment. Surface grammar verdict: current COLLAGE, planned COHERENT.
- **Content Design — APPROVE_WITH_CHANGES, incorporated.** Spot-checked import messages at `src/App.jsx:671-696`, playback recovery at `src/App.jsx:1075-1250`, sound-check copy at `src/App.jsx:1429-1504`, empty states at `src/App.jsx:1597-1643`, and reset consequences at `src/App.jsx:1512-1538`. Required changes added to Tasks 1-5: failure messages state what happened and what to try; partial imports preserve success; empty library includes the import action; import progress names the operation; confirmation labels name the consequence; English remains first for time-critical actions.

Both reviewers verified the plan's load-bearing file references. No fabricated claims or customer-scale language exists in the planned copy.

## Post-implementation review record

- **VP Design — SHIP IT (55/60 DQS).** Served checks at 390x844, 768x1024, 1024x768, and 1366x1024 show one command rail, one attached state rail, a compact BGM lane, aligned rundown rows, and a single presenter focal plane. Every dimension scores at least 4/5. Blocking findings incorporated: removed the remaining nested focal border, reduced the desktop empty canvas, corrected the live pause hover state, removed file extensions from display labels, and widened the focal title measure to prevent a Japanese widow.
- **Content Design — CLEAR TO SHIP.** Inventory covered import progress/success/partial/failure, first launch, empty library, sound check, readiness, transition, live/paused/complete, stop, reset, and playback recovery. Time-critical English remains primary, Japanese remains secondary, destructive actions name consequences, and the physical device-volume limitation stays explicit.
- **Runtime proof.** The build-5 failure file `葉月 恋 (CV.青山なぎさ) - 結び葉.m4a` imported with a 3:53 duration, survived an IndexedDB reload with its BGM/performance assignments, played through BGM and performance pause/resume/finish, and reset without deleting the library. A mixed M4A/JSON import preserved the M4A and reported one rejection. The production shell also reloaded offline from `dreamlive-shell-v4` with its hashed JS/CSS, logo, and fonts cached.
