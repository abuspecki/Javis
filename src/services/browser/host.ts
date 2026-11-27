/**
 * Host integration layer. The UI talks only to `HostAdapter`; the concrete
 * implementation depends on where the app runs:
 *   • WebHost       – plain web page (dev server / hosted). Uses window.open etc.
 *   • ExtensionHost – Chrome Extension (MV3). Uses chrome.tabs / downloads / system.*
 * An Electron/Tauri host can be added later by implementing the same interface.
 */

export interface DownloadEntry { id: string; filename: string; url: string; bytes: number; state: 'complete' | 'in_progress' | 'interrupted'; time: number }
export interface HostCpu { usage: number; cores: number; model?: string }
export interface HostMemory { usedRatio: number; totalBytes: number }

export interface HostAdapter {
  readonly kind: 'web' | 'extension';
  openExternal(url: string, opts?: { private?: boolean }): Promise<void>;
  listDownloads(): Promise<DownloadEntry[] | null>; // null = unavailable in this host
  readCpu(): Promise<HostCpu | null>;
  readMemory(): Promise<HostMemory | null>;
  countRealTabs(): Promise<number | null>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const chromeApi: any = (globalThis as any).chrome;
export const isExtension = !!chromeApi?.runtime?.id && !!chromeApi?.tabs;

class WebHost implements HostAdapter {
  readonly kind = 'web' as const;
  async openExternal(url: string) { window.open(url, '_blank', 'noopener,noreferrer'); }
  async listDownloads() { return null; }
  async readCpu() { return null; }
  async readMemory() { return null; }
  async countRealTabs() { return null; }
}

class ExtensionHost implements HostAdapter {
  readonly kind = 'extension' as const;
  private lastCpu: { total: number; idle: number }[] | null = null;

  async openExternal(url: string, opts?: { private?: boolean }) {
    if (opts?.private && chromeApi.windows?.create) {
      try { await chromeApi.windows.create({ url, incognito: true }); return; } catch { /* incognito not allowed → fall through */ }
    }
    await chromeApi.tabs.create({ url });
  }

  async listDownloads(): Promise<DownloadEntry[] | null> {
    if (!chromeApi.downloads?.search) return null;
    const items: any[] = await chromeApi.downloads.search({ limit: 20, orderBy: ['-startTime'] });
    return items.map((d) => ({
      id: String(d.id), filename: (d.filename as string).split(/[\\/]/).pop() ?? d.filename, url: d.url,
      bytes: d.totalBytes ?? 0, state: d.state, time: Date.parse(d.startTime),
    }));
  }

  async readCpu(): Promise<HostCpu | null> {
    if (!chromeApi.system?.cpu) return null;
    const info: any = await chromeApi.system.cpu.getInfo();
    const now = info.processors.map((p: any) => ({ total: p.usage.total, idle: p.usage.idle }));
    let usage = 0;
    if (this.lastCpu) {
      let busy = 0, total = 0;
      now.forEach((c: any, i: number) => {
        const prev = this.lastCpu![i];
        const dt = c.total - prev.total;
        total += dt; busy += dt - (c.idle - prev.idle);
      });
      usage = total > 0 ? busy / total : 0;
    }
    this.lastCpu = now;
    return { usage, cores: info.numOfProcessors, model: info.modelName };
  }

  async readMemory(): Promise<HostMemory | null> {
    if (!chromeApi.system?.memory) return null;
    const m: any = await chromeApi.system.memory.getInfo();
    return { usedRatio: 1 - m.availableCapacity / m.capacity, totalBytes: m.capacity };
  }

  async countRealTabs() {
    const tabs: any[] = await chromeApi.tabs.query({});
    return tabs.length;
  }
}

export const host: HostAdapter = isExtension ? new ExtensionHost() : new WebHost();

/**
 * As an extension, the background worker removes the "don't embed me" headers for frames inside
 * this tab — so every website can be shown in the browser panel. Resolves once the rule is active
 * (or immediately outside the extension, where embedding stays restricted by the browser).
 */
export const framingReady: Promise<boolean> = isExtension
  ? new Promise((resolve) => {
      try {
        chromeApi.runtime.sendMessage({ type: 'jarvis:allow-framing' }, (res: { ok?: boolean } | undefined) => {
          void chromeApi.runtime.lastError; // swallow "no receiver" if the worker restarted
          resolve(!!res?.ok);
        });
        setTimeout(() => resolve(false), 1500);
      } catch { resolve(false); }
    })
  : Promise.resolve(false);

/**
 * Extension only: the background worker reports when the page embedded in this J.A.R.V.I.S. tab
 * navigates by itself (e.g. a link click), so the address bar and history stay correct.
 * Returns an unsubscribe function.
 */
export function onFrameNavigate(cb: (url: string) => void): () => void {
  if (!isExtension) return () => undefined;
  let myTabId: number | undefined;
  chromeApi.tabs.getCurrent((t: { id?: number } | undefined) => { myTabId = t?.id; });
  const listener = (msg: { type?: string; tabId?: number; url?: string }) => {
    if (msg?.type === 'jarvis:frame-url' && msg.tabId === myTabId && typeof msg.url === 'string') cb(msg.url);
  };
  chromeApi.runtime.onMessage.addListener(listener);
  return () => chromeApi.runtime.onMessage.removeListener(listener);
}
