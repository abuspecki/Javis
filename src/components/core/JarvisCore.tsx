import { useEffect, useRef, type MutableRefObject } from 'react';
import type { CoreState } from '../../types';

interface Props {
  state: CoreState;
  level: MutableRefObject<number>;
  spectrum: MutableRefObject<Uint8Array | null>;
  reducedMotion?: boolean;
  onActivate?: () => void;
}

/** Per-state animation profile. Everything visual derives from these numbers. */
const PROFILE: Record<CoreState, { spin: number; pulse: number; bars: number; particles: number; hue: [number, number, number] }> = {
  idle:      { spin: 0.15, pulse: 0.6, bars: 0.12, particles: 0.25, hue: [0, 217, 255] },
  listening: { spin: 0.35, pulse: 3.2, bars: 0.9,  particles: 0.6,  hue: [0, 255, 240] },
  thinking:  { spin: 1.6,  pulse: 1.4, bars: 0.35, particles: 1.4,  hue: [0, 217, 255] },
  speaking:  { spin: 0.5,  pulse: 1.0, bars: 1.0,  particles: 0.5,  hue: [120, 240, 255] },
  error:     { spin: 0.25, pulse: 4.0, bars: 0.5,  particles: 0.3,  hue: [255, 51, 79] },
};

const RING_SPEED: Record<CoreState, number> = { idle: 1, listening: 0.6, thinking: 0.18, speaking: 0.7, error: 1.4 };

export function JarvisCore({ state, level, spectrum, reducedMotion, onActivate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now(), t = 0;
    // smoothed profile so state transitions blend instead of jumping
    const cur = { ...PROFILE.idle, hue: [...PROFILE.idle.hue] as [number, number, number] };
    const smoothLevel = { v: 0 };

    const particles = Array.from({ length: 90 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.52 + Math.random() * 0.42,
      s: (0.2 + Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1),
      z: Math.random(),
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width; h = rect.height;
      canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = PROFILE[stateRef.current];
      const k = 1 - Math.pow(0.02, dt);
      cur.spin += (p.spin - cur.spin) * k;
      cur.pulse += (p.pulse - cur.pulse) * k;
      cur.bars += (p.bars - cur.bars) * k;
      cur.particles += (p.particles - cur.particles) * k;
      for (let i = 0; i < 3; i++) cur.hue[i] += (p.hue[i] - cur.hue[i]) * k;
      t += dt * (reducedMotion ? 0.15 : 1);

      // decay externally kicked level (TTS boundaries)
      level.current *= Math.pow(0.08, dt);
      smoothLevel.v += (level.current - smoothLevel.v) * Math.min(1, dt * 12);
      const lv = smoothLevel.v;

      const [r, g, b] = cur.hue.map(Math.round);
      const col = (a: number) => `rgba(${r},${g},${b},${a})`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;

      // ── Core glow ──
      const breathe = 0.5 + 0.5 * Math.sin(t * cur.pulse * 1.6);
      const coreR = R * (0.17 + breathe * 0.015 + lv * 0.05);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.6);
      grad.addColorStop(0, 'rgba(234,251,255,0.95)');
      grad.addColorStop(0.18, col(0.85));
      grad.addColorStop(0.45, col(0.18 + lv * 0.2));
      grad.addColorStop(1, col(0));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, coreR * 2.6, 0, Math.PI * 2); ctx.fill();

      // inner hexagon
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(t * cur.spin * 0.6);
      ctx.strokeStyle = col(0.75); ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rr = coreR * 0.75;
        i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.stroke();
      ctx.restore();

      // ── Frequency ring ──
      const N = 96;
      const spec = spectrum.current;
      const baseR = R * 0.44;
      ctx.lineCap = 'round';
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        let v: number;
        if (spec && stateRef.current === 'listening') {
          const idx = Math.floor((i < N / 2 ? i : N - i) / (N / 2) * spec.length * 0.7);
          v = (spec[idx] ?? 0) / 255;
        } else {
          v = (Math.sin(i * 0.7 + t * 5) * 0.5 + 0.5) * (Math.sin(i * 0.23 - t * 3.1) * 0.5 + 0.5);
          v = v * (0.25 + lv * 1.2);
        }
        const len = R * (0.012 + v * 0.13 * cur.bars);
        ctx.strokeStyle = col(0.25 + v * 0.6);
        ctx.lineWidth = Math.max(1, R * 0.008);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * baseR, cy + Math.sin(a) * baseR);
        ctx.lineTo(cx + Math.cos(a) * (baseR + len), cy + Math.sin(a) * (baseR + len));
        ctx.stroke();
      }

      // ── Thinking: rotating data arcs ──
      const think = Math.max(0, cur.spin - 0.5) / 1.1;
      if (think > 0.02) {
        for (let j = 0; j < 3; j++) {
          const rr = R * (0.33 + j * 0.035);
          const start = t * (2.2 - j * 0.6) * (j % 2 ? -1 : 1);
          ctx.strokeStyle = col(0.7 * think);
          ctx.lineWidth = 2;
          for (let s = 0; s < 3; s++) {
            ctx.beginPath();
            ctx.arc(cx, cy, rr, start + s * 2.094, start + s * 2.094 + 0.6 + j * 0.2);
            ctx.stroke();
          }
        }
      }

      // ── Particles ──
      for (const pt of particles) {
        pt.a += pt.s * dt * cur.particles * 0.6;
        const rr = R * (pt.r + Math.sin(t * 0.8 + pt.z * 9) * 0.015);
        const x = cx + Math.cos(pt.a) * rr, y = cy + Math.sin(pt.a) * rr * 0.98;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + pt.z * 20));
        ctx.fillStyle = col(0.15 + tw * 0.55 * pt.z);
        ctx.beginPath(); ctx.arc(x, y, 0.6 + pt.z * 1.4, 0, Math.PI * 2); ctx.fill();
      }

      // ── Speaking waveform across core ──
      if (stateRef.current === 'speaking' || lv > 0.05) {
        ctx.strokeStyle = 'rgba(234,251,255,0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const span = coreR * 2.1;
        for (let x = -span; x <= span; x += 2) {
          const env = Math.cos((x / span) * Math.PI / 2) ** 2;
          const y = Math.sin(x * 0.09 + t * 14) * env * coreR * 0.55 * lv + Math.sin(x * 0.21 - t * 9) * env * coreR * 0.2 * lv;
          x === -span ? ctx.moveTo(cx + x, cy + y) : ctx.lineTo(cx + x, cy + y);
        }
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // pause rendering in background tabs
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else { last = performance.now(); raf = requestAnimationFrame(draw); } };
    document.addEventListener('visibilitychange', vis);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, [level, spectrum, reducedMotion]);

  const speed = RING_SPEED[state];
  const stroke = state === 'error' ? '#FF334F' : '#00D9FF';
  const accent = state === 'error' ? '#FF9D36' : '#00FFF0';

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={`J.A.R.V.I.S. Kern — Status: ${state}. Klicken zum Sprechen.`}
      className="group relative h-full w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-hud/50"
    >
      {/* SVG hologram rings (GPU-composited CSS rotation) */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full transition-[filter] duration-500" style={{ filter: `drop-shadow(0 0 6px ${stroke}66)` }} aria-hidden>
        <g className="ring-spin" style={{ ['--dur' as string]: `${90 * speed}s` }}>
          <circle cx="200" cy="200" r="196" fill="none" stroke={stroke} strokeOpacity=".18" strokeWidth="1" />
          {Array.from({ length: 72 }, (_, i) => (
            <line key={i} x1="200" y1="6" x2="200" y2={i % 6 === 0 ? 16 : 10} stroke={stroke} strokeOpacity={i % 6 === 0 ? 0.7 : 0.3} strokeWidth="1" transform={`rotate(${i * 5} 200 200)`} />
          ))}
        </g>
        <g className="ring-spin-rev" style={{ ['--dur' as string]: `${50 * speed}s` }}>
          <circle cx="200" cy="200" r="176" fill="none" stroke={accent} strokeOpacity=".55" strokeWidth="2" strokeDasharray="120 40 8 40" />
        </g>
        <g className="ring-spin" style={{ ['--dur' as string]: `${32 * speed}s` }}>
          <circle cx="200" cy="200" r="160" fill="none" stroke={stroke} strokeOpacity=".35" strokeWidth="1" strokeDasharray="2 6" />
          <path d="M200 40 A160 160 0 0 1 338 120" fill="none" stroke={stroke} strokeOpacity=".9" strokeWidth="3" strokeLinecap="round" />
          <path d="M200 360 A160 160 0 0 1 62 280" fill="none" stroke={stroke} strokeOpacity=".9" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g className="ring-spin-rev" style={{ ['--dur' as string]: `${70 * speed}s` }}>
          <circle cx="200" cy="200" r="132" fill="none" stroke={stroke} strokeOpacity=".22" strokeWidth="10" strokeDasharray="1 5" />
        </g>
        <g className="ring-spin" style={{ ['--dur' as string]: `${24 * speed}s` }}>
          <polygon points="200,92 293.5,146 293.5,254 200,308 106.5,254 106.5,146" fill="none" stroke={accent} strokeOpacity=".25" strokeWidth="1" />
          {[0, 120, 240].map((r) => <rect key={r} x="197" y="86" width="6" height="6" fill={accent} transform={`rotate(${r} 200 200)`} />)}
        </g>
      </svg>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
    </button>
  );
}
