import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, CalendarDays, Check, Clock, CloudSun, Newspaper, NotebookPen, Plus, RefreshCw, Trash2, X, ListTodo, type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { InfoModuleId } from '../../types';
import { useWorkspace } from '../../state/workspace';
import { useClock } from '../../hooks/useClock';
import { cx, fmtDate, fmtTime, isSameDay } from '../../lib/util';

const MODULES: { id: InfoModuleId; label: string; icon: LucideIcon }[] = [
  { id: 'clock', label: 'Zeit', icon: Clock },
  { id: 'weather', label: 'Wetter', icon: CloudSun },
  { id: 'calendar', label: 'Kalender', icon: CalendarDays },
  { id: 'reminders', label: 'Erinnerungen', icon: Bell },
  { id: 'news', label: 'Nachrichten', icon: Newspaper },
  { id: 'tasks', label: 'Aufgaben', icon: ListTodo },
  { id: 'notes', label: 'Notizen', icon: NotebookPen },
];

export function InfoPanel({ className }: { className?: string }) {
  const ws = useWorkspace();
  const ordered = MODULES.filter((m) => ws.openModules.includes(m.id));
  return (
    <div className={cx('flex min-h-0 flex-col gap-3', className)}>
      <nav className="glass flex justify-between p-1.5" aria-label="Informationsmodule">
        {MODULES.map((m) => {
          const on = ws.openModules.includes(m.id);
          return (
            <button key={m.id} onClick={() => ws.toggleModule(m.id)} aria-pressed={on} title={m.label} aria-label={`${m.label} ${on ? 'schließen' : 'öffnen'}`}
              className={cx('relative grid h-8 w-8 place-items-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-hud/50',
                on ? 'bg-cyan-hud/15 text-cyan-hud shadow-glow-sm' : 'text-ice/40 hover:bg-cyan-hud/5 hover:text-ice/80')}>
              <m.icon className="h-4 w-4" />
            </button>
          );
        })}
      </nav>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {ordered.map((m) => (
            <motion.div key={m.id} layout initial={{ opacity: 0, x: -24, scale: 0.98 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -24, scale: 0.98 }} transition={{ duration: 0.25 }}>
              <Module title={m.label} icon={m.icon} onClose={() => ws.toggleModule(m.id, false)}>
                {m.id === 'clock' && <ClockModule />}
                {m.id === 'weather' && <WeatherModule />}
                {m.id === 'calendar' && <CalendarModule />}
                {m.id === 'reminders' && <RemindersModule />}
                {m.id === 'news' && <NewsModule />}
                {m.id === 'tasks' && <TasksModule />}
                {m.id === 'notes' && <NotesModule />}
              </Module>
            </motion.div>
          ))}
        </AnimatePresence>
        {!ordered.length && <p className="px-2 py-8 text-center text-xs text-ice/35">Alle Module geschlossen. Öffnen Sie Module über die Leiste oben.</p>}
      </div>
    </div>
  );
}

function Module({ title, icon: Icon, onClose, children, extra }: { title: string; icon: LucideIcon; onClose: () => void; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="glass p-3.5" aria-label={title}>
      <header className="mb-2.5 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-cyan-hud" aria-hidden />
        <h3 className="hud-label flex-1">{title}</h3>
        {extra}
        <button onClick={onClose} className="rounded p-0.5 text-ice/30 hover:text-ice" aria-label={`${title} schließen`}><X className="h-3 w-3" /></button>
      </header>
      {children}
    </section>
  );
}

function ClockModule() {
  const now = useClock(1000);
  const d = new Date(now);
  const secs = d.getSeconds();
  return (
    <div>
      <div className="flex items-baseline gap-2 font-display text-ice">
        <span className="text-4xl font-semibold tabular-nums tracking-wider">{fmtTime(now)}</span>
        <span className="font-mono text-sm tabular-nums text-cyan-hud">{String(secs).padStart(2, '0')}</span>
      </div>
      <div className="mt-0.5 text-xs text-ice/55">{fmtDate(now)}</div>
      <div className="mt-2.5 flex gap-[2px]" aria-hidden>
        {Array.from({ length: 60 }, (_, i) => (
          <span key={i} className={cx('h-1 flex-1 rounded-full transition-colors', i <= secs ? 'bg-cyan-hud/80' : 'bg-cyan-hud/10')} />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-ice/35">
        <span>KW {weekNumber(d)}</span><span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
      </div>
    </div>
  );
}

function weekNumber(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}

const wxIcon = (c: number) => (c === 0 ? '☀' : c <= 2 ? '⛅' : c <= 48 ? '☁' : c <= 67 || (c >= 80 && c <= 82) ? '☂' : c <= 77 ? '❄' : '⚡');

function WeatherModule() {
  const { weather: w, weatherError, refreshWeather } = useWorkspace();
  if (!w) return <p className="font-mono text-xs text-cyan-hud/60">Atmosphärische Daten werden abgerufen …</p>;
  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-ice/55">{w.city}</div>
          <div className="font-display text-4xl font-semibold text-ice">{w.temperature}°</div>
          <div className="text-xs text-cyan-hud">{w.description}</div>
        </div>
        <div className="text-right">
          <div className="text-4xl leading-none text-cyan-hud/80" aria-hidden>{wxIcon(w.code)}</div>
          <button onClick={refreshWeather} className="mt-2 rounded p-1 text-ice/30 hover:text-cyan-hud" aria-label="Wetter aktualisieren"><RefreshCw className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px] text-ice/50">
        <span>Gefühlt {w.apparent}°</span><span className="text-center">Feuchte {w.humidity}%</span><span className="text-right">Wind {w.wind} km/h</span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1 border-t border-cyan-hud/10 pt-2.5">
        {w.forecast.slice(0, 5).map((f) => (
          <div key={f.day + f.min} className="text-center">
            <div className="hud-label text-[9px]">{f.day}</div>
            <div className="text-sm text-cyan-hud/80" aria-hidden>{wxIcon(f.code)}</div>
            <div className="font-mono text-[10px] text-ice/70">{f.max}°<span className="text-ice/35"> {f.min}°</span></div>
          </div>
        ))}
      </div>
      {w.demo && <p className="mt-2 text-[10px] text-warn" title={weatherError ?? ''}>DEMO-DATEN · Wetterdienst nicht erreichbar</p>}
    </div>
  );
}

function CalendarModule() {
  const { events, addEvent, removeEvent } = useWorkspace();
  const now = useClock(30_000);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('15:00');
  const upcoming = events.filter((e) => e.end > now).sort((a, b) => a.start - b.start).slice(0, 6);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const [h, m] = time.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    addEvent({ title: title.trim(), start: d.getTime(), end: d.getTime() + 3600e3 });
    setTitle(''); setAdding(false);
  };

  return (
    <div>
      <ul className="space-y-1.5">
        {!upcoming.length && <li className="text-xs text-ice/40">Keine anstehenden Termine.</li>}
        {upcoming.map((e) => {
          const live = e.start <= now && e.end > now;
          return (
            <li key={e.id} className={cx('group flex gap-2.5 rounded-lg border-l-2 py-1 pl-2.5', e.priority === 'high' ? 'border-warn' : 'border-cyan-hud/50', live && 'bg-cyan-hud/[0.06]')}>
              <div className="w-11 shrink-0 font-mono text-[11px] text-ice/70">
                {fmtTime(e.start)}
                {!isSameDay(e.start, now) && <div className="text-[9px] text-ice/35">{new Date(e.start).toLocaleDateString('de-DE', { weekday: 'short' })}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-ice">{e.title}</div>
                {e.location && <div className="truncate text-[10px] text-ice/40">{e.location}</div>}
              </div>
              {live && <span className="hud-chip self-center border-teal-hud/50 text-teal-hud">Jetzt</span>}
              <button onClick={() => removeEvent(e.id)} className="self-center p-0.5 text-ice/20 opacity-0 hover:text-crit group-hover:opacity-100 focus:opacity-100" aria-label={`${e.title} löschen`}><X className="h-3 w-3" /></button>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <form onSubmit={submit} className="mt-2 flex gap-1.5">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Termin" className="hud-input h-7 py-0 text-xs" aria-label="Termintitel" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="hud-input h-7 w-24 py-0 text-xs" aria-label="Uhrzeit" />
          <button className="hud-icon-btn h-7 w-7 shrink-0" aria-label="Termin speichern"><Check className="h-3 w-3" /></button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="hud-btn mt-2 w-full py-1 text-[11px]"><Plus className="h-3 w-3" /> Termin heute</button>
      )}
    </div>
  );
}

function RemindersModule() {
  const { reminders, toggleReminder, removeReminder, addReminder } = useWorkspace();
  const [text, setText] = useState('');
  const [mins, setMins] = useState(30);
  const list = [...reminders].sort((a, b) => Number(a.done) - Number(b.done) || a.at - b.at);
  return (
    <div>
      <ul className="space-y-1">
        {!list.length && <li className="text-xs text-ice/40">Keine Erinnerungen.</li>}
        {list.map((r) => (
          <li key={r.id} className="group flex items-center gap-2 text-xs">
            <button onClick={() => toggleReminder(r.id)} aria-label={r.done ? 'Als offen markieren' : 'Als erledigt markieren'}
              className={cx('grid h-4 w-4 shrink-0 place-items-center rounded border', r.done ? 'border-teal-hud/60 bg-teal-hud/20' : 'border-cyan-hud/40')}>
              {r.done && <Check className="h-2.5 w-2.5 text-teal-hud" />}
            </button>
            <span className={cx('flex-1 truncate', r.done ? 'text-ice/30 line-through' : 'text-ice/85')}>{r.text}</span>
            <span className={cx('font-mono text-[10px]', !r.done && r.at < Date.now() ? 'text-warn' : 'text-ice/40')}>{fmtTime(r.at)}</span>
            <button onClick={() => removeReminder(r.id)} className="text-ice/20 opacity-0 hover:text-crit group-hover:opacity-100 focus:opacity-100" aria-label="Löschen"><X className="h-3 w-3" /></button>
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { addReminder(text.trim(), Date.now() + mins * 60e3); setText(''); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Erinnern an …" className="hud-input h-7 py-0 text-xs" aria-label="Neue Erinnerung" />
        <select value={mins} onChange={(e) => setMins(Number(e.target.value))} className="hud-input h-7 w-20 py-0 text-xs" aria-label="In Minuten">
          {[5, 15, 30, 60, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
        <button className="hud-icon-btn h-7 w-7 shrink-0" aria-label="Erinnerung hinzufügen"><Plus className="h-3 w-3" /></button>
      </form>
    </div>
  );
}

function NewsModule() {
  const { news } = useWorkspace();
  return (
    <div>
      <ul className="space-y-2">
        {news.map((n) => (
          <li key={n.id} className="border-l border-cyan-hud/30 pl-2.5">
            <div className="flex gap-2 font-mono text-[9px] uppercase tracking-wider text-cyan-hud/60"><span>{n.category}</span><span className="text-ice/30">{n.source} · {fmtTime(n.time)}</span></div>
            <div className="text-xs leading-snug text-ice/85">{n.title}</div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-warn">DEMO-SCHLAGZEILEN · Nachrichten-API im Backend anbindbar</p>
    </div>
  );
}

function TasksModule() {
  const { tasks, addTask, toggleTask, removeTask } = useWorkspace();
  const [text, setText] = useState('');
  const open = tasks.filter((t) => !t.done).length;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-cyan-hud/10">
          <div className="h-full bg-teal-hud/70 transition-all" style={{ width: `${tasks.length ? ((tasks.length - open) / tasks.length) * 100 : 0}%` }} />
        </div>
        <span className="font-mono text-[10px] text-ice/50">{tasks.length - open}/{tasks.length}</span>
      </div>
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.id} className="group flex items-center gap-2 text-xs">
            <button onClick={() => toggleTask(t.id)} aria-label={t.done ? 'Als offen markieren' : 'Als erledigt markieren'}
              className={cx('grid h-4 w-4 shrink-0 place-items-center rounded border transition', t.done ? 'border-teal-hud/60 bg-teal-hud/20' : 'border-cyan-hud/40 hover:border-cyan-hud')}>
              {t.done && <Check className="h-2.5 w-2.5 text-teal-hud" />}
            </button>
            <span className={cx('flex-1', t.done ? 'text-ice/30 line-through' : 'text-ice/85')}>{t.text}</span>
            <button onClick={() => removeTask(t.id)} className="text-ice/20 opacity-0 hover:text-crit group-hover:opacity-100 focus:opacity-100" aria-label="Aufgabe löschen"><Trash2 className="h-3 w-3" /></button>
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { addTask(text.trim()); setText(''); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Neue Aufgabe …" className="hud-input h-7 py-0 text-xs" aria-label="Neue Aufgabe" />
        <button className="hud-icon-btn h-7 w-7 shrink-0" aria-label="Aufgabe hinzufügen"><Plus className="h-3 w-3" /></button>
      </form>
    </div>
  );
}

function NotesModule() {
  const { notes, addNote, updateNote, removeNote } = useWorkspace();
  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <div key={n.id} className="group relative">
          <textarea
            defaultValue={n.text}
            onBlur={(e) => { const v = e.target.value.trim(); if (!v) removeNote(n.id); else if (v !== n.text) updateNote(n.id, v); }}
            rows={2} className="hud-input resize-y bg-cyan-hud/[0.03] py-1.5 text-xs leading-relaxed" aria-label="Notiz bearbeiten"
          />
          <button onClick={() => removeNote(n.id)} className="absolute right-1.5 top-1.5 text-ice/20 opacity-0 hover:text-crit group-hover:opacity-100 focus:opacity-100" aria-label="Notiz löschen"><Trash2 className="h-3 w-3" /></button>
        </div>
      ))}
      <button onClick={() => addNote('Neue Notiz')} className="hud-btn w-full py-1 text-[11px]"><Plus className="h-3 w-3" /> Notiz</button>
    </div>
  );
}
