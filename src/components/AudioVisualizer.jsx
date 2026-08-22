import React, { useEffect, useRef } from 'react';
import {
  aggregateSpectrumBins,
  createIdleSpectrum,
  decaySpectrum,
  smoothSpectrum,
} from '../audio/spectrum';

const BAR_COUNT = 72;

function AudioVisualizer({ analyserRef, active = false, variant = 'compact', status = 'Paused' }) {
  const canvasRef = useRef(null);
  const barsRef = useRef(createIdleSpectrum(BAR_COUNT));
  const targetRef = useRef(Array(BAR_COUNT).fill(0));
  const peaksRef = useRef(Array(BAR_COUNT).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const idleBars = createIdleSpectrum(BAR_COUNT);
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
      const barWidth = Math.max(1.5 * density, Math.min(4 * density, slot * 0.56));
      context.clearRect(0, 0, width, height);
      context.fillStyle = gradient;
      for (let index = 0; index < bars.length; index += 1) {
        const amplitude = Math.max(1.5 * density, bars[index] * height * 0.96);
        const x = ((index + 0.5) * slot) - (barWidth / 2);
        context.fillRect(x, Math.max(density, baseline - amplitude), barWidth, amplitude);
        if (active) {
          const peakY = Math.max(density, baseline - (peaksRef.current[index] * height * 0.96));
          context.globalAlpha = 0.58;
          context.fillRect(x, peakY, barWidth, Math.max(1, density * 0.7));
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
        const live = Boolean(active && analyser);
        if (live) {
          if (!frequencyData || frequencyData.length !== analyser.frequencyBinCount) {
            frequencyData = new Uint8Array(analyser.frequencyBinCount);
          }
          analyser.getByteFrequencyData(frequencyData);
          aggregateSpectrumBins(frequencyData, BAR_COUNT, targetRef.current, 0.72);
          for (let index = 0; index < targetRef.current.length; index += 1) {
            targetRef.current[index] = Math.min(1, Math.pow(targetRef.current[index], 0.38) * 1.3);
            peaksRef.current[index] = Math.max(
              targetRef.current[index],
              peaksRef.current[index] - (reducedMotion ? 0.08 : 0.025)
            );
          }
          smoothSpectrum(
            barsRef.current,
            targetRef.current,
            reducedMotion ? { attack: 0.5, release: 0.35 } : { attack: 0.92, release: 0.34 },
            barsRef.current
          );
        } else {
          decaySpectrum(barsRef.current, idleBars, reducedMotion ? 0.55 : 0.2, barsRef.current);
          decaySpectrum(peaksRef.current, idleBars, reducedMotion ? 0.55 : 0.2, peaksRef.current);
          settled = barsRef.current.every((value, index) => Math.abs(value - idleBars[index]) < 0.002);
        }
        draw(barsRef.current);
        lastSample = timestamp;
      }
      if ((active && analyserRef?.current) || !settled) scheduleFrame();
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
  }, [active, analyserRef, variant]);

  return (
    <div className={`audio-visualizer ${variant} ${active ? 'is-active' : ''}`} role="img" aria-label={status}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="visualizer-status">{status}</span>
    </div>
  );
}

export default AudioVisualizer;
