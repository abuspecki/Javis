import { createContext, useContext, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import type { ProviderId } from '../services/ai';

export interface Settings {
  userTitle: string;
  lang: 'de-DE' | 'en-US' | 'en-GB';
  tts: boolean;
  voiceURI: string;
  speechRate: number;
  wakeWord: boolean;
  provider: ProviderId;
  backendUrl: string;
  city: string;
  searchEngine: 'jarvis' | 'google' | 'duckduckgo' | 'bing';
  scanlines: boolean;
  glitch: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  userTitle: 'Sir',
  lang: 'de-DE',
  tts: true,
  voiceURI: '',
  speechRate: 1.02,
  wakeWord: false,
  provider: 'demo',
  backendUrl: '',
  city: 'Berlin',
  searchEngine: 'jarvis',
  scanlines: true,
  glitch: true,
  reducedMotion: false,
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
