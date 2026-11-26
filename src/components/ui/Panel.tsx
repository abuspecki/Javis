import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cx } from '../../lib/util';

interface Props {
  title: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  badge?: ReactNode;
}

export function Panel({ title, icon: Icon, actions, children, className, bodyClassName, collapsible, defaultOpen = true, badge }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cx('glass flex min-h-0 flex-col', className)} aria-label={title}>
      <header className="flex items-center gap-2 border-b border-cyan-hud/10 px-4 py-2.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-cyan-hud" aria-hidden />}
        <h2 className="hud-title flex-1 truncate">{title}</h2>
        {badge}
        {actions}
        {collapsible && (
          <button className="hud-icon-btn h-6 w-6" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? `${title} einklappen` : `${title} ausklappen`}>
            <ChevronDown className={cx('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')} />
          </button>
        )}
      </header>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className={cx('min-h-0 flex-1 overflow-hidden', bodyClassName)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function SourceChip({ source }: { source: 'live' | 'estimate' | 'demo' }) {
  const map = {
    live: 'border-teal-hud/40 text-teal-hud',
    estimate: 'border-cyan-hud/30 text-cyan-hud/80',
    demo: 'border-warn/40 text-warn',
  } as const;
  const label = { live: 'LIVE', estimate: 'EST', demo: 'DEMO' }[source];
  const tip = { live: 'Echte Systemdaten', estimate: 'Vom Browser geschätzt', demo: 'Demo-Daten (keine echten Systemdaten verfügbar)' }[source];
  return <span className={cx('hud-chip', map[source])} title={tip}>{label}</span>;
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm text-ice">{label}</span>
        {description && <span className="block text-xs text-ice/45">{description}</span>}
      </span>
      <button
        type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-hud/50',
          checked ? 'border-cyan-hud/70 bg-cyan-hud/30' : 'border-ice/20 bg-void')}
      >
        <span className={cx('absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all', checked ? 'left-[18px] bg-cyan-hud shadow-glow-sm' : 'left-0.5 bg-ice/40')} />
      </button>
    </label>
  );
}
