import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { hostOf, toUrl, uid } from '../lib/util';
import { useSettings } from './settings';

export interface Tab {
  id: string;
  private: boolean;
  history: string[];
  index: number;
  title: string;
  /** bumps to force iframe reload */
  nonce: number;
}
export interface Bookmark { id: string; url: string; title: string }
export interface HistoryEntry { id: string; url: string; title: string; time: number }

export const NEWTAB = 'jarvis://newtab';

export const currentUrl = (t: Tab) => t.history[t.index] ?? NEWTAB;

export function titleFor(url: string) {
  if (url.startsWith('jarvis://')) {
    const page = url.slice(9).split('?')[0];
    if (page === 'search') {
      try { return `Suche: ${new URLSearchParams(url.split('?')[1]).get('q') ?? ''}`; } catch { return 'Suche'; }
    }
    return ({ newtab: 'Neuer Tab', history: 'Verlauf', bookmarks: 'Lesezeichen', downloads: 'Downloads' } as Record<string, string>)[page] ?? page;
  }
  return hostOf(url);
}

const newTab = (url = NEWTAB, priv = false): Tab => ({ id: uid(), private: priv, history: [url], index: 0, title: titleFor(url), nonce: 0 });

interface BrowserState { tabs: Tab[]; activeId: string }

interface BrowserApi {
  tabs: Tab[];
  active: Tab;
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  navigate: (input: string, opts?: { newTab?: boolean }) => void;
  search: (query: string, opts?: { newTab?: boolean }) => void;
  openTab: (url?: string, priv?: boolean) => void;
  closeTab: (id?: string) => void;
  selectTab: (id: string) => void;
  back: () => void;
  forward: () => void;
  reload: () => void;
  toggleBookmark: () => boolean;
  removeBookmark: (id: string) => void;
  clearHistory: () => void;
  searchUrl: (q: string) => string;
}

const BrowserContext = createContext<BrowserApi | null>(null);

export function BrowserProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [state, setState] = usePersistentState<BrowserState>('browser', () => {
    const t = newTab();
    return { tabs: [t], activeId: t.id };
  });
  const [bookmarks, setBookmarks] = usePersistentState<Bookmark[]>('bookmarks', [
    { id: uid(), url: 'https://de.wikipedia.org/wiki/K%C3%BCnstliche_Intelligenz', title: 'Künstliche Intelligenz' },
    { id: uid(), url: 'https://www.openstreetmap.org', title: 'OpenStreetMap' },
    { id: uid(), url: 'https://www.youtube.com', title: 'YouTube' },
  ]);
  const [history, setHistory] = usePersistentState<HistoryEntry[]>('history', []);

  const active = state.tabs.find((t) => t.id === state.activeId) ?? state.tabs[0];

  const searchUrl = useCallback((q: string) => {
    const e = encodeURIComponent(q);
    switch (settings.searchEngine) {
      case 'google': return `https://www.google.com/search?q=${e}`;
      case 'duckduckgo': return `https://duckduckgo.com/?q=${e}`;
      case 'bing': return `https://www.bing.com/search?q=${e}`;
      default: return `jarvis://search?q=${e}`;
    }
  }, [settings.searchEngine]);

  const record = useCallback((url: string, priv: boolean) => {
    if (priv || url === NEWTAB) return;
    setHistory((h) => [{ id: uid(), url, title: titleFor(url), time: Date.now() }, ...h].slice(0, 300));
  }, [setHistory]);

  const go = useCallback((url: string, inNewTab = false) => {
    setState((s) => {
      const cur = s.tabs.find((t) => t.id === s.activeId) ?? s.tabs[0];
      record(url, inNewTab ? false : cur.private);
      if (inNewTab) {
        const t = newTab(url);
        return { tabs: [...s.tabs, t], activeId: t.id };
      }
      const tabs = s.tabs.map((t) => t.id !== cur.id ? t : {
        ...t, history: [...t.history.slice(0, t.index + 1), url], index: t.index + 1, title: titleFor(url),
      });
      return { ...s, tabs };
    });
  }, [setState, record]);

  const api = useMemo<BrowserApi>(() => ({
    tabs: state.tabs,
    active,
    bookmarks,
    history,
    searchUrl,
    navigate: (input, opts) => go(toUrl(input) ?? searchUrl(input), opts?.newTab),
    search: (q, opts) => go(searchUrl(q), opts?.newTab),
    openTab: (url, priv = false) => setState((s) => {
      const t = newTab(url ?? NEWTAB, priv);
      if (url) record(url, priv);
      return { tabs: [...s.tabs, t], activeId: t.id };
    }),
    closeTab: (id) => setState((s) => {
      const target = id ?? s.activeId;
      const idx = s.tabs.findIndex((t) => t.id === target);
      const tabs = s.tabs.filter((t) => t.id !== target);
      if (!tabs.length) { const t = newTab(); return { tabs: [t], activeId: t.id }; }
      const activeId = target === s.activeId ? tabs[Math.max(0, idx - 1)].id : s.activeId;
      return { tabs, activeId };
    }),
    selectTab: (id) => setState((s) => ({ ...s, activeId: id })),
    back: () => setState((s) => ({ ...s, tabs: s.tabs.map((t) => t.id === s.activeId && t.index > 0 ? { ...t, index: t.index - 1, title: titleFor(t.history[t.index - 1]) } : t) })),
    forward: () => setState((s) => ({ ...s, tabs: s.tabs.map((t) => t.id === s.activeId && t.index < t.history.length - 1 ? { ...t, index: t.index + 1, title: titleFor(t.history[t.index + 1]) } : t) })),
    reload: () => setState((s) => ({ ...s, tabs: s.tabs.map((t) => t.id === s.activeId ? { ...t, nonce: t.nonce + 1 } : t) })),
    toggleBookmark: () => {
      const url = currentUrl(active);
      const existing = bookmarks.find((b) => b.url === url);
      if (existing) { setBookmarks((b) => b.filter((x) => x.id !== existing.id)); return false; }
      setBookmarks((b) => [...b, { id: uid(), url, title: active.title }]);
      return true;
    },
    removeBookmark: (id) => setBookmarks((b) => b.filter((x) => x.id !== id)),
    clearHistory: () => setHistory([]),
  }), [state.tabs, active, bookmarks, history, searchUrl, go, setState, record, setBookmarks, setHistory]);

  return <BrowserContext.Provider value={api}>{children}</BrowserContext.Provider>;
}

export function useBrowser() {
  const ctx = useContext(BrowserContext);
  if (!ctx) throw new Error('useBrowser outside BrowserProvider');
  return ctx;
}
