"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "~/stores/use-player-store";

export default function LeftVisualizer() {
  const track = usePlayerStore((s) => s.track);
  const sharedAnalyser = usePlayerStore((s) => s.externalAnalyser);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const cleanupRef = useRef<null | (() => void)>(null);
  const [fallbackMode, setFallbackMode] = useState(false);

  // Ensure AudioContext can resume on first user interaction
  useEffect(() => {
    const resume = async () => {
      try {
        if (!ctxRef.current) return;
        if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
      } catch {}
    };
    window.addEventListener("pointerdown", resume, { once: true });
    return () => window.removeEventListener("pointerdown", resume);
  }, []);

  // Init hidden audio element once (kept for Safari autoplay quirks; remains muted and unused)
  useEffect(() => {
    const audio = document.createElement("audio");
    audioRef.current = audio;
    audio.muted = true; // muted so autoplay is allowed
    audio.preload = "metadata";
    (audio as any).playsInline = true; // Safari/iOS
    audio.setAttribute("playsinline", "true");
    audio.crossOrigin = "anonymous";

    audio.style.display = "none";
    document.body.appendChild(audio);

    return () => {
      try {
        audio.pause();
      } catch {}
      audio.src = "";
      audio.remove();
      audioRef.current = null;
    };
  }, []);

  // Start drawing (real or fallback), managing a single RAF cycle
  const startDrawing = () => {
    // Stop any previous loop/listeners
    if (cleanupRef.current) cleanupRef.current();

    const canvas = canvasRef.current;
    if (!canvas) {
      cleanupRef.current = null;
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) {
      cleanupRef.current = null;
      return;
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    };
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const resolveAnalyser = () => {
      return sharedAnalyser || analyserRef.current || null;
    };

    const getFreqArray = () => {
      const analyser = resolveAnalyser();
      if (!analyser) return null;
      return new Uint8Array(analyser.frequencyBinCount);
    };

    let freq = getFreqArray();
    let t = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      // Background capsule
      const bgY = h * 0.15;
      const bgH = h * 0.7;
      const r = Math.max(6 * dpr, bgH / 2);
      ctx2d.fillStyle = "rgba(100,116,139,0.25)";
      ctx2d.beginPath();
      ctx2d.moveTo(r, bgY);
      ctx2d.lineTo(w - r, bgY);
      ctx2d.quadraticCurveTo(w, bgY, w, bgY + r);
      ctx2d.lineTo(w, bgY + bgH - r);
      ctx2d.quadraticCurveTo(w, bgY + bgH, w - r, bgY + bgH);
      ctx2d.lineTo(r, bgY + bgH);
      ctx2d.quadraticCurveTo(0, bgY + bgH, 0, bgY + bgH - r);
      ctx2d.lineTo(0, bgY + r);
      ctx2d.quadraticCurveTo(0, bgY, r, bgY);
      ctx2d.closePath();
      ctx2d.fill();

      // Clip to capsule
      ctx2d.save();
      ctx2d.beginPath();
      ctx2d.moveTo(r, bgY);
      ctx2d.lineTo(w - r, bgY);
      ctx2d.quadraticCurveTo(w, bgY, w, bgY + r);
      ctx2d.lineTo(w, bgY + bgH - r);
      ctx2d.quadraticCurveTo(w, bgY + bgH, w - r, bgY + bgH);
      ctx2d.lineTo(r, bgY + bgH);
      ctx2d.quadraticCurveTo(0, bgY + bgH, 0, bgY + bgH - r);
      ctx2d.lineTo(0, bgY + r);
      ctx2d.quadraticCurveTo(0, bgY, r, bgY);
      ctx2d.closePath();
      ctx2d.clip();

      const BAR_COUNT = Math.min(48, Math.max(24, Math.floor(w / (12 * dpr))));
      const gap = Math.max(1 * dpr, 0.5);
      const barW = w / BAR_COUNT - gap;
      const centerY = bgY + bgH / 2;
      const maxBarH = (bgH * 0.9) / 2;

      const grad = ctx2d.createLinearGradient(0, bgY, 0, bgY + bgH);
      grad.addColorStop(0, "#22d3ee");
      grad.addColorStop(0.5, "#6366f1");
      grad.addColorStop(1, "#ec4899");
      ctx2d.fillStyle = grad;

      const analyser = resolveAnalyser();

      if (analyser && !fallbackMode) {
        if (!freq || freq.length !== analyser.frequencyBinCount) {
          freq = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(freq);

        const minIndex = 1;
        const maxIndex = freq.length - 1;
        for (let i = 0; i < BAR_COUNT; i++) {
          const start = Math.floor(minIndex * Math.pow(maxIndex / minIndex, i / BAR_COUNT));
          const end = Math.floor(minIndex * Math.pow(maxIndex / minIndex, (i + 1) / BAR_COUNT));
          const s = Math.max(minIndex, Math.min(start, maxIndex - 1));
          const e = Math.max(s + 1, Math.min(end, maxIndex));
          let sum = 0;
          for (let j = s; j < e; j++) sum += freq[j] || 0;
          const avg = sum / (e - s);
          const level = Math.min(1, Math.max(0, avg / 255));
          const bh = level * maxBarH;
          const x = i * (barW + gap);
          ctx2d.fillRect(x, centerY - bh, barW, bh * 2);
        }
      } else {
        // Fallback animation
        t += 0.02;
        for (let i = 0; i < BAR_COUNT; i++) {
          const phase = (i / BAR_COUNT) * Math.PI * 2;
          const level = 0.2 + 0.8 * Math.abs(Math.sin(t + phase) * Math.sin(t * 0.5 + phase * 0.7));
          const bh = level * maxBarH * 0.7;
          const x = i * (barW + gap);
          ctx2d.fillRect(x, centerY - bh, barW, bh * 2);
        }
      }

      ctx2d.restore();
    };

    draw();

    // Store cleanup so re-inits can cancel previous listeners/RAF
    cleanupRef.current = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  };

  // React to analyser availability or track changes
  useEffect(() => {
    // If shared analyser exists (same-origin), use live frequency; else fallback only
    if (sharedAnalyser) {
      setFallbackMode(false);
      startDrawing();
    } else {
      setFallbackMode(true);
      startDrawing();
    }
    return () => {
      // Do not interfere with sound; just ensure our loop is cleaned on unmount
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [sharedAnalyser, track?.id, track?.url]);

  // Ensure something is visible on initial mount
  useEffect(() => {
    if (!cleanupRef.current) {
      setFallbackMode(true);
      startDrawing();
    }
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  return (
    <div className="px-2 pb-2">
      <div className="rounded-lg border bg-muted/60 p-2">
        <canvas ref={canvasRef} className="h-20 w-full" />
      </div>
    </div>
  );
}
