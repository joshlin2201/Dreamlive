import React, { useEffect, useRef } from 'react';
import { aggregateSpectrumBins, createIdleSpectrum, decaySpectrum } from '../audio/spectrum';

const BAR_COUNT = 48;

function AudioVisualizer({ analyserRef, active = false, variant = 'compact', status = 'Paused' }) {
  const canvasRef = useRef(null);
  const barsRef = useRef(createIdleSpectrum(BAR_COUNT));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const idle = createIdleSpectrum(BAR_COUNT);
    let frameId = 0;
    let lastSample = 0;
    let stopped = false;
    let frequencyData = null;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width * density));
      const height = Math.max(1, Math.round(bounds.height * density));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const draw = (bars) => {
      resize();
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      const gap = Math.max(2, width * 0.004);
      const barWidth = Math.max(1, (width - (gap * (BAR_COUNT - 1))) / BAR_COUNT);
      const gradient = context.createLinearGradient(0, height, width, 0);
      if (variant === 'focus') {
        gradient.addColorStop(0, '#c91d69');
        gradient.addColorStop(0.64, '#e94a8d');
        gradient.addColorStop(1, '#e8ad4a');
      } else {
        gradient.addColorStop(0, '#b51d61');
        gradient.addColorStop(0.58, '#df3f87');
        gradient.addColorStop(1, '#a87bd8');
      }
      context.fillStyle = gradient;
      context.shadowColor = variant === 'focus' ? 'rgba(214, 40, 112, .22)' : 'rgba(177, 44, 119, .18)';
      context.shadowBlur = variant === 'focus' ? 12 : 7;
      bars.forEach((value, index) => {
        const eased = Math.pow(Math.max(0.035, value), 0.72);
        const barHeight = Math.max(2, eased * height * 0.92);
        const x = index * (barWidth + gap);
        const y = (height - barHeight) / 2;
        const radius = Math.min(barWidth / 2, 5);
        if (typeof context.roundRect === 'function') {
          context.beginPath();
          context.roundRect(x, y, barWidth, barHeight, radius);
          context.fill();
        } else {
          context.fillRect(x, y, barWidth, barHeight);
        }
      });
    };

    const tick = timestamp => {
      if (stopped) return;
      const interval = reducedMotion ? 180 : 34;
      let settled = false;
      if (timestamp - lastSample >= interval) {
        const analyser = analyserRef?.current;
        if (active && analyser) {
          if (!frequencyData || frequencyData.length !== analyser.frequencyBinCount) {
            frequencyData = new Uint8Array(analyser.frequencyBinCount);
          }
          analyser.getByteFrequencyData(frequencyData);
          barsRef.current = aggregateSpectrumBins(frequencyData, BAR_COUNT);
        } else {
          barsRef.current = decaySpectrum(barsRef.current, idle, reducedMotion ? 0.5 : 0.2);
          settled = barsRef.current.every((value, index) => Math.abs(value - idle[index]) < 0.003);
          if (settled) barsRef.current = idle;
        }
        draw(barsRef.current);
        lastSample = timestamp;
      }
      if (active || !settled) frameId = window.requestAnimationFrame(tick);
    };

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => draw(barsRef.current));
    observer?.observe(canvas);
    draw(barsRef.current);
    frameId = window.requestAnimationFrame(tick);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [active, analyserRef, variant]);

  return (
    <div className={`audio-visualizer ${variant}`} role="img" aria-label={status}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="visualizer-status">{status}</span>
    </div>
  );
}

export default AudioVisualizer;
