# 📴 Offline Usage Guide - Dream Live Pro

## PWA Offline Support (Already Built-in!)

Your app **already works offline** once installed as a PWA! Here's how:

### How PWA Offline Works:

1. **First Visit** (needs internet):
   - Open the app URL in Safari once
   - Install to home screen
   - App files are cached automatically

2. **After Installation** (works offline):
   - ✅ App launches without internet
   - ✅ All UI and controls work
   - ✅ Audio files you've loaded are stored locally
   - ✅ Everything cached in IndexedDB

### To Use Offline:

```
1. Deploy app to web (one-time, needs internet)
2. Open Safari, visit the URL
3. Add to Home Screen
4. Load your audio files using "Select Folder"
5. Close app

Now works completely offline! Turn off WiFi and launch - it works!
```

### What Works Offline:
- ✅ Full app interface
- ✅ All controls and buttons
- ✅ Audio playback
- ✅ Volume controls
- ✅ Status tracking
- ✅ Everything except loading NEW files from internet

### What Needs Internet:
- ❌ Initial installation (one-time only)
- ❌ Loading audio from external URLs (not applicable)
- ❌ App updates (optional)

## Option 2: Fully Offline Desktop App

If you want a **completely standalone app** that doesn't need ANY web deployment:

### Mac Desktop App (.app file)

```bash
# Build Mac app
npm run electron:build-mac

# Find it in:
# dist/mac/Dream Live Pro.app
```

**Pros:**
- Zero internet needed EVER
- Runs like a native Mac app
- Can load files from local folders easily
- No web deployment required

**Cons:**
- Only works on Mac (not iPad)
- Larger file size (~200MB)
- Need to rebuild for updates

### Windows Desktop App (.exe file)

```bash
# Build Windows app
npm run electron:build-win

# Find it in:
# dist/Dream Live Pro Setup.exe
```

## Recommended Approach for iPad Offline:

### ✅ Use PWA (Best for iPad)

**Setup (one-time, needs internet):**
```
1. Deploy to Netlify/Vercel (free, 2 minutes)
2. Open Safari on iPad, go to URL
3. Add to Home Screen
4. Load all your audio files
```

**Usage (fully offline):**
```
1. Launch from home screen
2. Works without internet!
3. All audio files stored locally
4. Full functionality offline
```

### Testing Offline Mode:

1. Install the PWA
2. Load your audio files
3. **Turn off WiFi/Airplane mode**
4. Close and reopen the app
5. Everything works! ✅

## Alternative: Local Network Only

If you don't want to deploy to the internet at all:

### Setup Local Server on Mac:

```bash
# Install serve
npm install -g serve

# Get your Mac's IP address
ipconfig getifaddr en0
# Example output: 192.168.1.100

# Serve the app
cd /Users/joshlin/Code/Dreamlive
serve -s build -p 3000

# Keep this terminal open
```

### Connect iPad to Local Server:

```
1. Make sure iPad and Mac are on SAME WiFi
2. On iPad Safari, go to: http://192.168.1.100:3000
   (use your actual IP from above)
3. Add to Home Screen
4. Load audio files
5. Works offline after initial load!
```

**Pros:**
- No internet deployment needed
- Data stays on local network
- Still works offline after first load

**Cons:**
- Mac must be running the server for first load
- Only works on your local network

## Storage Capacity

### PWA Storage (IndexedDB):
- **Typical**: 50-100MB+ audio storage
- **Safari on iPad**: Usually allows several hundred MB
- Enough for dozens of songs

### Desktop App (Electron):
- **Unlimited**: Access entire hard drive
- Load files from any folder
- No storage limits

## Recommendations by Use Case:

### For iPad at Maid Cafe (with WiFi):
👉 **Use PWA** - Deploy once, works offline forever

### For iPad Completely Offline:
👉 **Use PWA + Local Server** - Set up once on local network

### For Mac/Windows Desktop:
👉 **Use Electron App** - Build .app or .exe, fully standalone

### For Both iPad and Desktop:
👉 **Deploy PWA** for iPad, **Build Electron** for desktop

## FAQ

**Q: If I install the PWA, can I use it on a plane?**
A: Yes! Once installed and audio loaded, works 100% offline.

**Q: Do audio files stay on the iPad?**
A: Yes, stored in IndexedDB. Persist until you clear Safari data.

**Q: Can I update the app offline?**
A: No. Updates require internet connection. But app works as-is offline.

**Q: What if iPad storage is full?**
A: Safari may clear cached data. Keep audio files small or use desktop app.

## Summary

**Your current PWA already supports offline use!**

Just:
1. Deploy once (free, 2 minutes)
2. Install to iPad home screen
3. Load your audio files
4. Works offline indefinitely

No additional setup needed for offline functionality - it's built-in! 🎵✨
