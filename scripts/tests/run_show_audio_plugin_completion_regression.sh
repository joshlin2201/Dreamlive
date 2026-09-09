#!/bin/bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/show-audio-plugin-test.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT

swiftc \
  -emit-library -emit-module -module-name Capacitor \
  "$repo_root/scripts/tests/capacitor_test_stub.swift" \
  -o "$scratch/libCapacitor.dylib" \
  -emit-module-path "$scratch/Capacitor.swiftmodule"

swiftc \
  -I "$scratch" -L "$scratch" -lCapacitor \
  -framework AVFoundation -framework MediaPlayer \
  "$repo_root/ios/App/App/ShowAudioPlugin.swift" \
  "$repo_root/scripts/tests/show_audio_plugin_completion_regression.swift" \
  -o "$scratch/show-audio-plugin-completion-regression"

DYLD_LIBRARY_PATH="$scratch${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}" \
  "$scratch/show-audio-plugin-completion-regression"
