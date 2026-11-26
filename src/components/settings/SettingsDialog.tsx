import { motion } from 'framer-motion';
import { Bot, Eye, Globe, MapPin, Mic, RotateCcw, User, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../../state/settings';
import { useBrowser } from '../../state/browser';
import { listVoices, speak, ttsSupported } from '../../services/speech/synthesis';
import { speechRecognitionSupported } from '../../services/speech/recognition';
import { BackendProvider } from '../../services/ai/providers/backendProvider';
import { Toggle } from '../ui/Panel';

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-cyan-hud/10 bg-void/30 p-4">
      <legend className="hud-label flex items-center gap-1.5 px-1"><Icon className="h-3 w-3" /> {title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block py-1.5">
      <span className="mb-1 block text-xs text-ice/70">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ice/40">{hint}</span>}
    </label>
  );
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings: s, update, reset } = useSettings();
  const browser = useBrowser();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(listVoices);
  const [testState, setTestState] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => update({ [k]: v } as Partial<Settings>);

  useEffect(() => {
    if (!ttsSupported()) return;
    const h = () => setVoices(listVoices());
    window.speechSynthesis.addEventListener('voiceschanged', h);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', h);
  }, []);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('input,select,button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);

  const testBackend = async () => {
    setTestState('Verbinde …');
    try {
      const res = await new BackendProvider(s.backendUrl).chat({
        messages: [{ role: 'user', content: 'Statusbericht in einem Satz.' }],
        context: { now: Date.now(), locale: s.lang, userTitle: s.userTitle, events: [], tasks: [], reminders: [], weather: null },
      });
      setTestState(`✓ ${res.provider}: ${res.text.slice(0, 90)}`);
    } catch (e) {
      setTestState(`✗ ${(e as Error).message}`);
    }
  };

  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(s.lang.slice(0, 2)));

  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="settings-title"
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="glass flex max-h-[88vh] w-full max-w-3xl flex-col bg-panel/95">
        <header className="flex items-center gap-3 border-b border-cyan-hud/10 px-5 py-3">
          <h2 id="settings-title" className="hud-title flex-1">Systemkonfiguration</h2>
          <button className="hud-btn" onClick={() => { if (confirm('Alle Einstellungen zurücksetzen?')) reset(); }}><RotateCcw className="h-3 w-3" /> Standard</button>
          <button className="hud-icon-btn" onClick={onClose} aria-label="Schließen"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <Section title="Persona" icon={User}>
            <Field label="Anrede"><input className="hud-input" value={s.userTitle} onChange={(e) => set('userTitle')(e.target.value || DEFAULT_SETTINGS.userTitle)} /></Field>
            <Field label="Standort für Wetter"><input className="hud-input" value={s.city} onChange={(e) => set('city')(e.target.value)} onBlur={(e) => !e.target.value && set('city')('Berlin')} /></Field>
          </Section>

          <Section title="Künstliche Intelligenz" icon={Bot}>
            <Field label="KI-Anbieter">
              <select className="hud-input" value={s.provider} onChange={(e) => set('provider')(e.target.value as Settings['provider'])}>
                <option value="demo">Lokale Persona (offline, ohne API)</option>
                <option value="backend">Backend-Server (Claude oder eigenes Modell)</option>
              </select>
            </Field>
            {s.provider === 'backend' && (
              <>
                <Field label="Backend-URL" hint="Leer = gleicher Host (Dev-Proxy auf :8787). API-Schlüssel bleiben immer im Backend.">
                  <input className="hud-input font-mono text-xs" placeholder="http://localhost:8787" value={s.backendUrl} onChange={(e) => set('backendUrl')(e.target.value)} />
                </Field>
                <button className="hud-btn mt-1" onClick={testBackend}>Verbindung testen</button>
                {testState && <p className="mt-2 break-words font-mono text-[11px] text-ice/60">{testState}</p>}
              </>
            )}
          </Section>

          <Section title="Sprache & Stimme" icon={Mic}>
            <Field label="Sprache">
              <select className="hud-input" value={s.lang} onChange={(e) => update({ lang: e.target.value as Settings['lang'], voiceURI: '' })}>
                <option value="de-DE">Deutsch</option><option value="en-GB">English (UK)</option><option value="en-US">English (US)</option>
              </select>
            </Field>
            <Toggle checked={s.tts} onChange={set('tts')} label="Antworten vorlesen" description={ttsSupported() ? 'Text-to-Speech' : 'Vom Browser nicht unterstützt'} />
            <Toggle checked={s.wakeWord} onChange={set('wakeWord')} label="„Hey Jarvis“ Aktivierung" description={speechRecognitionSupported() ? 'Hört dauerhaft auf das Aktivierungswort' : 'Spracherkennung nicht verfügbar'} />
            <Field label="Stimme">
              <select className="hud-input" value={s.voiceURI} onChange={(e) => set('voiceURI')(e.target.value)}>
                <option value="">Automatisch</option>
                {langVoices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
              </select>
            </Field>
            <Field label={`Sprechtempo · ${s.speechRate.toFixed(2)}×`}>
              <input type="range" min={0.7} max={1.4} step={0.02} value={s.speechRate} onChange={(e) => set('speechRate')(Number(e.target.value))} className="w-full accent-[#00D9FF]" />
            </Field>
            <button className="hud-btn mt-1" onClick={() => speak(`Stimmtest erfolgreich, ${s.userTitle}.`, { lang: s.lang, voiceURI: s.voiceURI || undefined, rate: s.speechRate })}>Stimme testen</button>
          </Section>

          <Section title="Browser" icon={Globe}>
            <Field label="Suchmaschine" hint="„J.A.R.V.I.S.“ zeigt eingebettete Ergebnisse; externe Suchmaschinen blockieren oft das Einbetten.">
              <select className="hud-input" value={s.searchEngine} onChange={(e) => set('searchEngine')(e.target.value as Settings['searchEngine'])}>
                <option value="jarvis">J.A.R.V.I.S. (Wissensdatenbank)</option><option value="google">Google</option><option value="duckduckgo">DuckDuckGo</option><option value="bing">Bing</option>
              </select>
            </Field>
            <button className="hud-btn mt-1" onClick={browser.clearHistory}>Verlauf löschen ({browser.history.length})</button>
          </Section>

          <Section title="Darstellung" icon={Eye}>
            <Toggle checked={s.scanlines} onChange={set('scanlines')} label="Scanlines" />
            <Toggle checked={s.glitch} onChange={set('glitch')} label="Glitch-Effekte" description="Sehr dezent, gelegentlich" />
            <Toggle checked={s.reducedMotion} onChange={set('reducedMotion')} label="Bewegung reduzieren" description="Für Barrierefreiheit & schwache Hardware" />
          </Section>

          <Section title="Daten" icon={MapPin}>
            <p className="text-xs text-ice/50">Alle Daten (Termine, Aufgaben, Notizen, Chat) werden lokal im Browser gespeichert.</p>
            <button className="hud-btn mt-3 border-crit/40 text-crit" onClick={() => {
              if (!confirm('Alle lokalen J.A.R.V.I.S.-Daten löschen und neu laden?')) return;
              Object.keys(localStorage).filter((k) => k.startsWith('jarvis.')).forEach((k) => localStorage.removeItem(k));
              location.reload();
            }}>Alle lokalen Daten löschen</button>
          </Section>
        </div>
        <footer className="border-t border-cyan-hud/10 px-5 py-2 font-mono text-[10px] text-ice/35">
          Tastenkürzel: <b>/</b> Eingabe · <b>Strg+Leertaste</b> Mikrofon · <b>Alt+1/2/3</b> Ansichten · <b>Strg+,</b> Einstellungen · <b>Esc</b> Abbrechen
        </footer>
      </motion.div>
    </motion.div>
  );
}
