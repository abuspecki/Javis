import { Activity, Focus, Globe, LayoutDashboard, PanelLeft, Settings, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CoreState, ViewMode } from '../../types';
import { useClock } from '../../hooks/useClock';
import { cx, fmtTime } from '../../lib/util';
import { host } from '../../services/browser/host';

const VIEWS: { id: ViewMode; label: string; icon: typeof Focus }[] = [
  { id: 'command', label: 'Kommando', icon: LayoutDashboard },
  { id: 'browser', label: 'Browser', icon: Globe },
  { id: 'focus', label: 'Fokus', icon: Focus },
];

interface Props {
  view: ViewMode;
  onView: (v: ViewMode) => void;
  onSettings: () => void;
  onToggleInfo: () => void;
  onToggleMonitor: () => void;
  coreState: CoreState;
  providerLabel: string;
  /** side panels are only inline in command view on large screens */
  sidePanelsInline: boolean;
}

export function TopBar({ view, onView, onSettings, onToggleInfo, onToggleMonitor, coreState, providerLabel, sidePanelsInline }: Props) {
  const now = useClock(1000);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <header className="relative z-20 flex h-12 shrink-0 items-center gap-3 border-b border-cyan-hud/10 bg-void/70 px-3 backdrop-blur-md sm:px-4">
      <button onClick={onToggleInfo} className={cx('hud-icon-btn', sidePanelsInline && 'hidden')} aria-label="Informationsmodule anzeigen"><PanelLeft className="h-4 w-4" /></button>
      <div className="flex items-center gap-2.5">
        <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
          <circle cx="16" cy="16" r="14" fill="none" stroke="#00D9FF" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="9" fill="none" stroke="#00FFF0" strokeWidth="1" strokeDasharray="3 2" className="ring-spin" style={{ ['--dur' as string]: '8s' }} />
          <circle cx="16" cy="16" r="3.5" fill="#EAFBFF" />
        </svg>
        <div className="leading-none">
          <div className="glitch font-display text-[15px] font-bold tracking-[0.32em] text-ice" data-text="J.A.R.V.I.S.">J.A.R.V.I.S.</div>
          <div className="hidden font-mono text-[9px] tracking-[0.2em] text-cyan-hud/50 sm:block">STARK INDUSTRIES · MK-IV</div>
        </div>
      </div>

      <nav className="mx-auto flex rounded-lg border border-cyan-hud/15 bg-panel/60 p-0.5" aria-label="Ansichtsmodus">
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => onView(v.id)} aria-pressed={view === v.id}
            className={cx('flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-hud/50',
              view === v.id ? 'bg-cyan-hud/15 text-cyan-hud shadow-glow-sm' : 'text-ice/50 hover:text-ice')}>
            <v.icon className="h-3.5 w-3.5" /><span className="hidden md:inline">{v.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-3 font-mono text-[10px] tracking-wider text-ice/50 xl:flex">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-teal-hud" /> {host.kind === 'extension' ? 'EXTENSION' : 'WEB'}</span>
          <span className="max-w-[160px] truncate">KI: {providerLabel.toUpperCase()}</span>
          <span className={cx('flex items-center gap-1', coreState === 'error' ? 'text-crit' : 'text-cyan-hud/80')}>● {coreState.toUpperCase()}</span>
        </div>
        <span className={cx('flex items-center gap-1 font-mono text-[10px]', online ? 'text-teal-hud' : 'text-crit')} title={online ? 'Online' : 'Offline'}>
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        </span>
        <time className="hidden font-mono text-sm tabular-nums text-ice sm:block">{fmtTime(now, 'de-DE', true)}</time>
        <button onClick={onToggleMonitor} className={cx('hud-icon-btn', sidePanelsInline && 'hidden')} aria-label="Systemmonitor anzeigen"><Activity className="h-4 w-4" /></button>
        <button onClick={onSettings} className="hud-icon-btn" aria-label="Einstellungen (Strg+,)" title="Einstellungen"><Settings className="h-4 w-4" /></button>
      </div>
    </header>
  );
}
