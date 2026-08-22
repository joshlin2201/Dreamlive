# DreamLIVE Build 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship an internal-TestFlight DreamLIVE build that reliably imports local MP3/M4A files, provides professional live BGM and performance controls, and applies one cohesive premium interaction system across the app.

**Architecture:** Keep `App` as the playback/state authority, attach a non-invasive analyser after the master gain, and move deterministic playlist/search/spectrum behavior into pure helpers. Render the large and compact players from focused components while preserving the existing safe BGM/performance handoff.

**Tech Stack:** React 18, Web Audio API, Capacitor iOS, Lucide React, Jest/React Scripts, Playwright CLI, Xcode/App Store Connect.

---

## Task 1: Preserve valid native audio imports

**Files:**
- Modify: `src/audio/importAudio.js`
- Test: `src/audio/importAudio.test.js`

- [x] Add a regression test proving Capacitor accepts a supported nonempty MP3 without a detached metadata probe.
- [x] Confirm the new test fails against the old native behavior.
- [x] Skip detached metadata inspection only in Capacitor; keep browser validation unchanged.
- [x] Run the focused import test and verify it passes.

## Task 2: Make playlist behavior deterministic

**Files:**
- Create: `src/audio/playlist.js`
- Create: `src/audio/playlist.test.js`
- Modify: `src/showFlow.js`
- Modify: `src/showFlow.test.js`

- [ ] Write failing tests for previous/restart, repeat boundaries, add-next/end, select, locked reorder, and locked removal.
- [ ] Implement pure helpers returning the updated queue and current index together.
- [ ] Route existing next-track behavior through the shared boundary helper.
- [ ] Run the focused playlist/show-flow tests.

## Task 3: Add the real master-signal visualizer

**Files:**
- Create: `src/audio/spectrum.js`
- Create: `src/audio/spectrum.test.js`
- Create: `src/components/AudioVisualizer.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] Write failing tests for spectrum bin aggregation, normalization, and idle output.
- [ ] Insert one configured `AnalyserNode` between master gain and destination.
- [ ] Implement a reusable canvas visualizer with one allocation, capped DPR, resize cleanup, 30fps cap, paused decay, and reduced-motion behavior.
- [ ] Render compact BGM and focus-player variants from the same analyser reference.
- [ ] Run spectrum tests and verify playback remains available when Web Audio is unavailable.

## Task 4: Build the scalable BGM transport deck

**Files:**
- Create: `src/components/BgmTransport.jsx`
- Create: `src/components/AudioLibraryPanel.jsx`
- Create: `src/components/BgmQueue.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] Add BGM elapsed/duration state, mounted-element seeking, and safe previous/play-pause/next handlers.
- [ ] Replace the unrelated action row with a centered transport cluster, progress scrubber, repeat, and level.
- [ ] Add a responsive searchable library with memoized normalization, exact result count, a 100-result render cap, and Add next/Add to end.
- [ ] Add queue Play from here, move earlier/later, and remove controls with held-item locking during performance playback.
- [ ] Preserve queue state and report named track failures without removing items.

## Task 5: Keep setup usable during live performance

**Files:**
- Create: `src/components/LiveSetupDock.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] Add an obvious `Edit show setup` action inside the large focus player.
- [ ] Keep playback mounted and uninterrupted when setup expands.
- [ ] Pin a compact live dock with title, signal, progress, pause/resume, return, and Stop audio access.
- [ ] Allow future performance assignment, importing, and future BGM queue edits; lock only the active performance and held BGM item.
- [ ] Remove the duplicated `Next on stage` label.

## Task 6: Apply one premium component system

**Files:**
- Modify: `src/App.css`
- Modify: `src/App.jsx`

- [ ] Consolidate font, spacing, radius, elevation, focus, motion, and semantic button tokens.
- [ ] Normalize every button to primary, transport, secondary, ghost, status, or destructive styling with 40/48px geometry.
- [ ] Reduce nested borders, oversized padding, empty canvas space, and decorative diagonal bands.
- [ ] Replace browser-blue search focus with the shared rose focus treatment.
- [ ] Replace the heavy selected-option card with an accent rail, subtle wash, and check; preserve keyboard focus and 44px targets.
- [ ] Verify Japanese titles wrap/truncate cleanly and sakura identity remains intact.

## Task 7: Prove the production experience

**Files:**
- Modify as needed: `src/**/*.test.js`
- Generated only: `build/`, `ios/App/App/public/`

- [ ] Run `CI=true npm test -- --watchAll=false`.
- [ ] Run `npm run build`, `npm run cap:sync`, and `npm run verify:ios-release`.
- [ ] Serve the production build and test with real MP3/M4A plus at least 300 library records.
- [ ] Exercise import, search, keyboard selection, queue edits, seek, repeat, transport, both visualizers, live setup edits, return-to-live, pause/resume, and transition.
- [ ] Capture and inspect 390, 768, 1024, and 1366px screenshots; require zero console errors and no horizontal overflow.

## Task 8: Release and verify build 7

**Files:**
- Modify: `ios/App/App.xcodeproj/project.pbxproj`
- Create/update: release evidence under `docs/`

- [ ] Confirm `CURRENT_PROJECT_VERSION = 7` and create a signed archive/export.
- [ ] Upload to App Store Connect, wait for VALID processing, and attach only to internal `DreamLIVE team` TestFlight.
- [ ] Update/install the TestFlight build on this Mac and repeat real external-drive MP3 plus local M4A import/playback.
- [ ] Commit and push the exact tested source; record commit SHA, build id, tests, browser proof, and native proof.
- [ ] Complete the required Dreamland HQ learning/thread/snapshot closeout without claiming public App Store release.
