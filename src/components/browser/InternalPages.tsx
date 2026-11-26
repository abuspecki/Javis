import { Bookmark, Clock, Download, ExternalLink, Globe, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useCommands } from '../../state/commands';
import { useEffect, useState } from 'react';

/** Favicon with graceful fallback when the favicon service is unreachable. */
function Favicon({ url, className }: { url: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Globe className={`${className} text-cyan-hud/60`} />;
  return <img src={`https://www.google.com/s2/favicons?domain=${hostOf(url)}&sz=32`} alt="" className={className} loading="lazy" onError={() => setFailed(true)} />;
}
import { useBrowser } from '../../state/browser';
import { host, type DownloadEntry } from '../../services/browser/host';
import { fmtTime, hostOf } from '../../lib/util';

export function InternalPage({ url }: { url: string }) {
  const [page, query] = url.slice(9).split('?');
  const q = new URLSearchParams(query ?? '').get('q') ?? '';
  return (
    <div className="h-full overflow-y-auto p-5">
      {page === 'search' ? <SearchPage q={q} /> :
       page === 'history' ? <HistoryPage /> :
       page === 'bookmarks' ? <BookmarksPage /> :
       page === 'downloads' ? <DownloadsPage /> : <NewTabPage />}
    </div>
  );
}

function NewTabPage() {
  const b = useBrowser();
  const [q, setQ] = useState('');
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 pt-6">
      <div className="text-center">
        <div className="font-display text-2xl font-semibold tracking-[0.3em] text-ice">J.A.R.V.I.S.</div>
        <div className="hud-label mt-1">Secure Browsing Interface</div>
      </div>
      <form className="relative w-full" onSubmit={(e) => { e.preventDefault(); if (q.trim()) b.navigate(q); }}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-hud/60" />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="hud-input h-11 rounded-xl pl-10" placeholder="Wonach suchen Sie?" aria-label="Suche" />
      </form>
      <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4">
        {b.bookmarks.slice(0, 8).map((bm) => (
          <button key={bm.id} onClick={() => b.navigate(bm.url)} className="hud-btn flex-col gap-2 rounded-xl py-3">
            <Favicon url={bm.url} className="h-5 w-5 opacity-80" />
            <span className="w-full truncate text-[11px]">{bm.title}</span>
          </button>
        ))}
      </div>
      {b.history.length > 0 && (
        <div className="w-full">
          <div className="hud-label mb-2">Zuletzt besucht</div>
          {b.history.slice(0, 4).map((h) => (
            <button key={h.id} onClick={() => b.navigate(h.url)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ice/70 hover:bg-cyan-hud/5">
              <Clock className="h-3 w-3 text-cyan-hud/50" /><span className="truncate">{h.title}</span><span className="ml-auto font-mono text-[10px] text-ice/30">{fmtTime(h.time)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface WikiHit { title: string; snippet: string; pageid: number }

/** Built-in search: Wikipedia API (CORS-enabled, embeddable results) + hand-off to full engines. */
function SearchPage({ q }: { q: string }) {
  const b = useBrowser();
  const [hits, setHits] = useState<WikiHit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!q) return;
    const ac = new AbortController();
    setHits(null); setErr(null);
    fetch(`https://de.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=8&srsearch=${encodeURIComponent(q)}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setHits(d.query?.search ?? []))
      .catch((e) => { if (!ac.signal.aborted) setErr(e.message); });
    return () => ac.abort();
  }, [q]);

  const engines = [
    ['Google', `https://www.google.com/search?q=${encodeURIComponent(q)}`],
    ['DuckDuckGo', `https://duckduckgo.com/?q=${encodeURIComponent(q)}`],
    ['YouTube', `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`],
    ['Bing', `https://www.bing.com/search?q=${encodeURIComponent(q)}`],
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="hud-label">Suchergebnisse</div>
      <h3 className="mt-1 font-display text-xl text-ice">„{q}“</h3>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {engines.map(([n, u]) => (
          <button key={n} className="hud-btn rounded-full py-1 text-[11px]" onClick={() => host.openExternal(u)}><ExternalLink className="h-3 w-3" /> {n}</button>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {err && <p className="text-sm text-warn">Wissensdatenbank nicht erreichbar: {err}</p>}
        {!hits && !err && <p className="font-mono text-xs text-cyan-hud/60">Durchsuche Wissensdatenbank …</p>}
        {hits?.length === 0 && <p className="text-sm text-ice/50">Keine Einträge gefunden. Nutzen Sie eine der Suchmaschinen oben.</p>}
        {hits?.map((h) => {
          const u = `https://de.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`;
          return (
            <button key={h.pageid} onClick={() => b.navigate(u)} className="block w-full rounded-xl border border-cyan-hud/10 bg-cyan-hud/[0.03] p-3 text-left transition hover:border-cyan-hud/40 hover:bg-cyan-hud/[0.06]">
              <div className="font-mono text-[10px] text-teal-hud/70">de.wikipedia.org</div>
              <div className="text-sm font-medium text-cyan-hud">{h.title}</div>
              {/* Wikipedia snippets contain only <span class="searchmatch"> markup; strip all tags for safety */}
              <div className="mt-1 line-clamp-2 text-xs text-ice/60">{h.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HistoryPage() {
  const b = useBrowser();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="hud-title flex items-center gap-2"><Clock className="h-4 w-4 text-cyan-hud" /> Verlauf</h3>
        <button className="hud-btn" onClick={b.clearHistory} disabled={!b.history.length}><Trash2 className="h-3 w-3" /> Verlauf löschen</button>
      </div>
      <div className="mt-3 divide-y divide-cyan-hud/5">
        {!b.history.length && <p className="py-6 text-center text-sm text-ice/40">Noch kein Verlauf. Private Tabs werden nie gespeichert.</p>}
        {b.history.map((h) => (
          <button key={h.id} onClick={() => b.navigate(h.url)} className="flex w-full items-center gap-3 px-1 py-2 text-left text-xs hover:bg-cyan-hud/5">
            <span className="w-12 font-mono text-[10px] text-ice/40">{fmtTime(h.time)}</span>
            <Globe className="h-3 w-3 text-cyan-hud/50" />
            <span className="truncate text-ice/80">{h.title}</span>
            <span className="ml-auto truncate font-mono text-[10px] text-ice/30">{h.url.slice(0, 50)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BookmarksPage() {
  const b = useBrowser();
  const { skill } = useCommands();
  const groups = new Map<string, typeof b.bookmarks>();
  for (const bm of b.bookmarks) {
    const c = bm.category ?? 'Unsortiert';
    groups.set(c, [...(groups.get(c) ?? []), bm]);
  }
  const ordered = [...groups.entries()].sort(([a], [z]) => (a === 'Unsortiert' ? 1 : z === 'Unsortiert' ? -1 : a.localeCompare(z, 'de')));
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <h3 className="hud-title flex items-center gap-2"><Bookmark className="h-4 w-4 text-cyan-hud" /> Lesezeichen</h3>
        <button className="hud-btn" onClick={() => skill('bookmarks')} disabled={!b.bookmarks.length} title="Lesezeichen automatisch in Kategorien ordnen">
          <Sparkles className="h-3 w-3" /> Intelligent sortieren
        </button>
      </div>
      {!b.bookmarks.length && <p className="mt-3 text-sm text-ice/40">Keine Lesezeichen. Nutzen Sie den Stern in der Adressleiste.</p>}
      {ordered.map(([cat, list]) => (
        <section key={cat} className="mt-4">
          {(groups.size > 1 || cat !== 'Unsortiert') && <h4 className="hud-label mb-2">{cat} · {list.length}</h4>}
          <div className="grid gap-2 sm:grid-cols-2">
            {list.map((bm) => (
              <div key={bm.id} className="flex items-center gap-2 rounded-xl border border-cyan-hud/10 bg-cyan-hud/[0.03] p-2.5">
                <Favicon url={bm.url} className="h-4 w-4" />
                <button onClick={() => b.navigate(bm.url)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-xs text-ice">{bm.title}</div>
                  <div className="truncate font-mono text-[10px] text-ice/35">{hostOf(bm.url)}</div>
                </button>
                <button onClick={() => b.removeBookmark(bm.id)} className="rounded p-1 text-ice/40 hover:text-crit" aria-label={`${bm.title} entfernen`}><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const DEMO_DOWNLOADS: DownloadEntry[] = [
  { id: 'd1', filename: 'MarkVII_Schaltplan.pdf', url: '', bytes: 4.2e6, state: 'complete', time: Date.now() - 3600e3 },
  { id: 'd2', filename: 'arc_reactor_telemetry.csv', url: '', bytes: 812e3, state: 'complete', time: Date.now() - 7200e3 },
  { id: 'd3', filename: 'firmware_v4.2.bin', url: '', bytes: 18e6, state: 'in_progress', time: Date.now() - 60e3 },
];

function DownloadsPage() {
  const [items, setItems] = useState<DownloadEntry[] | null | undefined>(undefined);
  useEffect(() => { host.listDownloads().then(setItems).catch(() => setItems(null)); }, []);
  const list = items ?? DEMO_DOWNLOADS;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <h3 className="hud-title flex flex-1 items-center gap-2"><Download className="h-4 w-4 text-cyan-hud" /> Downloads</h3>
        {items === null && <span className="hud-chip border-warn/40 text-warn" title="Downloads sind nur als Chrome-Extension verfügbar">Demo</span>}
      </div>
      {items === null && <p className="mt-2 text-xs text-ice/45">Echte Downloads erscheinen hier, wenn J.A.R.V.I.S. als Chrome-Extension läuft.</p>}
      <div className="mt-3 space-y-2">
        {list.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-xl border border-cyan-hud/10 bg-cyan-hud/[0.03] p-3">
            <Download className="h-4 w-4 text-cyan-hud/70" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-ice">{d.filename}</div>
              <div className="font-mono text-[10px] text-ice/40">{(d.bytes / 1e6).toFixed(1)} MB · {fmtTime(d.time)}</div>
            </div>
            <span className={`hud-chip ${d.state === 'complete' ? 'border-teal-hud/40 text-teal-hud' : d.state === 'in_progress' ? 'border-cyan-hud/40 text-cyan-hud' : 'border-crit/40 text-crit'}`}>
              {d.state === 'complete' ? 'Fertig' : d.state === 'in_progress' ? 'Lädt' : 'Fehler'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
