# Dream Live Pro - iPad PWA Deployment Guide

## Quick Start for iPad

The app is now built and ready to deploy as a Progressive Web App (PWA) for iPad!

## Option 1: Deploy to a Web Server (Recommended)

### Upload to Your Web Host

1. **Upload the `build` folder contents** to your web server
   - Use FTP, SFTP, or your hosting control panel
   - Upload everything inside the `build/` folder to your web root (e.g., `public_html/`)

2. **Recommended Hosts:**
   - **Vercel** (easiest, free): https://vercel.com
   - **Netlify** (easy, free): https://netlify.com
   - **GitHub Pages** (free)
   - **Your own web hosting**

### Deploy to Vercel (Easiest Method)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (from project root)
vercel --prod

# Follow the prompts - it will deploy the build folder automatically
```

### Deploy to Netlify

1. Go to https://app.netlify.com/drop
2. Drag and drop the entire `build` folder
3. Done! You'll get a URL like `https://your-app.netlify.app`

## Option 2: Use on Local Network (For Testing)

### Serve Locally and Access from iPad

```bash
# Install serve globally (one-time)
npm install -g serve

# Serve the build folder
serve -s build -p 3000

# Get your local IP address
ipconfig getifaddr en0
```

Then on your iPad:
1. Open Safari
2. Go to `http://YOUR-IP-ADDRESS:3000`
3. Test the app

## Installing as PWA on iPad

Once your app is live on a web server (HTTPS required):

1. **Open Safari on iPad** and go to your app URL
2. **Tap the Share button** (square with arrow)
3. **Tap "Add to Home Screen"**
4. **Name it** "Dream Live Pro"
5. **Tap "Add"**

The app will now:
- Have its own icon on the home screen
- Open in fullscreen (no Safari UI)
- Work in landscape mode
- Cache audio files for offline use
- Feel like a native app

## Audio File Management

### For PWA (iPad):
The app uses IndexedDB to store audio files locally on the iPad.

**To add music:**
1. Open the app
2. Tap "Select Folder" button
3. Choose audio files from iPad storage
4. Files are cached locally for offline use

**Supported formats:**
- MP3, WAV, OGG, M4A, FLAC

## Updating the App

After making changes:

```bash
# Rebuild
npm run build

# Redeploy (upload new build folder to your host)
```

For Vercel/Netlify, users will get updates automatically on next app launch.

## Technical Details

### PWA Features Included:
- ✅ Service Worker for offline functionality
- ✅ Web App Manifest for install-to-home-screen
- ✅ IndexedDB for audio file storage
- ✅ Touch-optimized UI (44px+ touch targets)
- ✅ Landscape orientation lock
- ✅ iOS-specific meta tags

### Files in Build:
- `index.html` - Main app entry point
- `manifest.json` - PWA configuration
- `service-worker.js` - Offline caching
- `static/` - CSS and JavaScript
- `icons/` - Dreamland logos

## Troubleshooting

**PWA not installing on iPad?**
- Make sure you're using HTTPS (required for PWA)
- Use Safari browser (other browsers don't support iOS PWA)

**Audio files not playing?**
- Check file format (MP3 is most compatible)
- Ensure files aren't DRM-protected

**App not updating?**
- Clear Safari cache on iPad
- Delete and reinstall the PWA

## Production URL Structure

Your deployed app will work at any URL structure:
- `https://yourdomain.com/`
- `https://yourdomain.com/dreamlive/`
- `https://subdomain.yourdomain.com/`

The app is configured with relative paths for maximum compatibility.

## Support

For issues or questions:
- Check the console in Safari Developer Tools
- Verify all files uploaded correctly
- Ensure HTTPS is enabled on your server
