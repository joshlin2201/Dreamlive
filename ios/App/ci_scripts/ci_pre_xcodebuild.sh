#!/bin/sh
# Xcode Cloud stamps its own run counter as the bundle version, and this app
# already has builds up to 18 in App Store Connect from local archives — so a
# cloud run numbered 9 uploads as "9" and Apple rejects it for going backwards.
#
# Offsetting keeps it monotonic: every future run is CI_BUILD_NUMBER + OFFSET,
# which is always higher than the last one and always above the local builds.
set -eu

OFFSET=20
BUILD_NUMBER=$((CI_BUILD_NUMBER + OFFSET))

cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"
agvtool new-version -all "$BUILD_NUMBER"

echo "bundle version set to $BUILD_NUMBER (run $CI_BUILD_NUMBER + $OFFSET)"
