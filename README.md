# Dream Live Pro

A professional audio controller application designed for maid cafe performances. Features multiple audio channels with individual controls and a master pause function.

## Features

- **6 Audio Channels**: Background Music, 4 Performance channels, and Sound Effects
- **Dropdown File Selection**: Choose audio files from a folder in alphabetical order
- **Individual Controls**: Play/pause, volume, mute, seek, and reset for each channel
- **Pause All Audio**: Emergency button to pause all playing audio at once
- **Custom Folder Support**: Select any folder containing your audio files
- **Desktop Application**: Runs as a native Windows/Mac application

## Installation & Setup

### 1. Development Mode (Testing on Mac)

```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev
```

This will start the React development server and launch the Electron app.

### 2. Add Your Audio Files

Create an `audio` folder in the project root and add your audio files:

```
Dreamlive/
  ├── audio/
  │   ├── song1.mp3
  │   ├── song2.mp3
  │   └── effects.wav
  └── ...
```

Supported formats: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`

### 3. Build for Production

#### Build Windows .exe:
```bash
npm run electron:build-win
```

#### Build Mac .dmg (for testing on Mac):
```bash
npm run electron:build-mac
```

#### Build for all platforms:
```bash
npm run dist
```

The built applications will be in the `dist` folder.

## Using the Application

### On First Launch:

1. **Default Audio Folder**: The app looks for an `audio` folder next to the executable
2. **Custom Folder**: Click "Select Folder" to choose a different location
3. **Refresh**: Click the refresh icon to reload files after adding new audio

### Controls:

- **File Selection**: Use the dropdown menu to select an audio file for each channel
- **Play/Pause**: Large button to control playback
- **Reset**: Return to the beginning of the track
- **Timeline**: Seek to any position in the track
- **Volume**: Adjust volume and mute for each channel independently
- **Pause All Audio**: Bottom button stops all currently playing audio

## Distribution

When distributing your Windows .exe:

1. Create an `audio` folder next to the installer
2. Copy your audio files into that folder
3. Users can also select their own folder using the "Select Folder" button

## Technical Details

- **Framework**: React 19 + Electron
- **UI Icons**: Lucide React
- **Build Tool**: electron-builder
- **Supported OS**: Windows (primary), macOS (testing), Linux (optional)

## File Structure

```
Dreamlive/
├── src/
│   ├── components/
│   │   └── AudioChannel.jsx    # Individual audio channel component
│   ├── App.jsx                  # Main application
│   ├── App.css                  # Styles
│   └── index.jsx               # Entry point
├── public/
│   └── index.html              # HTML template
├── audio/                       # Your audio files go here
├── electron.js                  # Electron main process
├── preload.js                   # Electron preload script
└── package.json                 # Configuration and dependencies
```

## Development Notes

- Files are automatically sorted alphabetically in dropdowns
- The app remembers which files are selected in each channel
- All audio playback is independent per channel
- The "Pause All" button doesn't reset the audio, just pauses it

## Troubleshooting

**No audio files showing:**
- Check that audio files are in the correct folder
- Click the refresh button
- Try selecting a custom folder

**Can't hear audio:**
- Check individual channel volume
- Check if channel is muted
- Verify the file is a supported format

**Build fails:**
- Ensure all dependencies are installed: `npm install`
- Check Node.js version (v18+ recommended)
- Try deleting `node_modules` and reinstalling

## License

MIT License - Feel free to use and modify for your maid cafe!

---

Made with ❤️ for Dream Live Maid Cafe
