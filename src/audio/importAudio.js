const SUPPORTED_AUDIO_EXTENSION = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;

export function isNativeAudioRuntime(runtime = typeof window !== 'undefined' ? window : undefined) {
  const capacitor = runtime?.Capacitor;
  const reportsNative = typeof capacitor?.isNativePlatform === 'function'
    ? capacitor.isNativePlatform()
    : Boolean(capacitor);
  return reportsNative || runtime?.location?.protocol === 'capacitor:';
}

export function inspectAudioFile(blobUrl, options = {}) {
  const {
    createAudio = () => document.createElement('audio'),
    timeoutMs = 10000,
    setTimer = (callback, delay) => window.setTimeout(callback, delay),
    clearTimer = timer => window.clearTimeout(timer),
  } = options;

  return new Promise((resolve, reject) => {
    const probe = createAudio();
    let settled = false;
    let timeoutId;

    const finish = (error, duration = 0) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) clearTimer(timeoutId);
      probe.onloadedmetadata = null;
      probe.onerror = null;
      probe.removeAttribute('src');
      if (error) reject(error);
      else resolve(duration);
    };

    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const duration = Number.isFinite(probe.duration) ? probe.duration : 0;
      if (duration <= 0) finish(new Error('Audio file has no playable duration.'));
      else finish(null, duration);
    };
    probe.onerror = () => finish(new Error('Audio format is not playable on this device.'));
    timeoutId = setTimer(() => finish(new Error('Audio metadata timed out.')), timeoutMs);
    probe.src = blobUrl;

    try {
      probe.load();
    } catch (error) {
      finish(new Error('Audio format is not playable on this device.'));
    }
  });
}

function rejection(file, reason) {
  return { file, reason };
}

export async function processAudioFiles(files, options = {}) {
  const nativeRuntime = isNativeAudioRuntime();
  const {
    concurrency = 3,
    inspect = inspectAudioFile,
    skipMetadataInspection = nativeRuntime,
    createObjectURL = file => URL.createObjectURL(file),
    revokeObjectURL = url => URL.revokeObjectURL(url),
    onProgress = () => {},
  } = options;
  const queue = Array.from(files || []);
  const accepted = [];
  const rejected = [];
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency) || 1, queue.length || 1));
  let nextIndex = 0;
  let completed = 0;

  const completeOne = () => {
    completed += 1;
    onProgress({ completed, total: queue.length });
  };

  const processOne = async (file, index) => {
    const supportedName = SUPPORTED_AUDIO_EXTENSION.test(file.name || '');
    const supportedType = String(file.type || '').startsWith('audio/');
    if (!(file.size > 0)) {
      rejected.push({ index, ...rejection(file, 'File is empty.') });
      completeOne();
      return;
    }
    if (!supportedType && !supportedName) {
      rejected.push({ index, ...rejection(file, 'File type is not supported.') });
      completeOne();
      return;
    }

    const blobUrl = createObjectURL(file);
    try {
      // Capacitor's iOS-on-Mac WebView can create the media player but never
      // resolve metadata for a detached probe. The real, mounted players load
      // metadata when a track is assigned, so native import must not block here.
      const duration = skipMetadataInspection ? 0 : await inspect(blobUrl);
      accepted.push({
        index,
        id: `file-${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        path: blobUrl,
        size: file.size,
        type: file.type,
        duration,
        fileData: file,
      });
    } catch (error) {
      revokeObjectURL(blobUrl);
      rejected.push({
        index,
        ...rejection(file, error instanceof Error ? error.message : 'File could not be opened.'),
      });
    } finally {
      completeOne();
    }
  };

  const worker = async () => {
    while (nextIndex < queue.length) {
      const index = nextIndex;
      nextIndex += 1;
      await processOne(queue[index], index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));

  return {
    accepted: accepted
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ index, ...file }) => file),
    rejected: rejected
      .sort((a, b) => a.index - b.index)
      .map(({ index, ...item }) => item),
  };
}
