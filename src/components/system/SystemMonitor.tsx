import { Activity, Cpu, Gauge, MemoryStick, Network, Server, Wifi, WifiOff } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { useSystemMetrics } from '../../hooks/useSystemMetrics';
import type { CoreState } from '../../types';
import { cx } from '../../lib/util';
import { Panel, SourceChip } from '../ui/Panel';

function Ring({ value, label, icon: Icon, warnAt = 75, critAt = 90 }: { value: number; label: string; icon: typeof Cpu; warnAt?: number; critAt?: number }) {
  const r = 30, c = 2 * Math.PI * r;
  const color = value >= critAt ? '#FF334F' : value >= warnAt ? '#FF9D36' : '#00D9FF';
  return (
    <div className="flex flex-col items-center gap-1" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="relative h-[76px] w-[76px]">
        <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
          <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(0,217,255,.1)" strokeWidth="5" />
          <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset .8s ease, stroke .3s', filter: `drop-shadow(0 0 4px ${color})` }} />
          <circle cx="38" cy="38" r="22" fill="none" stroke="rgba(0,217,255,.15)" strokeDasharray="1 3" />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <Icon className="mx-auto h-3 w-3 text-cyan-hud/60" />
            <div className="font-mono text-sm text-ice">{Math.round(value)}<span className="text-[9px] text-ice/50">%</span></div>
          </div>
        </div>
      </div>
      <span className="hud-label">{label}</span>
    </div>
  );
}

const PROCESSES = [
  { name: 'jarvis.core', base: 6 }, { name: 'speech.engine', base: 3 }, { name: 'render.hud', base: 9 },
  { name: 'net.daemon', base: 2 }, { name: 'sentinel.sec', base: 1 },
];

/** AI load is derived from the real assistant state, smoothed over time. */
function useAiLoad(state: CoreState) {
  const [load, setLoad] = useState(4);
  const target = useRef(4);
  target.current = { idle: 4, listening: 22, thinking: 88, speaking: 41, error: 12 }[state];
  useEffect(() => {
    const id = setInterval(() => setLoad((l) => l + (target.current + (Math.random() - 0.5) * 6 - l) * 0.35), 400);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.min(100, load));
}

export const SystemMonitor = memo(function SystemMonitor({ aiState, className }: { aiState: CoreState; className?: string }) {
  const { snap, series } = useSystemMetrics();
  const ai = useAiLoad(aiState);
  const s = snap?.sample;
  const status = !snap ? 'INITIALISIERUNG' : !snap.online ? 'OFFLINE' : (s!.cpu > 90 ? 'HOHE LAST' : 'NOMINAL');
  const statusColor = !snap ? 'text-cyan-hud' : !snap.online ? 'text-crit' : s!.cpu > 90 ? 'text-warn' : 'text-teal-hud';

  return (
    <Panel title="Systemmonitor" icon={Activity} className={className} bodyClassName="overflow-y-auto"
      badge={<span className={cx('font-mono text-[10px] tracking-widest', statusColor)}>● {status}</span>}>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-1">
          <Ring value={s?.cpu ?? 0} label="CPU" icon={Cpu} />
          <Ring value={s?.ram ?? 0} label="RAM" icon={MemoryStick} />
          <Ring value={ai} label="KI-Last" icon={Gauge} warnAt={95} critAt={101} />
        </div>
        {snap && (
          <div className="flex flex-wrap justify-center gap-1.5 text-[10px] text-ice/40">
            <span className="flex items-center gap-1">CPU <SourceChip source={snap.sources.cpu} /></span>
            <span className="flex items-center gap-1">RAM <SourceChip source={snap.sources.ram} /></span>
            <span className="flex items-center gap-1">NET <SourceChip source={snap.sources.net} /></span>
            <span className="flex items-center gap-1">KI <SourceChip source="live" /></span>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between"><span className="hud-label">CPU / RAM · Verlauf</span><span className="font-mono text-[10px] text-ice/40">60 s</span></div>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00D9FF" stopOpacity={0.45} /><stop offset="100%" stopColor="#00D9FF" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gRam" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00FFF0" stopOpacity={0.25} /><stop offset="100%" stopColor="#00FFF0" stopOpacity={0} /></linearGradient>
                </defs>
                <YAxis domain={[0, 100]} hide />
                <Area type="monotone" dataKey="ram" stroke="#00FFF0" strokeOpacity={0.6} strokeWidth={1} fill="url(#gRam)" isAnimationActive={false} />
                <Area type="monotone" dataKey="cpu" stroke="#00D9FF" strokeWidth={1.5} fill="url(#gCpu)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="hud-label flex items-center gap-1"><Network className="h-3 w-3" /> Netzwerk</span>
            <span className="font-mono text-[10px] text-ice/60">↓ {s?.netDown.toFixed(1) ?? '–'} · ↑ {s?.netUp.toFixed(1) ?? '–'} Mbit/s</span>
          </div>
          <div className="h-14">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <YAxis hide domain={[0, 'auto']} />
                <Line type="monotone" dataKey="netDown" stroke="#00D9FF" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line type="monotone" dataKey="netUp" stroke="#FF9D36" strokeOpacity={0.7} dot={false} strokeWidth={1} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-cyan-hud/10 bg-void/40 p-3 font-mono text-[11px]">
          <dt className="flex items-center gap-1.5 text-ice/45">{snap?.online === false ? <WifiOff className="h-3 w-3 text-crit" /> : <Wifi className="h-3 w-3 text-teal-hud" />} Internet</dt>
          <dd className={cx('text-right', snap?.online === false ? 'text-crit' : 'text-teal-hud')}>{snap ? (snap.online ? 'VERBUNDEN' : 'GETRENNT') : '…'}</dd>
          <dt className="text-ice/45">Verbindung</dt><dd className="text-right text-ice/80">{snap?.connectionType ?? '…'}</dd>
          <dt className="text-ice/45">Latenz</dt><dd className="text-right text-ice/80">{snap?.rttMs != null ? `${snap.rttMs} ms` : 'N/A'}</dd>
          <dt className="text-ice/45">Kerne</dt><dd className="text-right text-ice/80">{snap?.cores || 'N/A'}</dd>
          <dt className="text-ice/45">JS-Heap</dt><dd className="text-right text-ice/80">{snap?.heapMB != null ? `${snap.heapMB.toFixed(0)} MB` : 'N/A'}</dd>
          <dt className="text-ice/45">Frame-Lag</dt><dd className={cx('text-right', (snap?.frameLagMs ?? 0) > 30 ? 'text-warn' : 'text-ice/80')}>{snap ? `${snap.frameLagMs.toFixed(1)} ms` : '…'}</dd>
        </dl>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="hud-label flex items-center gap-1"><Server className="h-3 w-3" /> Aktive Prozesse</span>
            {snap?.realTabs != null ? <span className="font-mono text-[10px] text-teal-hud">{snap.realTabs} Chrome-Tabs</span> : <SourceChip source="demo" />}
          </div>
          <ul className="space-y-1">
            {PROCESSES.map((p, i) => {
              const v = p.name === 'jarvis.core' ? ai * 0.4 : p.base + Math.abs(Math.sin((series.length + i * 3) * 0.6)) * p.base;
              return (
                <li key={p.name} className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="w-24 truncate text-ice/60">{p.name}</span>
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-cyan-hud/10">
                    <span className="block h-full rounded-full bg-cyan-hud/70 transition-all duration-700" style={{ width: `${Math.min(100, v * 2)}%` }} />
                  </span>
                  <span className="w-8 text-right text-ice/50">{v.toFixed(1)}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Panel>
  );
});
