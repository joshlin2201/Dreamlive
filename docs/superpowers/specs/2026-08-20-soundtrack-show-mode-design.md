# Soundtrack Show Mode Design

**Date:** 2026-08-20
**Status:** Approved for implementation

## Outcome

DreamLIVE runs each performance without an operator switching to Spotify or manually matching two volume controls. The live-show screen has one obvious action: **Start performance**. DreamLIVE lowers the café music, confirms silence, plays the performance, and restores the café music afterward.

## Decision

Use Soundtrack as the café-music source and control its separate café player through Soundtrack's GraphQL API. Do not embed Spotify playback or combine Spotify audio with performance audio. Spotify's consumer platform is not licensed or designed for this commercial mixing workflow; Soundtrack is the supported commercial path and can import Spotify playlists.

The iPad app calls Soundtrack from a native Capacitor plugin. The Soundtrack API token is stored in the iOS Keychain and is never returned to JavaScript. The selected sound-zone identifier and pending recovery state are stored locally on the device.

## Operator Experience

### Main show screen

The main screen shows a compact **Café music** status card instead of a second music console:

- `Playing` with the current song and artist when available.
- `Ready` when café music can be controlled.
- `Needs attention` with a single recovery action when it cannot.

Each queued performance has one primary button. Its label narrates the current operation in plain language:

1. `Start performance`
2. `Lowering café music…`
3. `Starting performance…`
4. `Pause performance`
5. `Bringing café music back…`

Only one performance can transition or play at a time. Connected Show Mode removes café-music and performance volume sliders from the live path; levels are calibrated during setup, not during a show. Controls use sentence case, at least 44-point touch targets, high-contrast state feedback, and no API terms.

### One-time setup

A compact **Connect café music** panel accepts the Soundtrack API token and sound-zone ID. **Test and save** must verify the zone before enabling Show Mode. The token field is cleared immediately after native storage. Setup can be reopened from a small settings action but remains visually separate from show controls.

Until Soundtrack is configured, DreamLIVE retains its existing local background-music workflow unchanged.

### Failure and recovery

The sequence is fail-closed: performance audio does not begin until Soundtrack confirms the café player is paused at volume zero.

If automatic control fails, the screen says **Café music could not be muted** and offers **Try again**. The emergency path requires the operator to mute the physical mixer, explicitly confirm **Mixer is muted**, and only then enables **Start after manual mute**.

Before changing Soundtrack playback, the native plugin persists the original volume and whether music was playing. It clears that recovery record only after successful restoration. A crash, app restart, failed performance file, Reset, or performance end therefore surfaces **Restore café music** until the saved state is restored.

## Control Sequence

### Start

1. Query Soundtrack for the zone's current playback state and volume.
2. Persist the recovery record.
3. Ramp volume through integer steps to zero and pause playback.
4. Query again and require `paused` plus volume `0`.
5. Start the selected local performance audio.
6. If local playback fails, immediately run restoration.

### Finish or Reset

1. Stop or finish the performance.
2. If café music was previously playing, issue play while volume remains zero.
3. Ramp back to the saved volume.
4. Confirm the resulting state and volume.
5. Clear the recovery record.

If café music was already paused before a performance, restoration returns it to paused rather than starting it.

## Native Boundary

The iOS plugin exposes only these app operations:

- configure or clear Soundtrack setup;
- read safe configuration and zone status;
- prepare café music for a performance;
- restore café music after a performance.

GraphQL details, credentials, Keychain access, retry behavior, and recovery persistence stay behind the native boundary. Soundtrack mutations use `setVolume`, `pause`, and `play`; status checks use the configured `soundZone` playback state and volume.

## Verification

- Controller tests prove prepare-before-play, no play after failed preparation, restoration on end/reset/local-play failure, and unchanged local-mode behavior.
- An iOS build proves the native plugin compiles and links.
- The production web build must pass.
- Browser QA uses a development-only simulated Soundtrack adapter to verify ready, transition, playing, error, manual-mute, and recovery states on the real rendered screen.

## Release Boundary

This implementation can ship code and an unconfigured fallback without purchasing or activating a Soundtrack account. A live café rollout additionally requires a Soundtrack subscription/player, an API token, the café sound-zone ID, level calibration at the physical mixer, and a real end-to-end sound check.
