# DreamLIVE Adaptive Show Deck Implementation Plan

> **For implementation:** execute this checklist in order, keep imported audio elements mounted across UI states, and stop release claims at the last state proven by Apple.

**Goal:** Ship a local-audio DreamLIVE release that rotating performers can operate under pressure from one adaptive prep, ready, and live surface, then upload the signed iOS build to App Store Connect.

**Architecture:** Preserve the existing HTMLMediaElement-to-Web-Audio safety chain and IndexedDB library. Add one pure show-deck selector beside the existing readiness/transition helpers, derive the visible operator mode from that selector, and progressively disclose the existing setup without duplicating playback state or unmounting audio. Release from the isolated feature branch because the rewritten remote `main` history is not safe to merge into this working tree.

**Tech stack:** React 18, Web Audio API, IndexedDB, Jest/react-scripts, Capacitor 7, native iOS/Xcode.

**Surface grammar:** Fixed light cream canvas with quiet sakura texture; cocoa structure; pink reserved for the single next/active action; matte tonal regions and restrained elevation instead of nested borders; sentence-case English with concise Japanese microcopy; 8px rhythm; 44px minimum interactive targets; no glass, dark DJ styling, padded button slabs, or motion unrelated to state.

---

### Task 1: Lock deterministic show-deck state

**Files:**
- Modify: `src/audio/showFlow.test.js`
- Modify: `src/audio/showFlow.js`

- [x] Add failing tests proving prep gating, earliest assigned incomplete cue selection, completion advancement, and live cue selection.
- [x] Run `CI=true npm test -- --runInBand` and observe the new selector tests fail for the missing behavior.
- [x] Add `getShowDeckState`, reusing `SHOW_PHASE` and treating assignment/completion as explicit inputs.
- [x] Rerun the focused suite and prove all flow tests pass.

### Task 2: Build the adaptive performer deck

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [x] Derive `prep`, `ready`, and `live` modes from the pure selector; auto-condense once readiness is first achieved and auto-expand if readiness is lost.
- [x] Add an **Edit setup** escape hatch and keep the actual audio elements mounted while visual setup regions condense.
- [x] In ready mode, render one **Next on stage** hero for the earliest assigned incomplete cue and one large existing start action.
- [x] In live/paused mode, render only the active cue, progress, pause/resume, emergency stop, held-BGM status, and a quiet following-cue preview.
- [x] Collapse completed cues, remove unassigned cues from the run view, compact the BGM surface, and move **Reset show** into the setup footer.
- [x] Keep channel sliders and import controls in prep/edit only; preserve all existing audio callbacks and refs.
- [x] Add Escape/backdrop close and focus restoration to the sound-check dialog; remove unsupported time promises and use **Room output** language.
- [x] Apply the Marina visual grammar, Japanese and sakura brand continuity, tonal depth without nested borders, compact button geometry, state-led animation, responsive tablet/phone behavior, visible focus, reduced-motion support, and 44px minimum targets.

### Task 3: Run two independent local review passes

**Files:**
- Review: `docs/superpowers/specs/2026-08-21-local-show-audio-engine-design.md`
- Review: `docs/superpowers/plans/2026-08-21-local-show-audio-engine.md`
- Review: `src/App.jsx`
- Review: `src/App.css`
- Review: `src/audio/showFlow.js`
- Review: `src/audio/showFlow.test.js`

- [x] VP/design-security pass: spot-check the real implementation for one-second hierarchy, parent surface grammar, audio-element continuity, focus behavior, and destructive-action placement.
- [x] Content/architecture pass: independently check action labels, pressure-safe instructions, edge/error states, next-cue determinism, and test coverage.
- [x] Record the local-review substitution required by the no-subagent instruction and incorporate every blocking finding.

#### Local review record

This session prohibited subagents, so the requested independent review was performed as two isolated local passes using the design-loop review contracts.

- **VP / design-security — SHIP IT.** Spot checks: one-action ready hierarchy (`src/App.jsx:1723`, `src/App.jsx:1777`), persistent safety controls (`src/App.jsx:1395`, `src/App.jsx:1409`), mounted audio continuity (`src/App.jsx:1691`, `src/App.jsx:1935`), destructive reset isolated behind the setup footer and custom confirmation (`src/App.jsx:1512`, `src/App.jsx:1947`), matte borderless focus surfaces (`src/App.css:242`, `src/App.css:1054`), sakura identity and reduced-motion support (`src/App.css:1077`, `src/App.css:2040`). Blocking findings incorporated: assigned-cue denominator, native reset/replay prompts, redundant inset/left borders, and missing Japanese reset copy.
- **Content / architecture — CLEAR TO SHIP.** Spot checks: deterministic next cue (`src/audio/showFlow.js:65`) with explicit coverage (`src/audio/showFlow.test.js:82`), action-specific audio recovery copy (`src/App.jsx:1075`, `src/App.jsx:1120`), focus-trapped dismissible dialogs (`src/App.jsx:443`, `src/App.jsx:480`), and bilingual time-critical cue labels (`src/App.jsx:1777`). No duplicate playback engine or unresolved blocker found.

### Task 4: Prove the web and native product

**Files:**
- Modify if required: `src/App.jsx`
- Modify if required: `src/App.css`
- Modify: `ios/App/App.xcodeproj/project.pbxproj`
- Add: `ios/ExportOptions.plist`

- [x] Run `CI=true npm test -- --runInBand` and record exact tests/failures: 1 suite, 9 tests, 0 failures.
- [x] Run `npm run build` and `npx cap sync ios`.
- [x] Start the production build and use a real browser to prove sound check, import, BGM autoplay, ready condensation, performance start, pause/resume, completion advancement, edit setup, stop, reset, keyboard behavior, and tablet/phone layouts.
- [x] Bump the release to marketing version `1.1.0`, build `4`, and configure automatic App Store Connect export for team `H87MY889P5`.
- [x] Build a signed generic-device archive, validate it, and upload it with Xcode; App Store Connect accepted the package and reported it processing.

### Task 5: Deliver the release without overstating state

**Files:**
- Commit only the DreamLIVE product, test, plan, spec, iOS version, and export-config changes.

- [x] Remove generated browser artifacts from the working tree without touching user-owned changes.
- [x] Review the final diff and run the verification commands once from the final tree.
- [ ] Commit and push `codex/local-show-audio-engine`; do not force or merge the unrelated rewritten `origin/main` history.
- [x] Upload the signed build to App Store Connect using the authenticated Xcode account.
- [x] Verify whether Apple reports uploaded, processing, processed/TestFlight-ready, submitted for review, approved, pending developer release, or live; report only the exact observed state and any remaining Apple-controlled gate. Observed: upload accepted and package processing; not submitted for review or live.

## Pre-resolved risks

- Physical device volume is not readable or controllable from the web layer; the product uses a repeatable room sound-check contract and saved app master level.
- Visual condensation must not stop playback; audio elements remain mounted and only presentation is hidden.
- Duplicate taps and delayed transitions already share the cancelable show-operation flow; the adaptive deck calls those existing handlers instead of creating a second playback engine.
- A build upload is not an App Store publication; every release state is reported separately.
- The local branch and force-rewritten remote `main` have unrelated ancestry; delivery uses the feature branch and forbids force-pushing or destructive reconciliation.

## Deliberate deferrals

- Loudness normalization, waveform analysis, cloud sync, remote control, and device-volume automation remain out of scope until real operating data demonstrates the need.
- No external music provider integration remains in the workflow.
