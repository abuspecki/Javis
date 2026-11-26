import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Mic, MicOff, Send, Square, Trash2, User, Volume2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Assistant } from '../../hooks/useAssistant';
import { cx, fmtTime } from '../../lib/util';
import { Panel } from '../ui/Panel';

const SUGGESTIONS = ['Was steht heute an?', 'Wie ist das Wetter?', 'Öffne Wikipedia', 'Suche nach künstlicher Intelligenz', 'Neue Aufgabe: Anzug polieren'];

export function ChatPanel({ assistant, className }: { assistant: Assistant; className?: string }) {
  const { messages, state, interim, listening, send, cancel, clear, removeMessage, toggleListening, say } = assistant;
  const [draft, setDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = state === 'thinking';

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy, interim]);

  // Global shortcut: "/" focuses the command line
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(t.tagName)) { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = () => {
    if (!draft.trim()) return;
    send(draft);
    setDraft('');
  };

  return (
    <Panel
      title="Kommunikation"
      icon={Bot}
      className={className}
      bodyClassName="flex flex-col"
      badge={<span className="hud-label hidden sm:inline">{assistant.provider.label}</span>}
      actions={
        confirmClear ? (
          <span className="flex items-center gap-1">
            <button className="hud-btn border-crit/40 text-crit" onClick={() => { clear(); setConfirmClear(false); }}>Löschen</button>
            <button className="hud-icon-btn h-7 w-7" onClick={() => setConfirmClear(false)} aria-label="Abbrechen"><X className="h-3.5 w-3.5" /></button>
          </span>
        ) : (
          <button className="hud-icon-btn h-7 w-7" onClick={() => setConfirmClear(true)} aria-label="Gespräch zurücksetzen" title="Gespräch zurücksetzen">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )
      }
    >
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" role="log" aria-live="polite" aria-label="Chatverlauf">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id} layout="position"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
              className={cx('group flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}
            >
              <div className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border',
                m.role === 'user' ? 'border-ice/20 bg-ice/5' : m.error ? 'border-crit/50 bg-crit/10' : 'border-cyan-hud/40 bg-cyan-hud/10')}>
                {m.role === 'user' ? <User className="h-3 w-3 text-ice/70" /> : <Bot className={cx('h-3 w-3', m.error ? 'text-crit' : 'text-cyan-hud')} />}
              </div>
              <div className={cx('max-w-[85%] min-w-0', m.role === 'user' && 'text-right')}>
                <div className={cx('inline-block whitespace-pre-wrap rounded-xl px-3 py-2 text-left text-[13px] leading-relaxed',
                  m.role === 'user' ? 'rounded-tr-sm bg-ice/[0.07] text-ice' : m.error ? 'rounded-tl-sm border border-crit/30 bg-crit/10 text-ice' : 'rounded-tl-sm border border-cyan-hud/15 bg-cyan-hud/[0.05] text-ice/90')}>
                  {m.content}
                </div>
                <div className={cx('mt-1 flex items-center gap-2 font-mono text-[10px] text-ice/30', m.role === 'user' && 'justify-end')}>
                  <time dateTime={new Date(m.timestamp).toISOString()}>{fmtTime(m.timestamp, 'de-DE', true)}</time>
                  {m.source && m.role === 'assistant' && <span className="uppercase tracking-wider">· {m.source}</span>}
                  <span className="flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    {m.role === 'assistant' && <button onClick={() => say(m.content)} className="hover:text-cyan-hud" aria-label="Vorlesen"><Volume2 className="h-3 w-3" /></button>}
                    <button onClick={() => removeMessage(m.id)} className="hover:text-crit" aria-label="Nachricht entfernen"><X className="h-3 w-3" /></button>
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
          {busy && (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5" aria-label="J.A.R.V.I.S. denkt nach">
              <div className="grid h-6 w-6 place-items-center rounded-md border border-cyan-hud/40 bg-cyan-hud/10"><Bot className="h-3 w-3 text-cyan-hud" /></div>
              <div className="flex items-center gap-1 rounded-xl border border-cyan-hud/15 bg-cyan-hud/[0.05] px-3 py-2.5">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-cyan-hud" animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                ))}
                <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-cyan-hud/60">Analysiere</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {messages.length <= 2 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="hud-btn shrink-0 whitespace-nowrap rounded-full py-1 text-[11px]" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <div className="border-t border-cyan-hud/10 p-3">
        {listening && (
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] text-teal-hud" aria-live="assertive">
            <span className="blink h-1.5 w-1.5 rounded-full bg-teal-hud" /> {interim || 'Ich höre zu …'}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={toggleListening}
            className={cx('hud-icon-btn h-10 w-10 shrink-0 rounded-xl', listening && 'border-teal-hud/70 bg-teal-hud/15 text-teal-hud shadow-glow')}
            aria-label={listening ? 'Zuhören beenden' : 'Spracheingabe starten'} aria-pressed={listening}
            title="Spracheingabe (Strg+Leertaste)"
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={1}
            placeholder="Befehl oder Frage eingeben …  ( / )"
            className="hud-input max-h-28 min-h-10 resize-none rounded-xl py-2.5"
            aria-label="Nachricht an J.A.R.V.I.S."
          />
          {busy || state === 'speaking' ? (
            <button onClick={cancel} className="hud-icon-btn h-10 w-10 shrink-0 rounded-xl border-warn/40 text-warn" aria-label="Abbrechen"><Square className="h-4 w-4" /></button>
          ) : (
            <button onClick={submit} disabled={!draft.trim()} className="hud-icon-btn h-10 w-10 shrink-0 rounded-xl" aria-label="Senden"><Send className="h-4 w-4" /></button>
          )}
        </div>
      </div>
    </Panel>
  );
}
