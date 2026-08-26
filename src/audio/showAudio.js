// One playback API for the show, with two implementations behind it.
//
// On device it drives the native ShowAudio plugin: AVAudioPlayer per channel,
// hardware fades, playback that survives the lock screen, and a lock screen
// transport. In a browser it drives the <audio> elements and Web Audio gain
// nodes the app already had, so development and the design work still run.
//
// A show only ever needs two channels: the room and the stage. Bounding it at
// two keeps an older iPad holding two decoders instead of one per lineup slot.
export const ROOM = 'room';
export const STAGE = 'stage';

export function nativePlugin() {
  const plugin = typeof window !== 'undefined' && window.Capacitor?.Plugins?.ShowAudio;
  const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
  return isNative && plugin ? plugin : null;
}

export function isNativeAudio() {
  return Boolean(nativePlugin());
}

// Native playback needs a file on disk; the library keeps blobs in IndexedDB.
// Each track is written out once and the path is remembered, so the cost is
// paid at assignment time rather than in the middle of a transition.
export function createFileCache({ plugin, loadBlob }) {
  const paths = new Map();
  const inFlight = new Map();

  const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read the track.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });

  return {
    has: (id) => paths.has(id),
    get: (id) => paths.get(id) || null,
    async ensure(id, source) {
      if (!id) return null;
      if (paths.has(id)) return paths.get(id);
      if (inFlight.has(id)) return inFlight.get(id);
      const work = (async () => {
        try {
          const blob = await loadBlob(source ?? id);
          if (!blob) return null;
          const data = await toBase64(blob);
          const { path } = await plugin.write({ id, data });
          paths.set(id, path);
          return path;
        } catch (error) {
          console.warn('Could not stage a track for native playback:', error);
          return null;
        } finally {
          inFlight.delete(id);
        }
      })();
      inFlight.set(id, work);
      return work;
    },
    forget(id) {
      paths.delete(id);
    },
  };
}

// The channel each side of a transition talks to. Every method is safe to call
// on a channel that has nothing loaded, so callers do not need to guard.
export function createNativeChannels(plugin) {
  const loaded = new Map();

  return {
    kind: 'native',
    async load(channel, path, volume = 1) {
      if (!path) return null;
      const result = await plugin.load({ id: channel, path, volume });
      loaded.set(channel, { path, duration: Number(result?.duration) || 0 });
      return loaded.get(channel);
    },
    loadedPath: (channel) => loaded.get(channel)?.path || null,
    duration: (channel) => loaded.get(channel)?.duration || 0,
    async play(channel, { from, volume } = {}) {
      const options = { id: channel };
      if (Number.isFinite(from)) options.from = from;
      if (Number.isFinite(volume)) options.volume = volume;
      const result = await plugin.play(options);
      return Boolean(result?.playing);
    },
    async pause(channel, { fadeSeconds = 0 } = {}) {
      await plugin.pause({ id: channel, fadeSeconds });
    },
    async stop(channel) {
      await plugin.stop({ id: channel });
    },
    async setVolume(channel, volume, { fadeSeconds = 0 } = {}) {
      await plugin.setVolume({ id: channel, volume, fadeSeconds });
    },
    async seek(channel, seconds) {
      await plugin.seek({ id: channel, seconds });
    },
    async state(channel) {
      const result = await plugin.state({ id: channel });
      return {
        loaded: Boolean(result?.loaded),
        playing: Boolean(result?.playing),
        currentTime: Number(result?.currentTime) || 0,
        duration: Number(result?.duration) || 0,
        volume: Number.isFinite(result?.volume) ? Number(result.volume) : 1,
      };
    },
    async nowPlaying({ title, artist, duration, elapsed, playing }) {
      await plugin.setNowPlaying({
        title: title || 'DreamLIVE',
        artist: artist || 'Dreamland',
        duration: duration || 0,
        elapsed: elapsed || 0,
        playing: Boolean(playing),
      });
    },
    onEnded(handler) {
      return plugin.addListener('ended', (event) => handler(event?.id));
    },
    onRemoteCommand(handler) {
      return plugin.addListener('remoteCommand', (event) => handler(event?.command));
    },
  };
}

// Browser fallback. The element is the source of truth and a gain node does the
// fading, which is the arrangement the app used before the native engine.
export function createWebChannels({ elementFor, gainFor, contextRef, fadeGain, muteGain }) {
  return {
    kind: 'web',
    async load() { return null; },
    loadedPath: () => null,
    duration: (channel) => elementFor(channel)?.duration || 0,
    async play(channel, { from, volume } = {}) {
      const audio = elementFor(channel);
      if (!audio) return false;
      if (Number.isFinite(from)) audio.currentTime = from;
      const gain = gainFor(channel);
      if (gain && Number.isFinite(volume)) gain.gain.value = Math.max(volume, 0.0001);
      try {
        await audio.play();
        return true;
      } catch (error) {
        return false;
      }
    },
    async pause(channel, { fadeSeconds = 0 } = {}) {
      const audio = elementFor(channel);
      if (!audio) return;
      const gain = gainFor(channel);
      if (gain && fadeSeconds > 0) {
        fadeGain(gain, 0, fadeSeconds);
        await new Promise(resolve => window.setTimeout(resolve, (fadeSeconds * 1000) + 20));
      }
      audio.pause();
      if (gain) muteGain(gain);
    },
    async stop(channel) {
      const audio = elementFor(channel);
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    },
    async setVolume(channel, volume, { fadeSeconds = 0 } = {}) {
      const gain = gainFor(channel);
      if (!gain) return;
      if (fadeSeconds > 0) fadeGain(gain, volume, fadeSeconds);
      else if (contextRef?.current) gain.gain.value = Math.max(volume, 0.0001);
    },
    async seek(channel, seconds) {
      const audio = elementFor(channel);
      if (audio) audio.currentTime = seconds;
    },
    async state(channel) {
      const audio = elementFor(channel);
      if (!audio) return { loaded: false, playing: false, currentTime: 0, duration: 0, volume: 1 };
      return {
        loaded: Boolean(audio.src),
        playing: !audio.paused,
        currentTime: audio.currentTime || 0,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        volume: gainFor(channel)?.gain.value ?? 1,
      };
    },
    async nowPlaying() { /* the browser has no lock screen to inform */ },
    onEnded() { return Promise.resolve({ remove() {} }); },
    onRemoteCommand() { return Promise.resolve({ remove() {} }); },
  };
}
