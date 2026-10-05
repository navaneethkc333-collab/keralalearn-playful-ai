import { useEffect, useRef, useState } from "react";

export function useGameSound() {
  const [enabled, setEnabled] = useState(true);
  const context = useRef<AudioContext | null>(null);
  useEffect(() => () => { void context.current?.close(); context.current = null; }, []);
  function play(kind: "tap" | "correct" | "wrong" | "finish") {
    if (!enabled || typeof window === "undefined" || !window.AudioContext) return;
    try {
      const audio = context.current ?? new AudioContext();
      context.current = audio;
      void audio.resume().then(() => {
        if (audio.state === "closed") return;
        const notes = kind === "finish" ? [523, 659, 784, 1047] : kind === "correct" ? [523, 784] : kind === "wrong" ? [220, 175] : [440];
        notes.forEach((frequency, i) => {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          const start = audio.currentTime + i * 0.12;
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
          oscillator.connect(gain); gain.connect(audio.destination);
          oscillator.start(start); oscillator.stop(start + 0.2);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        });
      }).catch(() => undefined);
    } catch { /* Sound is optional when unavailable. */ }
  }
  return { enabled, setEnabled, play };
}