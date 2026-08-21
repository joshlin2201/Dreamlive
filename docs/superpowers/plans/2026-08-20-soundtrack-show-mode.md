# Soundtrack Show Mode Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Give DreamLIVE operators one safe Start performance control that automatically lowers and restores Soundtrack café music, while preserving the existing local-BGM fallback.

**Architecture:** A pure JavaScript orchestration module owns the prepare/play/restore ordering and phases. `App.jsx` maps those phases to plain-language controls. A local Capacitor iOS plugin owns Soundtrack GraphQL, Keychain credentials, and crash-safe recovery state; a custom `CAPBridgeViewController` registers it. A development-only browser adapter makes every operator state visually testable without credentials.

**Tech Stack:** React 19, Jest through react-scripts, Capacitor 7, Swift 5, URLSession, Security/Keychain, Soundtrack GraphQL API, Xcode build tools.

---

### Task 1: Prove the safety sequence in a pure orchestration check

**Files:**
- Create: `src/soundtrack/showMode.js`
- Test: `src/soundtrack/showMode.test.js`

**Step 1: Write the failing test**

Cover these invariants with small Jest tests:

```js
await startShowPerformance({
  music: { preparePerformance, restoreBackground },
  playPerformance,
  onPhase,
});

expect(preparePerformance.mock.invocationCallOrder[0])
  .toBeLessThan(playPerformance.mock.invocationCallOrder[0]);
expect(onPhase).toHaveBeenCalledWith('playing');
```

Also prove: a prepare failure never calls local playback; a local playback failure calls restoration; finish/reset restoration passes through `restoring` then `ready`; restoration failure ends in `recovery-needed`.

**Step 2: Run the test to verify it fails**

Run: `npm test -- --watchAll=false src/soundtrack/showMode.test.js`

Expected: FAIL because `showMode.js` does not exist.

**Step 3: Write the minimum implementation**

Export phase constants plus `startShowPerformance` and `restoreShowMusic`. Keep API details out of this file; accept the music and playback operations as dependencies. Always prepare before playback, restore after a playback exception, and report phases through `onPhase`.

**Step 4: Run the test to verify it passes**

Run: `npm test -- --watchAll=false src/soundtrack/showMode.test.js`

Expected: PASS.

### Task 2: Add the secure Soundtrack native boundary

**Files:**
- Create: `ios/App/App/SoundtrackControllerPlugin.swift`
- Create: `ios/App/App/BridgeViewController.swift`
- Modify: `ios/App/App/Base.lproj/Main.storyboard`
- Modify: `ios/App/App.xcodeproj/project.pbxproj`

**Step 1: Implement the bridged plugin surface**

Create a `CAPPlugin, CAPBridgedPlugin` named `SoundtrackController` with promise methods:

```swift
configure
clearConfiguration
getConfigurationStatus
getStatus
preparePerformance
restoreBackground
```

Validate non-empty token and zone ID at the native trust boundary. Store the token using a Keychain generic-password item and store only the zone ID and recovery record in `UserDefaults`. Never resolve a token back to JavaScript.

**Step 2: Implement GraphQL and crash-safe transitions**

Use `URLSession` against `https://api.soundtrackyourbrand.com/v2` with `Authorization: Basic <token>`. Treat HTTP failures, malformed payloads, GraphQL `errors`, an offline zone, or an unexpected final state as failures.

Before mutations, save `{originalVolume, wasPlaying, zoneId}`. Ramp integer Soundtrack volume values to zero, pause, and confirm volume zero plus paused state. Restoration starts playback at zero only when it was previously playing, ramps to the saved volume, confirms, then clears recovery. Preserve recovery on every failure.

**Step 3: Register the local plugin**

Subclass `CAPBridgeViewController`, override `capacitorDidLoad()`, and call:

```swift
bridge?.registerPluginInstance(SoundtrackControllerPlugin())
```

Point the storyboard scene at the app module's subclass and add both Swift files to the Xcode project Sources phase.

**Step 4: Compile the native target**

Run: `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build`

Expected: `** BUILD SUCCEEDED **`.

### Task 3: Add the JavaScript controller and development simulator

**Files:**
- Create: `src/soundtrack/soundtrackController.js`
- Test: `src/soundtrack/soundtrackController.test.js`

**Step 1: Write the failing client-contract test**

Prove configuration payloads are trimmed, the token is never exposed by status results, and the development simulator supports ready, prepare, restore, blocked, and recovery states.

**Step 2: Run the test to verify it fails**

Run: `npm test -- --watchAll=false src/soundtrack/soundtrackController.test.js`

Expected: FAIL because the controller does not exist.

**Step 3: Implement the wrapper**

Use Capacitor `registerPlugin('SoundtrackController')` on native iOS. Export a small stable interface with `configure`, `clearConfiguration`, `getConfigurationStatus`, `getStatus`, `preparePerformance`, and `restoreBackground`. In development web builds only, enable an in-memory simulator with `REACT_APP_SOUNDTRACK_DEMO=1`; do not include credentials or remote network calls in browser code.

**Step 4: Run the test to verify it passes**

Run: `npm test -- --watchAll=false src/soundtrack/soundtrackController.test.js`

Expected: PASS.

### Task 4: Integrate one-button Show Mode without disturbing local audio fixes

**Files:**
- Modify: `src/App.jsx`

**Step 1: Add Show Mode state and startup recovery**

Track safe configuration status, current café-music status, transition phase, setup-panel state, operator error, manual-mute confirmation, and the pending performance index. On mount, read configuration and status. If native recovery is pending, make Restore café music the only primary recovery action.

**Step 2: Route the shared performance start and finish paths**

Refactor only the existing `startPerformance`, `handlePerformanceEnd`, and `resetAll` callers:

- Connected mode calls `startShowPerformance`, then the existing local performance warm-up/play path.
- Local mode keeps the current background-track guard and fade behavior.
- Playback failure, natural end, and Reset all route through `restoreShowMusic` in connected mode.
- Other performance Start actions are disabled throughout a transition.

Preserve the user's existing `ensureAudioReady`, `muteGain`, and `fadeGainTo` changes verbatim except where the shared start helper must call them.

**Step 3: Replace connected-mode controls with the operator contract**

When connected, replace the local BGM selector/player/volume section with a compact café-music card showing state, track, artist, and one settings affordance. Performance cards show one primary action with labels derived from phase. Hide live volume sliders in connected mode.

When unconfigured, keep local BGM controls and add a quiet Connect café music action. The setup form contains token, zone ID, Test and save, and Cancel. Clear the token input after submission.

On prepare failure, render Café music could not be muted, Try again, a Mixer is muted checkbox, and a disabled-until-confirmed Start after manual mute action.

### Task 5: Make the show surface calm, touch-safe, and self-explanatory

**Files:**
- Modify: `src/App.css`

**Step 1: Add the Show Mode visual grammar**

Add styles for the café status card, semantic state dot, metadata, settings drawer, transition button, recovery panel, and manual-mute confirmation. Reuse existing Dreamland pink tokens, but use quieter surfaces and clear hierarchy. Main touch targets are at least 44px; focus-visible rings are obvious; text remains readable at iPad widths and narrow mobile widths.

**Step 2: Keep local mode visually stable**

Scope new selectors under Show Mode classes and avoid broad changes to existing local-background or performance layout.

### Task 6: Verify behavior, build output, and real rendered states

**Files:**
- No production files expected

**Step 1: Run focused and full checks**

Run:

```bash
npm test -- --watchAll=false src/soundtrack/showMode.test.js src/soundtrack/soundtrackController.test.js
npm test -- --watchAll=false
npm run build
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
git diff --check
```

Expected: all tests pass, React build succeeds, iOS build succeeds, and no whitespace errors.

**Step 2: Browser-verify operator states**

Run the actual app with `REACT_APP_SOUNDTRACK_DEMO=1`, load a representative local audio file where needed, and inspect at iPad portrait and narrow widths. Capture ready, transition/playing, failure/manual-mute, and recovery states. Confirm keyboard focus, disabled states, no clipped copy, one dominant action, and no raw API language on the live-show path.

**Step 3: Review against the three operating personas**

Verify the live-show lead can start without leaving DreamLIVE; relief staff can identify the next action without training; a technical operator can reach setup/recovery without cluttering the main show screen.

### Task 7: Record release state and operational closeout

**Files:**
- Modify only the Dreamland HQ project ledger/receipt files required by Marina OS after inspecting their current structure.

Record code/build/browser proof separately from live café rollout. Mark account subscription, physical Soundtrack player, token/zone entry, mixer calibration, and real sound check as unexecuted external rollout gates; do not purchase, deploy, or claim live status.
