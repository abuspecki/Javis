import { useCallback, useEffect, useRef } from 'react';

/**
 * Shared, render-free audio level (0..1) for the core visualiser.
 * - Microphone: real RMS via AnalyserNode while listening.
 * - Speech synthesis exposes no audio stream, so word-boundary events "kick" the level.
 */
export function useAudioLevel() {
  const level = useRef(0);
  const spectrum = useRef<Uint8Array | null>(null);
  const stopMic = useRef<(() => void) | null>(null);

  const startMic = useCallback(async () => {
    if (stopMic.current || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 128;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let raf = 0;
      const loop = () => {
        an.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        level.current = Math.min(1, (sum / buf.length / 255) * 2.4);
        spectrum.current = buf;
        raf = requestAnimationFrame(loop);
      };
      loop();
      stopMic.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        spectrum.current = null;
        level.current = 0;
      };
    } catch { /* permission denied → visualiser falls back to synthetic pulse */ }
  }, []);

  const releaseMic = useCallback(() => { stopMic.current?.(); stopMic.current = null; }, []);
  const kick = useCallback((amount = 0.7) => { level.current = Math.min(1, level.current + amount); }, []);

  useEffect(() => releaseMic, [releaseMic]);
  return { level, spectrum, startMic, releaseMic, kick };
}
