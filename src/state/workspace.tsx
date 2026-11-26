import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import type { CalendarEvent, InfoModuleId, NewsItem, Note, Reminder, Task, WeatherData } from '../types';
import { demoNews, seedEvents, seedNotes, seedReminders, seedTasks } from '../services/data/seed';
import { demoWeather, fetchWeather } from '../services/data/weather';
import { uid } from '../lib/util';
import { useSettings } from './settings';

interface Workspace {
  events: CalendarEvent[];
  tasks: Task[];
  reminders: Reminder[];
  notes: Note[];
  news: NewsItem[];
  weather: WeatherData | null;
  weatherError: string | null;
  refreshWeather: () => void;
  openModules: InfoModuleId[];
  toggleModule: (id: InfoModuleId, force?: boolean) => void;
  addTask: (text: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  addReminder: (text: string, at: number) => void;
  toggleReminder: (id: string) => void;
  removeReminder: (id: string) => void;
  addNote: (text: string) => void;
  updateNote: (id: string, text: string) => void;
  removeNote: (id: string) => void;
  addEvent: (e: Omit<CalendarEvent, 'id'>) => void;
  importEvents: (e: Omit<CalendarEvent, 'id'>[]) => number;
  removeEvent: (id: string) => void;
}

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [events, setEvents] = usePersistentState('events', seedEvents);
  const [tasks, setTasks] = usePersistentState('tasks', seedTasks);
  const [reminders, setReminders] = usePersistentState('reminders', seedReminders);
  const [notes, setNotes] = usePersistentState('notes', seedNotes);
  const [openModules, setOpenModules] = usePersistentState<InfoModuleId[]>('modules', ['clock', 'weather', 'calendar', 'tasks']);
  const [news] = useState(demoNews);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherNonce, setWeatherNonce] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setWeatherError(null);
    fetchWeather(settings.city, ac.signal)
      .then(setWeather)
      .catch((e) => {
        if (ac.signal.aborted) return;
        setWeatherError(e instanceof Error ? e.message : 'Wetterdienst nicht erreichbar');
        setWeather(demoWeather(settings.city));
      });
    const iv = setInterval(() => setWeatherNonce((n) => n + 1), 15 * 60e3);
    return () => { ac.abort(); clearInterval(iv); };
  }, [settings.city, weatherNonce]);

  const toggleModule = useCallback((id: InfoModuleId, force?: boolean) => {
    setOpenModules((m) => {
      const open = force ?? !m.includes(id);
      return open ? (m.includes(id) ? m : [...m, id]) : m.filter((x) => x !== id);
    });
  }, [setOpenModules]);

  const value = useMemo<Workspace>(() => ({
    events, tasks, reminders, notes, news, weather, weatherError,
    refreshWeather: () => setWeatherNonce((n) => n + 1),
    openModules, toggleModule,
    addTask: (text) => setTasks((t) => [{ id: uid(), text, done: false, createdAt: Date.now() }, ...t]),
    toggleTask: (id) => setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x))),
    removeTask: (id) => setTasks((t) => t.filter((x) => x.id !== id)),
    addReminder: (text, at) => setReminders((r) => [...r, { id: uid(), text, at, done: false }]),
    toggleReminder: (id) => setReminders((r) => r.map((x) => (x.id === id ? { ...x, done: !x.done } : x))),
    removeReminder: (id) => setReminders((r) => r.filter((x) => x.id !== id)),
    addNote: (text) => setNotes((n) => [{ id: uid(), text, updatedAt: Date.now() }, ...n]),
    updateNote: (id, text) => setNotes((n) => n.map((x) => (x.id === id ? { ...x, text, updatedAt: Date.now() } : x))),
    removeNote: (id) => setNotes((n) => n.filter((x) => x.id !== id)),
    addEvent: (e) => setEvents((ev) => [...ev, { ...e, id: uid() }]),
    importEvents: (list) => {
      // de-duplicate on title + start so re-importing the same file is harmless
      const key = (e: Omit<CalendarEvent, 'id'>) => `${e.title}|${e.start}`;
      const existing = new Set(events.map(key));
      const fresh = list.filter((e) => !existing.has(key(e)));
      setEvents((ev) => [...ev, ...fresh.map((e) => ({ ...e, id: uid() }))]);
      return fresh.length;
    },
    removeEvent: (id) => setEvents((ev) => ev.filter((x) => x.id !== id)),
  }), [events, tasks, reminders, notes, news, weather, weatherError, openModules, toggleModule, setTasks, setReminders, setNotes, setEvents]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace outside WorkspaceProvider');
  return ctx;
}
