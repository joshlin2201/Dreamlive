# Dreamlive Pro

## Project Overview
Dream Live Pro is a Maid Cafe Performance Controller, originally built as a web application with Electron and Cordova support. It is now being transitioned into a native iPad application using Capacitor.

## Tech Stack
- **Frontend**: React 19, Framer Motion, Lucide React
- **Styling**: Vanilla CSS (based on `App.css`)
- **Native Wrapper**: Capacitor (iOS/iPad targeting)
- **Desktop Wrapper**: Electron

## Testing Commands
- `npm run dev`: Start React dev server
- `npx cap open ios`: Open the iOS project in Xcode

## Critical Warnings
- Ensure all audio assets in the `audio` folder are correctly linked and accessible in the native environment.
- Responsive design focuses on iPad aspect ratios.
