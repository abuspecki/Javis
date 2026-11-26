import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import type { Assistant } from '../../hooks/useAssistant';
import { useSettings } from '../../state/settings';
import { useClock } from '../../hooks/useClock';
import { cx, greeting } from '../../lib/util';
import { JarvisCore } from './JarvisCore';

const STATUS: Record<string, { text: string; cls: string }> = {
  idle: { text: 'J.A.R.V.I.S. SYSTEM ONLINE', cls: 'text-cyan-hud' },
  listening: { text: 'AUDIO INPUT ACTIVE — LISTENING', cls: 'text-teal-hud' },
  thinking: { text: 'PROCESSING REQUEST', cls: 'text-cyan-hud' },
  speaking: { text: 'VOICE OUTPUT ACTIVE', cls: 'text-ice' },
  error: { text: 'SYSTEM ALERT — CHECK LOG', cls: 'text-crit' },
};

const STREAM = 'NEURAL.LINK ▸ OK   ARC.OUTPUT ▸ 3.2 GJ/s   SAT.UPLINK ▸ LOCKED   ENCRYPTION ▸ AES-256   PROTOCOL ▸ HOUSE PARTY: STANDBY   DIAGNOSTICS ▸ NOMINAL   LAT ▸ 34.0259 N   LON ▸ 118.7798 W   ';

export function CoreStage({ assistant, compact, className }: { assistant: Assistant; compact?: boolean; className?: string }) {
  const { settings } = useSettings();
  useClock(60_000); // re-render greeting each minute
  const st = STATUS[assistant.state];
  // The core must stay a perfect circle: size it to the smaller side of its box.
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = boxRef.current!;
    const ro = new ResizeObserver(([e]) => setSize(Math.floor(Math.min(e.contentRect.width, e.contentRect.height, compact ? 220 : 560))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);

  return (
    <section className={cx('relative flex min-h-0 flex-col items-center justify-center', className)} aria-label="J.A.R.V.I.S. Kern">
      {/* corner telemetry */}
      {!compact && (
        <>
          <div className="pointer-events-none absolute left-2 top-2 hidden font-mono text-[9px] leading-relaxed text-cyan-hud/40 md:block" aria-hidden>
            <div>CORE.TEMP 36.4°C</div><div>FLUX ▸ STABLE</div><div>SYNC ▸ 99.97%</div>
          </div>
          <div className="pointer-events-none absolute right-2 top-2 hidden text-right font-mono text-[9px] leading-relaxed text-cyan-hud/40 md:block" aria-hidden>
            <div>MODE ▸ {assistant.provider.id.toUpperCase()}</div><div>LANG ▸ {settings.lang}</div><div>WAKE ▸ {settings.wakeWord ? 'ON' : 'OFF'}</div>
          </div>
        </>
      )}

      <div ref={boxRef} className="flex w-full min-h-0 flex-1 items-center justify-center">
        <div style={{ width: size, height: size }} className="flex items-center justify-center">
        <JarvisCore
          state={assistant.state} level={assistant.level} spectrum={assistant.spectrum}
          reducedMotion={settings.reducedMotion} onActivate={assistant.toggleListening}
        />
        </div>
      </div>

      <div className={cx('relative z-10 text-center', compact ? 'mt-1' : 'mt-2')}>
        {!compact && (
          <h1 className="glitch font-display text-xl font-semibold tracking-[0.35em] text-ice sm:text-2xl" data-text={`${greeting()}, ${settings.userTitle.toUpperCase()}.`}>
            {greeting()}, {settings.userTitle.toUpperCase()}.
          </h1>
        )}
        <AnimatePresence mode="wait">
          <motion.div key={assistant.state} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className={cx('mt-1 flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.25em]', st.cls)} role="status" aria-live="polite">
            <span className={cx('h-1.5 w-1.5 rounded-full bg-current', assistant.state !== 'idle' && 'blink')} />
            {st.text}
          </motion.div>
        </AnimatePresence>
        {assistant.lastError && assistant.state === 'error' && <p className="mx-auto mt-1 max-w-md text-xs text-crit/80">{assistant.lastError}</p>}
        {!compact && (
          <button onClick={assistant.toggleListening}
            className={cx('hud-btn mx-auto mt-3 rounded-full px-4', assistant.listening && 'border-teal-hud/70 bg-teal-hud/15 text-teal-hud shadow-glow')}
            aria-pressed={assistant.listening}>
            <Mic className="h-3.5 w-3.5" /> {assistant.listening ? 'Zuhören beenden' : 'Mit J.A.R.V.I.S. sprechen'}
          </button>
        )}
      </div>

      {!compact && (
        <div className="pointer-events-none mt-3 w-full overflow-hidden border-y border-cyan-hud/10 py-1 [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]" aria-hidden>
          <div className="ticker flex w-max whitespace-nowrap font-mono text-[9px] tracking-[0.2em] text-cyan-hud/40">
            <span>{STREAM}</span><span>{STREAM}</span>
          </div>
        </div>
      )}
    </section>
  );
}
