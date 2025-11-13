# Dream Live Pro - Quick Start Guide

## What You Got

A complete desktop audio controller with:
- ✅ **6 audio channels** (Background Music, 4 Performances, Sound Effects)
- ✅ **Dropdown file selection** - no upload buttons needed!
- ✅ **Alphabetically sorted** audio files
- ✅ **Pause All Audio button** at the bottom
- ✅ **Individual controls** for each channel (play, pause, volume, seek, reset)
- ✅ **Folder selection** - choose any folder with your audio files
- ✅ **Ready to build** as Windows .exe

## Quick Test on Mac

```bash
# 1. Add some audio files to the 'audio' folder first
cp ~/Music/*.mp3 ./audio/

# 2. Run the app
npm run electron:dev
```

The app window should open automatically!

## How to Use

1. **Add Audio Files**: Put .mp3, .wav, or other audio files in the `audio` folder
2. **Select Files**: Use the dropdown menu on each channel to select a file
3. **Control Playback**: Each channel has its own play/pause, volume, and seek controls
4. **Emergency Stop**: The big "Pause All Audio" button at the bottom stops everything

## Build Windows .exe

```bash
# Build for Windows (creates installer)
npm run electron:build-win
```

Your `.exe` installer will be in the `dist/` folder!

## Build for Mac (Testing Only)

```bash
# Build for Mac
npm run electron:build-mac
```

## Project Structure

```
Dreamlive/
├── audio/              👈 PUT YOUR AUDIO FILES HERE
├── src/
│   ├── App.jsx        👈 Main app
│   ├── components/
│   │   └── AudioChannel.jsx  👈 Each audio channel
│   └── App.css        👈 All styling
├── electron.js        👈 Desktop app logic
└── package.json       👈 Build configuration
```

## Distributing to Users

When you give someone the Windows .exe:

1. They install the app
2. Create an `audio` folder next to the installed app
3. Put audio files in that folder
4. OR use "Select Folder" button to choose a custom location

## Customization

Want to change the channels?

Edit [src/App.jsx:75-82](src/App.jsx#L75-L82):

```javascript
const channels = [
  { id: 1, title: 'Background Music' },
  { id: 2, title: 'Performance 1' },
  // Add more channels here!
];
```

## Features Breakdown

### Each Audio Channel Has:
- Dropdown to select audio file (alphabetically sorted)
- Play/Pause button
- Reset button (return to start)
- Timeline slider (seek anywhere in the track)
- Volume slider
- Mute button
- Current time / Total duration display

### Global Controls:
- "Select Folder" - choose custom audio folder
- "Refresh" - reload files after adding new ones
- "Pause All Audio" - emergency stop for all channels

## Supported Audio Formats

- .mp3
- .wav
- .ogg
- .m4a
- .flac

## Tips

- **Number your files** for ordering: `01-intro.mp3`, `02-main.mp3`, etc.
- Files appear in **alphabetical order** in dropdowns
- The app remembers which file is selected in each channel
- Each channel plays independently
- "Pause All" doesn't reset playback position

## Commands Reference

```bash
# Development
npm run electron:dev          # Run app in dev mode (hot reload)

# Building
npm run electron:build-win    # Build Windows installer
npm run electron:build-mac    # Build Mac .dmg
npm run dist                  # Build for all platforms

# React only (for debugging UI)
npm start                     # Just React, no Electron
npm run build                 # Production React build
```

## Troubleshooting

**App won't start?**
- Make sure you ran `npm install`
- Check Node.js version: `node --version` (need v18+)

**No audio files showing?**
- Check files are in `audio/` folder
- Click the refresh button
- Try "Select Folder" to choose a different location

**Can't build Windows .exe on Mac?**
- This is normal! electron-builder can cross-compile
- The build will work, but it creates a Windows installer that only runs on Windows

**Want to test the .exe?**
- You'll need a Windows machine or VM
- Or just test with the Mac .dmg version using `npm run electron:build-mac`

## What's Next?

1. **Test it**: Run `npm run electron:dev` to see it in action
2. **Add your audio**: Copy your performance audio files to the `audio/` folder
3. **Build it**: Run `npm run electron:build-win` to create the Windows installer
4. **Distribute**: Share the installer from the `dist/` folder

---

Ready to rock your maid cafe performances! 🎵✨
