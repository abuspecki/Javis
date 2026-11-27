import { createContext, useContext, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import type { ProviderId } from '../services/ai';
import type { Routine } from '../types';

export interface Settings {
  userTitle: string;
  /** Used as sender in e-mail drafts. */
  userName: string;
  lang: 'de-DE' | 'en-US' | 'en-GB';
  tts: boolean;
  voiceURI: string;
  speechRate: number;
  wakeWord: boolean;
  provider: ProviderId;
  backendUrl: string;
  /** Only for provider 'direct'. Stored on this device only. */
  apiKey: string;
  model: string;
  city: string;
  searchEngine: 'jarvis' | 'google' | 'duckduckgo' | 'bing';
  scanlines: boolean;
  glitch: boolean;
  reducedMotion: boolean;
  /** Automated browser routines, started by voice („Starte Morgenroutine“). */
  routines: Routine[];
}

export const DEFAULT_SETTINGS: Settings = {
  userTitle: 'Sir',
  userName: 'Tony Stark',
  lang: 'de-DE',
  tts: true,
  voiceURI: '',
  speechRate: 1.02,
  wakeWord: false,
  // Served by the local Mac backend (npm start / "Jarvis starten.command") → use it by default.
  provider: typeof location !== 'undefined' && location.port === '8787' ? 'backend' : 'demo',
  backendUrl: '',
  apiKey: '',
  model: 'claude-opus-5-5',
  city: 'Berlin',
  searchEngine: 'jarvis',
  scanlines: true,
  glitch: true,
  reducedMotion: false,
  routines: [
    { id: 'morning', name: 'Morgenroutine', urls: ['https://www.tagesschau.de', 'https://de.wikipedia.org/wiki/Wikipedia:Hauptseite'], briefing: true },
    { id: 'work', name: 'Arbeitsbeginn', urls: ['https://mail.google.com', 'https://calendar.google.com', 'https://github.com'], briefing: true },
    { id: 'evening', name: 'Feierabend', urls: [], briefing: true },
  ],
};

interface Ctx { settings: Settings; update: (patch: Partial<Settings>) => void; reset: () => void }
const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = usePersistentState<Settings>('settings', DEFAULT_SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...stored }; // forward-compatible with new keys
  const update = (patch: Partial<Settings>) => setStored((s) => ({ ...DEFAULT_SETTINGS, ...s, ...patch }));
  const reset = () => setStored(DEFAULT_SETTINGS);
  return <SettingsContext.Provider value={{ settings, update, reset }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}
