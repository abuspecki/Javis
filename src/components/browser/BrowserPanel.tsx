import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Download, ExternalLink, Globe, History, Lock, Plus, RotateCw, Search, ShieldAlert, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { currentUrl, NEWTAB, useBrowser } from '../../state/browser';
import { framingReady, host, onFrameNavigate } from '../../services/browser/host';
import { cx, hostOf } from '../../lib/util';
import { Panel } from '../ui/Panel';
import { InternalPage } from './InternalPages';

export function BrowserPanel({ className, onNotify }: { className?: string; onNotify?: (msg: string) => void }) {
  const b = useBrowser();
  const url = currentUrl(b.active);
  const [address, setAddress] = useState(url);
  const [loading, setLoading] = useState(false);
  // In the extension, wait until embedding is unlocked so the first page doesn't hit the block.
  const [framing, setFraming] = useState<boolean | null>(host.kind === 'extension' ? null : false);
  useEffect(() => { framingReady.then(setFraming); }, []);
  const syncFromFrame = b.syncFromFrame;
  useEffect(() => onFrameNavigate(syncFromFrame), [syncFromFrame]);
  const internal = url.startsWith('jarvis://');
  const bookmarked = b.bookmarks.some((x) => x.url === url);
  const secure = url.startsWith('https://');

  useEffect(() => { setAddress(url === NEWTAB ? '' : url); setLoading(!url.startsWith('jarvis://')); }, [url, b.active.nonce, b.active.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) b.navigate(address);
  };

  return (
    <Panel
      title="Browser-Kontrollzentrum"
      icon={Globe}
      className={className}
      bodyClassName="flex flex-col"
      actions={
        <div className="flex gap-1">
          <button className="hud-icon-btn h-7 w-7" onClick={() => b.navigate('jarvis://history')} aria-label="Verlauf" title="Verlauf"><History className="h-3.5 w-3.5" /></button>
          <button className="hud-icon-btn h-7 w-7" onClick={() => b.navigate('jarvis://bookmarks')} aria-label="Lesezeichen" title="Lesezeichen"><Bookmark className="h-3.5 w-3.5" /></button>
          <button className="hud-icon-btn h-7 w-7" onClick={() => b.navigate('jarvis://downloads')} aria-label="Downloads" title="Downloads"><Download className="h-3.5 w-3.5" /></button>
          <button className="hud-icon-btn h-7 w-7" onClick={() => b.openTab(undefined, true)} aria-label="Privaten Tab öffnen" title="Privater Tab"><ShieldAlert className="h-3.5 w-3.5" /></button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex items-end gap-1 overflow-x-auto border-b border-cyan-hud/10 px-2 pt-2" role="tablist" aria-label="Tabs">
        <AnimatePresence initial={false}>
          {b.tabs.map((t) => {
            const on = t.id === b.active.id;
            return (
              <motion.div
                key={t.id} layout initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }}
                className={cx('group flex max-w-[180px] min-w-[96px] shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-2.5 py-1.5 text-xs transition',
                  on ? (t.private ? 'border-warn/40 bg-warn/10 text-ice' : 'border-cyan-hud/30 bg-cyan-hud/10 text-ice') : 'border-transparent text-ice/50 hover:bg-ice/5 hover:text-ice/80')}
              >
                <button role="tab" aria-selected={on} onClick={() => b.selectTab(t.id)} className="flex min-w-0 flex-1 items-center gap-1.5 focus-visible:outline-none">
                  {t.private ? <ShieldAlert className="h-3 w-3 shrink-0 text-warn" /> : <Globe className="h-3 w-3 shrink-0 text-cyan-hud/70" />}
                  <span className="truncate">{t.title}</span>
                </button>
                <button onClick={() => b.closeTab(t.id)} className="rounded p-0.5 opacity-50 hover:bg-ice/10 hover:opacity-100" aria-label={`Tab ${t.title} schließen`}><X className="h-3 w-3" /></button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <button className="mb-1 ml-1 rounded p-1 text-ice/50 hover:bg-cyan-hud/10 hover:text-cyan-hud" onClick={() => b.openTab()} aria-label="Neuer Tab"><Plus className="h-3.5 w-3.5" /></button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button className="hud-icon-btn" onClick={b.back} disabled={b.active.index === 0} aria-label="Zurück"><ArrowLeft className="h-4 w-4" /></button>
        <button className="hud-icon-btn" onClick={b.forward} disabled={b.active.index >= b.active.history.length - 1} aria-label="Vorwärts"><ArrowRight className="h-4 w-4" /></button>
        <button className="hud-icon-btn" onClick={b.reload} aria-label="Neu laden"><RotateCw className={cx('h-4 w-4', loading && 'animate-spin')} /></button>
        <form onSubmit={submit} className="relative flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
            {internal ? <Search className="h-3.5 w-3.5 text-cyan-hud/60" /> : secure ? <Lock className="h-3.5 w-3.5 text-teal-hud/80" /> : <ShieldAlert className="h-3.5 w-3.5 text-warn" />}
          </span>
          <input
            value={address} onChange={(e) => setAddress(e.target.value)} onFocus={(e) => e.target.select()}
            placeholder={b.active.private ? 'Privat suchen oder URL eingeben' : 'Suchen oder URL eingeben'}
            className={cx('hud-input h-8 py-1 pl-8 font-mono text-xs', b.active.private && 'border-warn/30 focus:border-warn/60')}
            aria-label="Adresse oder Suchbegriff" spellCheck={false}
          />
        </form>
        <button
          className={cx('hud-icon-btn', bookmarked && 'text-cyan-hud')} disabled={internal}
          onClick={() => onNotify?.(b.toggleBookmark() ? 'Lesezeichen gespeichert' : 'Lesezeichen entfernt')}
          aria-label={bookmarked ? 'Lesezeichen entfernen' : 'Lesezeichen setzen'} aria-pressed={bookmarked}
        >
          {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
        <button className="hud-icon-btn" disabled={internal} onClick={() => host.openExternal(url, { private: b.active.private })} aria-label="Im echten Browser-Tab öffnen" title="Extern öffnen">
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      {/* Viewport */}
      <div className="relative mx-2 mb-2 min-h-0 flex-1 overflow-hidden rounded-xl border border-cyan-hud/10 bg-void/70">
        {internal ? (
          <InternalPage url={url} />
        ) : (
          <>
            {framing !== null && <iframe
              key={`${b.active.id}-${b.active.frameKey ?? `${b.active.index}-${b.active.nonce}`}`}
              src={url}
              title={b.active.title}
              className="h-full w-full bg-white"
              onLoad={() => setLoading(false)}
              // no allow-top-navigation: pages must not navigate J.A.R.V.I.S. itself away ("frame busting")
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals allow-downloads allow-pointer-lock allow-storage-access-by-user-activation"
              allow="fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              referrerPolicy="no-referrer"
            />}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t border-cyan-hud/15 bg-panel/90 px-3 py-1.5 text-[11px] text-ice/60 backdrop-blur">
              <span className="truncate">
                {framing
                  ? <>Einbetten freigeschaltet. Anmeldung klappt nicht oder Seite bleibt leer? Dann als echten Tab öffnen.</>
                  : <>Leere Seite? <b className="text-ice/80">{hostOf(url)}</b> verbietet das Einbetten. Als Chrome-Erweiterung funktionieren alle Seiten.</>}
              </span>
              <button className="hud-btn shrink-0 py-0.5 text-[11px]" onClick={() => host.openExternal(url, { private: b.active.private })}>
                <ExternalLink className="h-3 w-3" /> {host.kind === 'extension' ? 'Als Chrome-Tab öffnen' : 'Extern öffnen'}
              </button>
            </div>
          </>
        )}
        {b.active.private && (
          <div className="pointer-events-none absolute right-2 top-2 hud-chip border-warn/50 bg-void/80 text-warn">Privat · kein Verlauf</div>
        )}
      </div>
    </Panel>
  );
}
