import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, Info } from 'lucide-react';

export interface Toast { id: string; text: string; kind: 'info' | 'warn' | 'reminder' }

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = t.kind === 'warn' ? AlertTriangle : t.kind === 'reminder' ? Bell : Info;
          return (
            <motion.button
              key={t.id} layout onClick={() => onDismiss(t.id)}
              initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={`glass pointer-events-auto flex items-center gap-3 px-4 py-3 text-left text-sm ${t.kind === 'warn' ? 'border-warn/40' : t.kind === 'reminder' ? 'border-teal-hud/40' : ''}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${t.kind === 'warn' ? 'text-warn' : t.kind === 'reminder' ? 'text-teal-hud' : 'text-cyan-hud'}`} />
              <span className="text-ice/90">{t.text}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
