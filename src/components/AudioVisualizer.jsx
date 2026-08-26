import React, { useEffect, useRef } from 'react';
import {
  aggregateLogSpectrumBins,
  decaySpectrum,
  smoothSpectrum,
} from '../audio/spectrum';
import { bandsAtPosition, hasSpectrogram } from '../audio/spectrogram';

const BAR_COUNT = 72;

// `sourceRef` is the element being played. With playback routed straight
// through it there is no AnalyserNode, so the bars read the track's decoded
// peaks against the playhead instead of a live spectrum.
function AudioVisualizer({
  analyserRef,
  peaksRef,
  sourceRef,
  active = false,
  variant = 'compact',
  status = 'Paused',
}) {
  const canvasRef = useRef(null);
  const barsRef = useRef(Array(BAR_COUNT).fill(0));
  const targetRef = useRef(Array(BAR_COUNT).fill(0));
  const peaksRef2 = useRef(Array(BAR_COUNT).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const silentBars = Array(BAR_COUNT).fill(0);
    let frameId = 0;
    let lastSample = 0;
    let stopped = false;
    let pageVisible = document.visibilityState !== 'hidden';
    let frequencyData = null;
    let gradient = null;
    let density = 1;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      density = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width * density));
      const height = Math.max(1, Math.round(bounds.height * density));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gradient = null;
      }
      if (!gradient) {
        gradient = context.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#c71968');
        gradient.addColorStop(0.3, '#e02d87');
        gradient.addColorStop(0.56, '#a65fd4');
        gradient.addColorStop(0.78, '#ef6f78');
        gradient.addColorStop(1, '#e7ab3f');
      }
    };

    const draw = bars => {
      resize();
      const { width, height } = canvas;
      const slot = width / BAR_COUNT;
      const baseline = height - (1.5 * density);
      const barWidth = Math.max(1.5 * density, Math.min(6 * density, slot * 0.64));
      context.clearRect(0, 0, width, height);
      context.fillStyle = gradient;

      if (!active) {
        context.globalAlpha = 0.18;
        context.fillRect(0, baseline, width, Math.max(1, density * 0.55));
        context.globalAlpha = 1;
        return;
      }

      for (let index = 0; index < bars.length; index += 1) {
        if (bars[index] < 0.018) continue;
        const amplitude = Math.max(1.25 * density, bars[index] * height * 0.98);
        const x = ((index + 0.5) * slot) - (barWidth / 2);
        const y = Math.max(density, baseline - amplitude);
        if (typeof context.roundRect === 'function') {
          context.beginPath();
          context.roundRect(x, y, barWidth, amplitude, Math.min(barWidth / 2, 1.6 * density));
          context.fill();
        } else {
          context.fillRect(x, y, barWidth, amplitude);
        }
        if (active) {
          const peakY = Math.max(density, baseline - (peaksRef2.current[index] * height * 0.96));
          context.globalAlpha = 0.58;
          context.fillRect(x, peakY, barWidth, Math.max(1, density * 0.55));
          context.globalAlpha = 1;
        }
      }
    };

    const scheduleFrame = () => {
      if (!stopped && pageVisible && !frameId) frameId = window.requestAnimationFrame(tick);
    };

    const tick = timestamp => {
      frameId = 0;
      if (stopped) return;
      const interval = reducedMotion ? 120 : 17;
      let settled = false;
      if (timestamp - lastSample >= interval) {
        const analyser = analyserRef?.current;
        const spectrogram = peaksRef?.current;
        const media = sourceRef?.current;
        const offline = Boolean(active && !analyser && hasSpectrogram(spectrogram) && media);
        const live = Boolean(active && analyser);
        if (offline) {
          const bars = bandsAtPosition(spectrogram, {
            position: media.currentTime,
            duration: media.duration,
            barCount: BAR_COUNT,
          });
          for (let index = 0; index < bars.length; index += 1) {
            targetRef.current[index] = bars[index];
            peaksRef2.current[index] = Math.max(
              bars[index],
              peaksRef2.current[index] - (reducedMotion ? 0.08 : 0.025)
            );
          }
          smoothSpectrum(
            barsRef.current,
            targetRef.current,
            reducedMotion ? { attack: 0.5, release: 0.35 } : { attack: 0.72, release: 0.3 },
            barsRef.current
          );
        } else if (live) {
          if (!frequencyData || frequencyData.length !== analyser.frequencyBinCount) {
            frequencyData = new Uint8Array(analyser.frequencyBinCount);
          }
          analyser.getByteFrequencyData(frequencyData);
          aggregateLogSpectrumBins(frequencyData, BAR_COUNT, targetRef.current, 0.72);
          const framePeak = Math.max(...targetRef.current);
          const adaptiveGain = framePeak > 0.02
            ? Math.min(3.2, Math.max(1, 0.82 / framePeak))
            : 1;
          for (let index = 0; index < targetRef.current.length; index += 1) {
            const gatedLevel = Math.max(0, (targetRef.current[index] - 0.025) * adaptiveGain);
            const spectralLift = 1.22 + ((index / (targetRef.current.length - 1)) * 0.34);
            targetRef.current[index] = Math.min(1, Math.pow(gatedLevel, 0.68) * spectralLift);
            peaksRef2.current[index] = Math.max(
              targetRef.current[index],
              peaksRef2.current[index] - (reducedMotion ? 0.08 : 0.025)
            );
          }
          smoothSpectrum(
            barsRef.current,
            targetRef.current,
            reducedMotion ? { attack: 0.5, release: 0.35 } : { attack: 0.92, release: 0.34 },
            barsRef.current
          );
        } else {
          decaySpectrum(barsRef.current, silentBars, reducedMotion ? 0.55 : 0.2, barsRef.current);
          decaySpectrum(peaksRef2.current, silentBars, reducedMotion ? 0.55 : 0.2, peaksRef2.current);
          settled = barsRef.current.every(value => value < 0.002);
        }
        draw(barsRef.current);
        lastSample = timestamp;
      }
      if (active || !settled) scheduleFrame();
    };

    const handleVisibilityChange = () => {
      pageVisible = document.visibilityState !== 'hidden';
      if (!pageVisible && frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      } else if (pageVisible) {
        scheduleFrame();
      }
    };

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => draw(barsRef.current));
    observer?.observe(canvas);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    draw(barsRef.current);
    scheduleFrame();

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [active, analyserRef, peaksRef, sourceRef, variant]);

  return (
    <div className={`audio-visualizer ${variant} ${active ? 'is-active' : ''}`} role="img" aria-label={status}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="visualizer-status">{status}</span>
    </div>
  );
}

export default AudioVisualizer;
