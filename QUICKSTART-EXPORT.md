# 🚀 Quick Export Guide - Dream Live Pro

Your iPad PWA app is ready to deploy! Here's the fastest way to get it running.

## ✅ What's Ready

- ✅ Production build complete (`build/` folder)
- ✅ PWA configured for iPad
- ✅ Service worker for offline use
- ✅ All files optimized and compressed
- ✅ Deployment package: `DreamLivePro-iPad-PWA.zip`

## 🎯 Fastest Deploy (2 minutes)

### Option 1: Netlify Drop (Easiest!)

1. Go to https://app.netlify.com/drop
2. Drag the `build` folder onto the page
3. Get your URL (e.g., `https://dreamlive-pro.netlify.app`)
4. Done!

### Option 2: Vercel CLI

```bash
# One-time install
npm install -g vercel

# Deploy
cd /Users/joshlin/Code/Dreamlive
vercel --prod
```

## 📱 Install on iPad

Once deployed:

1. Open Safari on iPad
2. Go to your deployment URL
3. Tap Share button → "Add to Home Screen"
4. Name it "Dream Live Pro"
5. Launch from home screen!

## 📦 Files Included

```
build/
├── index.html              # Main app
├── manifest.json           # PWA config
├── service-worker.js       # Offline caching
├── icons/                  # Dreamland logos
│   └── dreamland-logo.png
└── static/                 # CSS & JS
    ├── css/
    └── js/

DreamLivePro-iPad-PWA.zip   # Ready to upload anywhere
DEPLOYMENT.md               # Full deployment guide
```

## 🎵 Using the App

1. **Add Music Files**: Tap "Select Folder" to load audio files
2. **Background Music**: Plays during MC talk segments
3. **Live Performances**: Queue up 4 performances with individual controls
4. **Status Indicators**: See what's playing, paused, ready, or complete
5. **Offline Support**: Audio files cached locally on iPad

## ⚠️ Important Notes

- **HTTPS Required**: PWA only works on HTTPS (Netlify/Vercel provide this free)
- **Safari Only**: Use Safari to install PWA (not Chrome/Firefox on iOS)
- **Landscape Mode**: App optimized for iPad landscape orientation
- **Touch Optimized**: All buttons 44px+ for easy tapping

## 🔧 Making Changes

After editing:

```bash
# Rebuild
npm run build

# Redeploy (upload new build folder)
```

## 📞 Need Help?

- See full guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Test locally: `npx serve -s build -p 3000`
- Check console for errors in Safari Developer Tools

---

**Ready to perform! 🎤✨**
