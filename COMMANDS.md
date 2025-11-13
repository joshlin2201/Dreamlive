# Dream Live Pro - Command Reference

## 🚀 Quick Commands

### First Time Setup
```bash
npm install                   # Install all dependencies (do this first!)
```

### Development & Testing
```bash
npm run electron:dev          # Run app in development mode (Mac/Windows)
                             # - Includes hot reload
                             # - Opens DevTools
                             # - Perfect for testing
```

### Building Executables

#### Windows .exe (Main Target)
```bash
npm run electron:build-win    # Build Windows installer
                             # Output: dist/Dream Live Pro Setup 1.0.0.exe
                             # Size: ~150-200MB
```

#### Mac .dmg (For Testing)
```bash
npm run electron:build-mac    # Build Mac installer
                             # Output: dist/Dream Live Pro-1.0.0.dmg
                             # Size: ~150-200MB
```

#### All Platforms
```bash
npm run dist                  # Build for Windows, Mac, and Linux
                             # Takes longer, builds everything
```

### React Only (No Electron)
```bash
npm start                     # Just React dev server
                             # Opens in browser at localhost:3000
                             # Use for testing UI only

npm run build                 # Build production React bundle
                             # Output: build/ folder
```

## 📁 Output Locations

### After Building
```
Dreamlive/
├── dist/
│   ├── Dream Live Pro Setup 1.0.0.exe    # Windows installer (NSIS)
│   ├── Dream Live Pro-1.0.0.dmg          # Mac disk image
│   ├── win-unpacked/                      # Windows portable (no install)
│   └── mac/                               # Mac app bundle
└── build/
    └── [React production files]           # Web version (if built)
```

## 🎯 Common Workflows

### Workflow 1: Test on Mac
```bash
npm install
npm run electron:dev
# App window opens → test features
# Ctrl+C to stop
```

### Workflow 2: Build Windows Executable
```bash
npm install                   # If not done yet
npm run electron:build-win   # Build
# Find installer in dist/ folder
# Copy to Windows PC to test
```

### Workflow 3: Full Build for Distribution
```bash
npm install
npm run dist
# All installers in dist/
# Distribute the appropriate file for each platform
```

### Workflow 4: Quick UI Changes
```bash
npm start                    # Just React, fast reload
# Edit src/App.jsx or src/App.css
# See changes instantly in browser
# When happy, test with: npm run electron:dev
```

## 🛠️ Troubleshooting Commands

### Clear Everything and Reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

### Clear Build Cache
```bash
rm -rf build dist
npm run build
```

### Check Node Version
```bash
node --version               # Should be v18 or higher
npm --version                # Should be v8 or higher
```

### Audit Dependencies
```bash
npm audit                    # Check for vulnerabilities
npm audit fix                # Try to fix them
```

## ⚡ Speed Tips

### Faster Development
```bash
# Terminal 1: Keep React running
npm start

# Terminal 2: Run Electron when needed
npm run electron:dev
```

### Skip Platform Builds
```bash
# Only build for the platform you need:
npm run electron:build-win   # Windows only (fastest)
npm run electron:build-mac   # Mac only (fastest)
npm run dist                 # All platforms (slowest)
```

## 🎮 Keyboard Shortcuts (In Dev Mode)

When running `npm run electron:dev`:

- **Cmd/Ctrl + R**: Reload app
- **Cmd/Ctrl + Shift + I**: Toggle DevTools (Mac)
- **F12**: Toggle DevTools (Windows)
- **Cmd/Ctrl + Q**: Quit app

## 📦 Package Scripts Explained

| Command | What It Does |
|---------|-------------|
| `npm start` | Runs React dev server (port 3000) |
| `npm run build` | Builds React for production |
| `npm run electron:dev` | Runs Electron + React together (dev mode) |
| `npm run electron:build` | Builds for current platform |
| `npm run electron:build-win` | Builds Windows .exe |
| `npm run electron:build-mac` | Builds Mac .dmg |
| `npm run dist` | Builds for all platforms |

## 🐛 Debug Commands

### Check if React is Running
```bash
curl http://localhost:3000
# Should return HTML if React dev server is running
```

### Check Electron Process
```bash
ps aux | grep electron       # Mac/Linux
tasklist | findstr electron  # Windows
```

### View Build Logs
```bash
npm run electron:build-win --verbose   # Detailed build output
```

## 🔥 One-Liner Workflows

### Full Clean Build (Windows)
```bash
rm -rf node_modules build dist && npm install && npm run electron:build-win
```

### Full Clean Build (Mac)
```bash
rm -rf node_modules build dist && npm install && npm run electron:build-mac
```

### Quick Test Cycle
```bash
npm run electron:dev || (npm install && npm run electron:dev)
```

## 📊 File Size Reference

| Item | Size |
|------|------|
| node_modules/ | ~400-500MB |
| dist/ (after build) | ~150-200MB |
| Source code | ~50KB |
| Final .exe installer | ~70-90MB (compressed) |
| Installed app | ~150-200MB |

## 🎓 Learning Commands

### Inspect Package.json Scripts
```bash
npm run                      # Lists all available scripts
```

### Check Installed Packages
```bash
npm list --depth=0          # Show top-level dependencies
```

### Check for Updates
```bash
npm outdated                # See which packages can be updated
```

## ⚙️ Environment Variables

### Set Development Mode
```bash
NODE_ENV=development npm run electron:dev   # Explicitly dev mode
NODE_ENV=production npm run electron:dev    # Production mode
```

### Disable Browser Opening
```bash
BROWSER=none npm start      # Already configured in electron:dev
```

## 💾 Build Settings (package.json)

Key configurations you might want to change:

```json
{
  "name": "dreamlive-pro",           // App internal name
  "version": "1.0.0",                // Version number (shows in installer)
  "description": "...",              // App description
  "build": {
    "appId": "com.dreamlive.pro",   // Unique app identifier
    "productName": "Dream Live Pro" // Display name
  }
}
```

## 🎯 Production Checklist

Before distributing your .exe:

```bash
# 1. Update version
# Edit package.json: "version": "1.0.0" → "1.0.1"

# 2. Test in dev mode
npm run electron:dev

# 3. Build for Windows
npm run electron:build-win

# 4. Find installer
# Look in: dist/Dream Live Pro Setup 1.0.0.exe

# 5. Test installer on Windows
# Install and run the .exe on a Windows machine

# 6. Distribute
# Upload to website, Google Drive, or USB drive
```

## 🚨 Emergency Fixes

### App Won't Start
```bash
rm -rf node_modules
npm install
npm run electron:dev
```

### Build Fails
```bash
rm -rf dist build
npm run build
npm run electron:build-win
```

### React Errors
```bash
rm -rf build
npm start
# Fix any errors shown
npm run build
```

### Electron Errors
```bash
# Check electron.js for syntax errors
node electron.js
# Should show error if any
```

## 📞 Need Help?

```bash
npm run electron:dev -- --help      # Electron help
npm run build -- --help             # React Scripts help
npx electron-builder --help         # Builder options
```

---

**Pro Tip**: Bookmark this file! You'll reference it often during development and deployment.

**Most Used Commands**:
1. `npm install` (first time)
2. `npm run electron:dev` (testing)
3. `npm run electron:build-win` (building)

That's it! 🚀
