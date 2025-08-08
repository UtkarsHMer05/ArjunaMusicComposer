"use client";

import {
  Download,
  MoreHorizontal,
  Music,
  Pause,
  Play,
  Volume2,
} from "lucide-react";
import { usePlayerStore } from "~/stores/use-player-store";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { useEffect, useRef, useState } from "react";
import { Slider } from "./ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default function SoundBar() {
  const { track } = usePlayerStore();
  const setExternalAnalyser = usePlayerStore((s) => s.setExternalAnalyser);
  const autoplayRequestId = usePlayerStore((s) => s.autoplayRequestId);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([100]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playError, setPlayError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Waveform visualization refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const usingWebAudioOutputRef = useRef(false);
  const visualizationDisabledRef = useRef(false);
  const barStateRef = useRef<number[] | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);

    const updateDuration = () => {
      if (!isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleError = () => {
      const mediaError = (audio as any).error;
      const code = mediaError?.code;
      const msg =
        code === 1
          ? "ABORTED"
          : code === 2
            ? "NETWORK"
            : code === 3
              ? "DECODE"
              : code === 4
                ? "SRC_NOT_SUPPORTED"
                : "UNKNOWN";
      console.error("[Audio] error", { code, msg });
      setPlayError(`Audio error: ${msg}`);
    };

    const handleTrackEnd = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleTrackEnd);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleTrackEnd);
      audio.removeEventListener("error", handleError);
    };
  }, [track]);

  useEffect(() => {
    if (audioRef.current && track?.url) {
      console.log("SoundBar: Setting audio source to:", track.url);
      setCurrentTime(0);
      setDuration(0);

      // Do not force crossOrigin; this can block playback when CORS isn't set
      audioRef.current.src = track.url;
      audioRef.current.load();
      setIsPlaying(false);
    } else {
      console.log("SoundBar: No track or no URL", { track: track?.title, url: track?.url });
    }
  }, [track]);

  // Attempt autoplay when track changes due to a user click
  useEffect(() => {
    const tryAutoplay = async () => {
      if (!audioRef.current || !track?.url) return;
      setPlayError(null);
      try {
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }
      } catch { }
      try {
        // Wait a tick to ensure metadata begins loading
        await new Promise((r) => setTimeout(r, 0));
        await audioRef.current!.play();
        setIsPlaying(true);
      } catch (err) {
        // Ignore if blocked; user can press the play button
        console.warn("Autoplay blocked", err);
      }
    };
    tryAutoplay();
    // re-run when autoplayRequestId increments (user intent), and when track changes
  }, [track?.id, autoplayRequestId]);

  useEffect(() => {
    if (audioRef.current) {
      // Control gain when using WebAudio, else element volume
      if (usingWebAudioOutputRef.current && gainRef.current) {
        gainRef.current.gain.value = (volume[0] ?? 100) / 100;
        console.log("Setting WebAudio volume to:", (volume[0] ?? 100) / 100);
      } else {
        audioRef.current.volume = (volume[0] ?? 100) / 100;
        audioRef.current.muted = false; // ensure not muted when using element
        console.log("Setting HTML audio volume to:", (volume[0] ?? 100) / 100);
      }
    }
  }, [volume]);

  // Initialize / update analyser for waveform
  useEffect(() => {
    const audioEl = audioRef.current;
    const canvas = canvasRef.current;
    if (!audioEl || !canvas) return;

    // Do not set crossOrigin here; if CORS is present, WebAudio will work; if not, we disable visualization only

    // Reset disable flag on new track
    visualizationDisabledRef.current = false;

    // WebAudio path for analyser + output (stable across browsers)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const audioCtx = audioCtxRef.current;

    if (!sourceRef.current) {
      try {
        sourceRef.current = audioCtx.createMediaElementSource(audioEl);
      } catch (e) {
        console.error("Audio graph init error (source)", e);
        visualizationDisabledRef.current = true;
        usingWebAudioOutputRef.current = false;
        audioEl.muted = false; // ensure sound through element
        return;
      }
    }

    // Disconnect previous analyser/gain
    try {
      if (analyserRef.current) {
        try { sourceRef.current.disconnect(analyserRef.current); } catch { }
        try { analyserRef.current.disconnect(); } catch { }
      }
      if (gainRef.current) {
        try { gainRef.current.disconnect(); } catch { }
      }
    } catch { }

    analyserRef.current = audioCtx.createAnalyser();
    analyserRef.current.fftSize = 2048;
    analyserRef.current.smoothingTimeConstant = 0.85;

    try {
      gainRef.current = audioCtx.createGain();
      gainRef.current.gain.value = (volume[0] ?? 100) / 100;

      // source -> analyser -> gain -> destination
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(gainRef.current);
      gainRef.current.connect(audioCtx.destination);

      setExternalAnalyser(analyserRef.current);
      usingWebAudioOutputRef.current = true;

      // Only mute element if WebAudio is working
      audioEl.muted = true;
      console.log("WebAudio setup successful - using WebAudio for output");
    } catch (e) {
      console.error("Audio graph wiring error", e);
      visualizationDisabledRef.current = true;
      usingWebAudioOutputRef.current = false;
      audioEl.muted = false; // fallback to element playback
      audioEl.volume = (volume[0] ?? 100) / 100; // ensure volume is set
      console.log("WebAudio failed - using HTML audio element for output");
    }

    const dpr = window.devicePixelRatio || 1;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    };
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const draw = () => {
      if (!ctx) return;
      rafRef.current = requestAnimationFrame(draw);

      const w = canvas.width;
      const h = canvas.height;
      const mid = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "rgba(148, 163, 184, 0.15)";
      const bgY = h * 0.325;
      const bgH = h * 0.35;
      const r = Math.max(4 * dpr, bgH / 2);
      ctx.beginPath();
      ctx.moveTo(r, bgY);
      ctx.lineTo(w - r, bgY);
      ctx.quadraticCurveTo(w, bgY, w, bgY + r);
      ctx.lineTo(w, bgY + bgH - r);
      ctx.quadraticCurveTo(w, bgY + bgH, w - r, bgY + bgH);
      ctx.lineTo(r, bgY + bgH);
      ctx.quadraticCurveTo(0, bgY + bgH, 0, bgY + bgH - r);
      ctx.lineTo(0, bgY + r);
      ctx.quadraticCurveTo(0, bgY, r, bgY);
      ctx.closePath();
      ctx.fill();

      try {
        analyserRef.current!.getByteTimeDomainData(freqData);
        ctx.lineWidth = Math.max(2 * dpr, 1.5);
        ctx.strokeStyle = "#6366f1";
        ctx.beginPath();
        const sliceWidth = (w * 1.0) / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = (freqData[i] || 128) / 128.0;
          const y = v * mid;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      } catch { }

      if (duration > 0) {
        const progress = Math.min(1, Math.max(0, (audioEl.currentTime || 0) / duration));
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, "#fb923c");
        grad.addColorStop(1, "#ec4899");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, progress * w, h);
      }
    };

    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      try {
        if (analyserRef.current) analyserRef.current.disconnect();
      } catch { }
      try {
        if (gainRef.current) gainRef.current.disconnect();
      } catch { }
      usingWebAudioOutputRef.current = false;
      try { audioEl.muted = false; } catch { }
      setExternalAnalyser(null);
    };
    // Only re-init the audio graph when the track changes, not when duration updates
  }, [track?.id]);

  // Watchdog: keep AudioContext alive while playing
  useEffect(() => {
    if (!audioCtxRef.current) return;
    if (!isPlaying) return;
    let mounted = true;
    const tick = async () => {
      try {
        if (!mounted) return;
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }
      } catch { }
    };
    const id = setInterval(tick, 2000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [isPlaying]);

  // Click-to-seek on waveform
  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const newTime = Math.max(0, Math.min(duration * ratio, duration));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const ensureCanPlay = (audio: HTMLAudioElement) =>
    new Promise<void>((resolve) => {
      if (audio.readyState >= 3) return resolve();
      const onCanPlay = () => resolve();
      audio.addEventListener("canplay", onCanPlay, { once: true });
      // Fallback timeout in case canplay is delayed
      setTimeout(() => {
        audio.removeEventListener("canplay", onCanPlay as any);
        resolve();
      }, 1500);
    });

  const togglePlay = async () => {
    if (!track?.url || !audioRef.current) return;

    setPlayError(null);

    try {
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }
    } catch { }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await ensureCanPlay(audioRef.current);
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err: any) {
        console.error("Audio play failed (primary)", err);
        try {
          visualizationDisabledRef.current = true;
          try {
            analyserRef.current?.disconnect();
          } catch { }
          try {
            sourceRef.current?.disconnect();
            sourceRef.current = null;
          } catch { }
          await ensureCanPlay(audioRef.current);
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (err2: any) {
          console.error("Audio play failed (fallback)", err2);
          setPlayError("Playback failed. Open the track in a new tab to verify it plays.");
        }
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  if (!track) return null;

  return (
    <div className="px-4 pb-2">
      <Card className="bg-background/60 relative w-full shrink-0 border-t py-0 backdrop-blur">
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-pink-500">
                {track?.artwork ? (
                  <img
                    className="h-full w-full rounded-md object-cover"
                    src={track.artwork}
                  />
                ) : (
                  <Music className="h-4 w-4 text-white" />
                )}
              </div>
              <div className="max-w-24 min-w-0 flex-1 md:max-w-full">
                <p className="truncate text-sm font-medium">{track?.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {track?.createdByUserName}
                </p>
              </div>
            </div>

            {/* Centered controls */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <Button variant="ghost" size="icon" onClick={togglePlay}>
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Additional controls */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  step={1}
                  max={100}
                  min={0}
                  className="w-16"
                />
              </div>
              {/* Debug button - remove after fixing */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (audioRef.current) {
                    console.log("Debug Audio State:", {
                      muted: audioRef.current.muted,
                      volume: audioRef.current.volume,
                      usingWebAudio: usingWebAudioOutputRef.current,
                      gainValue: gainRef.current?.gain.value,
                      audioCtxState: audioCtxRef.current?.state,
                      src: audioRef.current.src,
                      currentTime: audioRef.current.currentTime,
                      duration: audioRef.current.duration,
                      readyState: audioRef.current.readyState
                    });
                    // Force unmute and set volume
                    audioRef.current.muted = false;
                    audioRef.current.volume = 1.0;
                  }
                }}
                className="text-xs"
              >
                Debug
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={() => {
                      if (!track?.url) return;

                      window.open(track?.url, "_blank");
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Waveform visualisation with time labels */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-8 text-right text-[10px]">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1">
              <canvas
                ref={canvasRef}
                onClick={onCanvasClick}
                className="h-10 w-full cursor-pointer select-none rounded-md"
              />
            </div>
            <span className="text-muted-foreground w-8 text-right text-[10px]">
              {formatTime(duration)}
            </span>
          </div>

          {playError && (
            <div className="text-[11px] text-amber-600">
              {playError}
            </div>
          )}
        </div>

        {track?.url && (
          <audio ref={audioRef} preload="metadata" playsInline>
            {/* Help browsers sniff supported type */}
            <source src={track.url || undefined} type="audio/mpeg" />
            <source src={track.url || undefined} type="audio/wav" />
          </audio>
        )}
      </Card>
    </div>
  );
}
