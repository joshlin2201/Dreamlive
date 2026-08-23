#!/bin/sh
# Xcode Cloud clones the repo and then builds ios/App/App.xcodeproj. The web
# bundle it wraps is generated, not committed, so it has to be produced here or
# the archive ships an app with no interface.
#
# This also exists because App Store submissions cannot be built on a beta
# macOS (ITMS-90111), and the machine this app is developed on runs one.
set -eu

cd "$CI_PRIMARY_REPOSITORY_PATH"

if ! command -v node > /dev/null 2>&1; then
  echo "installing node"
  brew install node@20
  brew link --overwrite --force node@20
fi

echo "node $(node -v), npm $(npm -v)"

npm ci --no-audit --no-fund

CI=true npx react-scripts test --watchAll=false
CI=true npm run build

npx cap sync ios
node scripts/enforce-ios-deployment-target.mjs

# Prove the archive will carry this build, not an empty shell.
test -f ios/App/App/public/index.html
grep -q 'static/js/main\.' ios/App/App/public/index.html
echo "web bundle in place: $(grep -o 'main\.[0-9a-f]*\.js' ios/App/App/public/index.html | head -1)"
