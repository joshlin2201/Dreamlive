# Dream Live Pro - Feature Showcase

## 🎵 Application Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  DREAM LIVE PRO                    [Select Folder] [🔄]         │
│  Maid Cafe Performance Controller                               │
├─────────────────────────────────────────────────────────────────┤
│  Audio Folder: /Users/you/audio                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐   │
│  │ 🎵 Background Music      │  │ 🎤 Performance 1         │   │
│  ├──────────────────────────┤  ├──────────────────────────┤   │
│  │ Select Audio:            │  │ Select Audio:            │   │
│  │ [01-background.mp3  ▼]   │  │ [02-song-1.mp3      ▼]   │   │
│  │                          │  │                          │   │
│  │  [▶️]  [🔄]              │  │  [⏸️]  [🔄]              │   │
│  │                          │  │                          │   │
│  │  0:45  ▓▓▓░░░░░  3:22    │  │  1:23  ▓▓▓▓▓░░░  2:45    │   │
│  │                          │  │                          │   │
│  │  [🔊] ▓▓▓▓▓▓▓░░  70%     │  │  [🔊] ▓▓▓▓▓▓▓▓▓  90%     │   │
│  │                          │  │                          │   │
│  │  📄 01-background.mp3    │  │  📄 02-song-1.mp3        │   │
│  └──────────────────────────┘  └──────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐   │
│  │ 🎤 Performance 2         │  │ 🎤 Performance 3         │   │
│  ├──────────────────────────┤  ├──────────────────────────┤   │
│  │ Select Audio:            │  │ Select Audio:            │   │
│  │ [-- Choose a file -- ▼]  │  │ [03-song-2.mp3      ▼]   │   │
│  │                          │  │                          │   │
│  │  [▶️]  [🔄]              │  │  [▶️]  [🔄]              │   │
│  │                          │  │                          │   │
│  │  0:00  ░░░░░░░░░  0:00   │  │  0:00  ░░░░░░░░░  4:12   │   │
│  │                          │  │                          │   │
│  │  [🔊] ▓▓▓▓▓▓▓▓▓  100%    │  │  [🔊] ▓▓▓▓▓░░░░  50%     │   │
│  └──────────────────────────┘  └──────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐   │
│  │ 🎤 Performance 4         │  │ 🔔 Sound Effects         │   │
│  ├──────────────────────────┤  ├──────────────────────────┤   │
│  │ Select Audio:            │  │ Select Audio:            │   │
│  │ [-- Choose a file -- ▼]  │  │ [applause.wav       ▼]   │   │
│  │                          │  │                          │   │
│  │  [▶️]  [🔄]              │  │  [▶️]  [🔄]              │   │
│  │                          │  │                          │   │
│  │  0:00  ░░░░░░░░░  0:00   │  │  0:00  ░░░░░░░░░  0:05   │   │
│  │                          │  │                          │   │
│  │  [🔊] ▓▓▓▓▓▓▓▓▓  100%    │  │  [🔊] ▓▓▓▓▓▓▓▓▓  100%    │   │
│  └──────────────────────────┘  └──────────────────────────┘   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│               [⏸️  PAUSE ALL AUDIO]        6 audio files        │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Key Features (Your Requirements)

### ✅ Feature 1: Dropdown File Selection
**What you asked for**: "instead of upload buttons a drop down that pull file name in alphabetical order"

**What you got**:
- Clean dropdown menus on each channel
- Files automatically loaded from `audio/` folder
- Sorted alphabetically (A-Z)
- No upload buttons anywhere
- Just select from the list!

**Location**: Each audio channel has a dropdown at the top

### ✅ Feature 2: Pause All Audio Button
**What you asked for**: "button at bottom to pause all audio"

**What you got**:
- Large, prominent button at the bottom
- Pauses ALL playing audio channels simultaneously
- Perfect for emergency stops during performances
- Doesn't reset playback position (can resume later)

**Location**: Bottom footer, centered

## 🎚️ Individual Channel Controls

Each of the 6 channels includes:

### 1. File Selection Dropdown
```
┌─────────────────────────────┐
│ Select Audio:               │
│ ┌─────────────────────────┐ │
│ │ 01-song.mp3          ▼  │ │  ← Dropdown menu
│ └─────────────────────────┘ │
│   - Files sorted A-Z         │
│   - Automatically loaded     │
└─────────────────────────────┘
```

### 2. Playback Controls
```
┌──────────────┐
│  [▶️]  [🔄]  │  ← Play/Pause + Reset
└──────────────┘
```

### 3. Timeline Scrubber
```
┌────────────────────────────────┐
│  0:45  ▓▓▓▓▓▓░░░░░  3:22      │  ← Current time, seek bar, total time
└────────────────────────────────┘
```

### 4. Volume Control
```
┌────────────────────────────────┐
│  [🔊]  ▓▓▓▓▓▓▓▓░  80%          │  ← Mute button, slider, percentage
└────────────────────────────────┘
```

### 5. File Info Display
```
┌────────────────────────────────┐
│  📄 currently-playing-song.mp3 │  ← Shows selected file name
└────────────────────────────────┘
```

## 🎨 Color Scheme

- **Primary**: Pink/Red gradient (#e94560 → #ff6b9d) - Maid cafe vibes!
- **Background**: Dark blue gradient (#1a1a2e → #16213e)
- **Accent**: Glowing borders and shadows
- **Text**: White and light gray

## 📱 Responsive Layout

### Desktop (1200px+)
- 2 columns of audio channels
- Wide comfortable spacing
- All controls easily accessible

### Tablet (768px - 1200px)
- 1 column of audio channels
- Stacked vertically
- Touch-friendly controls

### Mobile (<768px)
- Single column
- Larger buttons
- Optimized for small screens

## 🎵 Audio File Management

### File Organization
```
Dreamlive/
  └── audio/
      ├── 01-background-calm.mp3
      ├── 02-performance-upbeat.mp3
      ├── 03-performance-slow.mp3
      ├── 04-interlude.mp3
      ├── 05-finale.mp3
      └── 06-applause.wav
```

**Pro Tip**: Prefix files with numbers (01-, 02-, etc.) to control the order they appear in dropdowns!

### Dropdown Behavior
- **Empty state**: Shows "-- Choose a file --"
- **After selection**: Shows the selected filename
- **Alphabetical**: Files sorted A to Z automatically
- **Updates**: Click refresh button to reload after adding files

## 🎛️ Control States

### Play Button States
- **▶️ Ready to play** (light blue/pink) - File selected, not playing
- **⏸️ Playing** (bright pink) - Currently playing audio
- **▶️ Disabled** (grayed out) - No file selected

### Volume States
- **🔊 Unmuted** - Normal audio output
- **🔇 Muted** - Audio silenced
- **Volume %** - Shows current volume level (0-100%)

### Timeline States
- **Before playback**: Gray bar at 0:00
- **During playback**: Fills with color as audio plays
- **Seekable**: Click/drag anywhere to jump to that position

## 🚀 Workflow Example

### Typical Performance Setup:

1. **Launch app** → Opens with 6 empty channels

2. **Select Background Music**
   - Channel 1 dropdown → "01-background-cafe.mp3"
   - Set volume to 30%
   - Click play

3. **Load Performance Songs**
   - Channel 2 → "02-opening-song.mp3"
   - Channel 3 → "03-main-performance.mp3"
   - Channel 4 → "04-encore.mp3"
   - Don't play yet, just load them

4. **Load Sound Effects**
   - Channel 6 → "applause.wav"
   - Set to 80% volume

5. **During Performance**
   - Play performance songs as needed
   - Use individual play/pause on each channel
   - Trigger sound effects when needed

6. **Emergency Stop**
   - Hit "PAUSE ALL AUDIO" if needed
   - All audio stops immediately
   - Can resume individually later

## 🎯 Use Case Scenarios

### Scenario 1: Maid Cafe Performance
- Background: Continuous ambient music (Channel 1)
- Performance 1-4: Different songs for different performers
- Sound Effects: Applause, bells, special effects

### Scenario 2: DJ Setup
- Background: Crowd ambience
- Performance 1-4: Different music tracks
- Sound Effects: Transitions, drops, effects

### Scenario 3: Theater Production
- Background: Scene ambience
- Performance 1-4: Scene-specific music
- Sound Effects: Door knocks, phone rings, etc.

## 💡 Pro Tips

1. **Organize files by number**: 01-, 02-, 03- for custom sorting
2. **Use descriptive names**: "opening-upbeat.mp3" vs "track1.mp3"
3. **Pre-load all files**: Select files before performance starts
4. **Test volume levels**: Adjust before going live
5. **Practice transitions**: Know which channel plays when
6. **Use Pause All**: Safety net for unexpected situations
7. **Keep files short**: Easier to manage than long tracks
8. **Separate effects**: Different channels for different purposes

## 🎪 The "Pause All" Button

```
┌───────────────────────────────────────────┐
│                                           │
│    [⏸️ PAUSE ALL AUDIO]  6 audio files   │
│                                           │
└───────────────────────────────────────────┘
          ↑                        ↑
     Big button!            File count display
```

**When to use**:
- 🚨 Emergency stop during performance
- 🎤 Need to make an announcement
- 📞 Taking a phone call
- 🔊 Volume too loud suddenly
- ⏸️ Need a break
- 🎭 Unexpected situation

**What it does**:
- Pauses ALL currently playing audio
- Doesn't stop/reset - just pauses
- Playback positions are saved
- Can resume individual channels after

**What it doesn't do**:
- Doesn't unload files
- Doesn't reset timelines to 0:00
- Doesn't change volume levels
- Doesn't affect mute states

## 🎊 Summary

You now have a **complete, production-ready desktop application** with:

✅ Dropdown file selection (alphabetically sorted)
✅ Pause all audio button (bottom of screen)
✅ 6 independent audio channels
✅ Professional UI with modern design
✅ Individual volume/playback controls
✅ Windows .exe export ready
✅ Mac support for testing
✅ Easy file management
✅ Emergency stop capability

**Ready to use for your maid cafe performances!** 🎵✨
