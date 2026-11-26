import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { JarvisAction, JarvisContext, SkillId, ViewMode } from './types';
import { SettingsProvider, useSettings } from './state/settings';
import { WorkspaceProvider, useWorkspace } from './state/workspace';
import { BrowserProvider, currentUrl, useBrowser } from './state/browser';
import { useAssistant } from './hooks/useAssistant';
import { usePersistentState } from './hooks/usePersistentState';
import { useMediaQuery } from './hooks/useMediaQuery';
import { TopBar } from './components/layout/TopBar';
import { CoreStage } from './components/core/CoreStage';
import { ChatPanel } from './components/chat/ChatPanel';
import { BrowserPanel } from './components/browser/BrowserPanel';
import { SystemMonitor } from './components/system/SystemMonitor';
import { InfoPanel } from './components/info/InfoPanel';
import { SettingsDialog } from './components/settings/SettingsDialog';
import { Toasts, type Toast } from './components/ui/Toasts';
import { cx, fmtTime, germanGreeting, isSameDay, uid } from './lib/util';
import { CommandsContext, type Commands } from './state/commands';
import { runSkill, SKILL_LABELS, type SkillEnv, type SkillInput, type SkillResult } from './services/skills';
import { downloadText, eventsToIcs } from './services/data/ics';

const MAX_FILE = 10 * 1024 * 1024;
const readAsBase64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] ?? '');
  r.onerror = () => rej(r.error);
  r.readAsDataURL(f);
});
const isTextFile = (f: File) => /^text\/|json|xml|csv|markdown|javascript|typescript/.test(f.type) || /\.(txt|md|csv|json|log|xml|html?|js|ts|tsx|py|ya?ml|ini|conf)$/i.test(f.name);

export default function App() {
  return (
    <SettingsProvider>
      <WorkspaceProvider>
        <BrowserProvider>
          <Shell />
        </BrowserProvider>
      </WorkspaceProvider>
    </SettingsProvider>
  );
}

function Drawer({ side, open, onClose, children, label }: { side: 'left' | 'right'; open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 bg-void/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.aside
            role="dialog" aria-label={label}
            initial={{ x: side === 'left' ? '-100%' : '100%' }} animate={{ x: 0 }} exit={{ x: side === 'left' ? '-100%' : '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cx('absolute top-0 flex h-full w-[min(92vw,360px)] flex-col bg-void/95 p-3 pt-12', side === 'left' ? 'left-0 border-r' : 'right-0 border-l', 'border-cyan-hud/15')}
          >
            <button onClick={onClose} className="hud-icon-btn absolute right-3 top-3" aria-label="Schließen"><X className="h-4 w-4" /></button>
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Shell() {
  const { settings } = useSettings();
  const ws = useWorkspace();
  const browser = useBrowser();
  const [view, setView] = usePersistentState<ViewMode>('view', 'command');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawer, setDrawer] = useState<'info' | 'monitor' | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isUltra = useMediaQuery('(min-width: 1680px)');

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  // Refs so the assistant always sees fresh state without re-subscribing.
  const wsRef = useRef(ws); wsRef.current = ws;
  const brRef = useRef(browser); brRef.current = browser;

  const execute = useCallback((actions: JarvisAction[]) => {
    const w = wsRef.current, b = brRef.current;
    for (const a of actions) {
      switch (a.type) {
        case 'navigate': b.navigate(a.url, { newTab: a.newTab }); ensureBrowserVisible(); break;
        case 'search': b.search(a.query, { newTab: a.newTab }); ensureBrowserVisible(); break;
        case 'newTab': b.openTab(a.url, a.private); ensureBrowserVisible(); break;
        case 'closeTab': b.closeTab(); break;
        case 'back': b.back(); break;
        case 'forward': b.forward(); break;
        case 'reload': b.reload(); break;
        case 'bookmark': b.toggleBookmark(); break;
        case 'openModule': w.toggleModule(a.module, true); if (!isLgRef.current || viewRef.current !== 'command') setDrawer('info'); break;
        case 'setView': setView(a.view); break;
        case 'addTask': w.addTask(a.text); w.toggleModule('tasks', true); break;
        case 'addNote': w.addNote(a.text); w.toggleModule('notes', true); break;
        case 'addReminder': w.addReminder(a.text, a.at ?? Date.now() + 30 * 60e3); w.toggleModule('reminders', true); break;
        case 'openSettings': setSettingsOpen(true); break;
        case 'clearChat': break; // handled inside the assistant
        case 'skill': skillRef.current(a.skill, a.arg, false); break;
        case 'routine': routineRef.current(a.name); break;
        case 'exportCalendar': downloadText('jarvis-kalender.ics', eventsToIcs(w.events)); break;
      }
    }
  }, [setView]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLgRef = useRef(isLg); isLgRef.current = isLg;
  const isUltraRef = useRef(isUltra); isUltraRef.current = isUltra;
  const viewRef = useRef(view); viewRef.current = view;
  function ensureBrowserVisible() {
    // In command view the browser is only inline on ultrawide screens; otherwise switch to browser view.
    if (viewRef.current === 'focus' || (viewRef.current === 'command' && !isUltraRef.current && isLgRef.current)) setView('browser');
  }

  const getContext = useCallback((): JarvisContext => {
    const w = wsRef.current, b = brRef.current;
    return {
      now: Date.now(), locale: settings.lang, userTitle: settings.userTitle,
      events: w.events, tasks: w.tasks, reminders: w.reminders, weather: w.weather,
      activeTab: b.active.private ? undefined : { title: b.active.title, url: currentUrl(b.active) },
    };
  }, [settings.lang, settings.userTitle]);

  const assistant = useAssistant({ execute, getContext });
  const assistantRef = useRef(assistant); assistantRef.current = assistant;

  const env = useCallback((): SkillEnv => ({
    useBackend: settings.provider === 'backend', backendUrl: settings.backendUrl, sender: settings.userName,
  }), [settings.provider, settings.backendUrl, settings.userName]);

  /** Applies structured skill results to the workspace (categories, sub-tasks). */
  const applyResult = useCallback((r: SkillResult | null) => {
    if (!r?.data) return;
    if (r.data.kind === 'categories') { brRef.current.setBookmarkCategories(r.data.map); brRef.current.navigate('jarvis://bookmarks'); ensureBrowserVisible(); }
    if (r.data.kind === 'steps') { [...r.data.steps].reverse().forEach((t) => wsRef.current.addTask(t)); wsRef.current.toggleModule('tasks', true); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runSkillAction = useCallback((skill: SkillId, arg: string | undefined, logUser: boolean) => {
    const a = assistantRef.current, b = brRef.current;
    const url = currentUrl(b.active);
    let input: SkillInput;
    let label = SKILL_LABELS[skill];
    switch (skill) {
      case 'summarize': case 'analyze': case 'translate':
        if (url.startsWith('jarvis://')) { a.announce('Bitte öffnen Sie zuerst eine Webseite im Browser-Panel, dann kann ich sie lesen.'); return; }
        input = skill === 'translate' ? { skill, url, target: arg || 'Deutsch' } : { skill, url };
        label = `${label}: ${b.active.title}${skill === 'translate' ? ` → ${arg || 'Deutsch'}` : ''}`;
        break;
      case 'research':
        if (!arg?.trim()) { a.announce('Wozu soll ich recherchieren? Schreiben Sie das Thema ins Eingabefeld und drücken Sie erneut auf Recherche.'); return; }
        input = { skill, query: arg }; label = `Recherche: ${arg}`; break;
      case 'email':
        if (!arg?.trim()) { a.announce('Worum soll es in der E-Mail gehen? Beschreiben Sie das Anliegen im Eingabefeld, zum Beispiel: „an pepper@stark.com wegen Termin am Freitag“.'); return; }
        input = { skill, request: arg }; label = `E-Mail: ${arg}`; break;
      case 'bookmarks':
        if (!b.bookmarks.length) { a.announce('Es gibt noch keine Lesezeichen zum Sortieren.'); return; }
        input = { skill, bookmarks: b.bookmarks.map(({ id, title, url }) => ({ id, title, url })) }; break;
      case 'breakdown':
        if (!arg?.trim()) { a.announce('Welche Aufgabe soll ich zerlegen?'); return; }
        input = { skill, task: arg }; label = `Aufgabe zerlegen: ${arg}`; break;
      default: return;
    }
    a.runSkill(label, skill, (signal) => runSkill(input, { ...env(), signal }), { logUser }).then(applyResult);
  }, [env, applyResult]);
  const skillRef = useRef(runSkillAction); skillRef.current = runSkillAction;

  const analyzeFile = useCallback(async (file: File) => {
    const a = assistantRef.current;
    if (file.size > MAX_FILE) { a.announce(`Die Datei ist mit ${(file.size / 1e6).toFixed(1)} MB zu groß. Maximal 10 MB.`); return; }
    const base = { name: file.name, size: file.size, mediaType: file.type };
    a.runSkill(`Datei analysieren: ${file.name}`, 'file', async (signal) => {
      const input: SkillInput = isTextFile(file) ? { skill: 'file', ...base, text: (await file.text()).slice(0, 400_000) } : { skill: 'file', ...base, data: await readAsBase64(file) };
      return runSkill(input, { ...env(), signal });
    }, { logUser: true });
  }, [env]);

  /** Builds a spoken status briefing from live workspace data. */
  const briefing = useCallback(() => {
    const w = wsRef.current, now = Date.now();
    const today = w.events.filter((e) => isSameDay(e.start, now) && e.end > now).sort((x, y) => x.start - y.start);
    const open = w.tasks.filter((t) => !t.done);
    const rem = w.reminders.filter((r) => !r.done && r.at > now && isSameDay(r.at, now));
    return [
      `${germanGreeting()}, ${settings.userTitle}.`,
      w.weather ? `In ${w.weather.city} sind es ${w.weather.temperature} Grad, ${w.weather.description.toLowerCase()}.` : '',
      today.length ? `Heute stehen noch ${today.length} Termin${today.length > 1 ? 'e' : ''} an, als nächstes ${today[0].title} um ${fmtTime(today[0].start)}.` : 'Für heute stehen keine weiteren Termine an.',
      open.length ? `${open.length} Aufgabe${open.length > 1 ? 'n sind' : ' ist'} offen.` : 'Alle Aufgaben sind erledigt.',
      rem.length ? `Und ich erinnere Sie heute noch an: ${rem.map((r) => r.text).join(', ')}.` : '',
    ].filter(Boolean).join(' ');
  }, [settings.userTitle]);

  const runRoutine = useCallback((name: string) => {
    const a = assistantRef.current, b = brRef.current;
    const n = name.toLowerCase();
    const r = settings.routines.find((x) => x.name.toLowerCase() === n) ??
      settings.routines.find((x) => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase().replace(/routine$/, '')));
    if (!r) {
      if (/fokus|focus/.test(n)) { setView('focus'); return; }
      a.announce(`Die Routine „${name}“ kenne ich nicht. Verfügbar: ${settings.routines.map((x) => x.name).join(', ') || 'keine'}. Neue Routinen legen Sie in den Einstellungen an.`);
      return;
    }
    r.urls.forEach((u) => b.openTab(u));
    if (r.urls.length) ensureBrowserVisible();
    const opened = r.urls.length ? `${r.urls.length} Seite${r.urls.length > 1 ? 'n' : ''} geöffnet. ` : '';
    a.announce(`${r.name} gestartet. ${opened}${r.briefing ? briefing() : ''}`.trim(), 'routine');
  }, [settings.routines, briefing, setView]); // eslint-disable-line react-hooks/exhaustive-deps
  const routineRef = useRef(runRoutine); routineRef.current = runRoutine;

  const commands: Commands = { execute, skill: (sk, arg) => runSkillAction(sk, arg, true), analyzeFile };

  // Reminder scheduler
  const notified = useRef(new Set<string>());
  useEffect(() => {
    const check = () => {
      for (const r of wsRef.current.reminders) {
        if (!r.done && r.at <= Date.now() && r.at > Date.now() - 5 * 60e3 && !notified.current.has(r.id)) {
          notified.current.add(r.id);
          toast(`Erinnerung: ${r.text}`, 'reminder');
          assistant.say(`Verzeihung, ${settings.userTitle}. Sie wollten erinnert werden: ${r.text}.`);
        }
      }
    };
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, [toast, assistant.say, settings.userTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); assistant.toggleListening(); }
      else if (e.ctrlKey && e.key === ',') { e.preventDefault(); setSettingsOpen(true); }
      else if (e.altKey && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); setView((['command', 'browser', 'focus'] as ViewMode[])[Number(e.key) - 1]); }
      else if (e.key === 'Escape' && !settingsOpen) { assistant.cancel(); setDrawer(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assistant, settingsOpen, setView]);

  const reduced = settings.reducedMotion;

  return (
    <CommandsContext.Provider value={commands}>
    <div className={cx('hud-backdrop flex h-full flex-col', settings.scanlines && 'scanlines', settings.glitch && !reduced && 'glitch-on', reduced && 'reduced-motion')}>
      {settings.scanlines && !reduced && <div className="scan-sweep" aria-hidden />}
      <a href="#chat-input" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2">Zum Chat springen</a>
      <TopBar
        view={view} onView={setView} onSettings={() => setSettingsOpen(true)}
        onToggleInfo={() => setDrawer((d) => (d === 'info' ? null : 'info'))}
        onToggleMonitor={() => setDrawer((d) => (d === 'monitor' ? null : 'monitor'))}
        coreState={assistant.state} providerLabel={assistant.provider.label}
        sidePanelsInline={isLg && view === 'command'}
      />

      <AnimatePresence mode="wait">
        <motion.main
          key={view + (isLg ? 'L' : 'S') + (isUltra ? 'U' : '')}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          className="min-h-0 flex-1"
        >
          {!isLg ? (
            // ── Tablet / small: stacked, scrollable; side panels in drawers ──
            <div className="h-full space-y-3 overflow-y-auto p-3">
              {view !== 'browser' && <CoreStage assistant={assistant} className="h-[52vh] min-h-[340px]" />}
              <div id="chat-input"><ChatPanel assistant={assistant} className="h-[60vh] min-h-[380px]" /></div>
              {view !== 'focus' && <BrowserPanel className="h-[70vh] min-h-[420px]" onNotify={toast} />}
            </div>
          ) : view === 'focus' ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col gap-3 p-3">
              <CoreStage assistant={assistant} className="min-h-0 flex-[1.3]" />
              <div id="chat-input" className="min-h-0 flex-1"><ChatPanel assistant={assistant} className="h-full" /></div>
            </div>
          ) : view === 'browser' ? (
            <div className="grid h-full grid-cols-[minmax(0,1fr)_360px] gap-3 p-3 2xl:grid-cols-[minmax(0,1fr)_400px]">
              <BrowserPanel className="h-full" onNotify={toast} />
              <div className="flex min-h-0 flex-col gap-3">
                <CoreStage assistant={assistant} compact className="h-[230px] shrink-0" />
                <div id="chat-input" className="min-h-0 flex-1"><ChatPanel assistant={assistant} className="h-full" /></div>
              </div>
            </div>
          ) : (
            <div className={cx('grid h-full gap-3 p-3',
              isUltra ? 'grid-cols-[300px_minmax(0,0.85fr)_minmax(0,1.25fr)_320px]' : 'grid-cols-[270px_minmax(0,1fr)_300px] xl:grid-cols-[300px_minmax(0,1fr)_330px]')}>
              <InfoPanel className="h-full" />
              <div className="flex min-h-0 flex-col gap-3">
                <CoreStage assistant={assistant} className="min-h-0 flex-[1.15]" />
                <div id="chat-input" className="min-h-0 flex-1"><ChatPanel assistant={assistant} className="h-full" /></div>
              </div>
              {isUltra && <BrowserPanel className="h-full" onNotify={toast} />}
              <SystemMonitor aiState={assistant.state} className="h-full" />
            </div>
          )}
        </motion.main>
      </AnimatePresence>

      <Drawer side="left" open={drawer === 'info'} onClose={() => setDrawer(null)} label="Informationsmodule">
        <InfoPanel className="h-full" />
      </Drawer>
      <Drawer side="right" open={drawer === 'monitor'} onClose={() => setDrawer(null)} label="Systemmonitor">
        <SystemMonitor aiState={assistant.state} className="h-full" />
      </Drawer>

      <AnimatePresence>{settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}</AnimatePresence>
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
    </CommandsContext.Provider>
  );
}
