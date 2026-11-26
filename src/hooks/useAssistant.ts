import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, CoreState, JarvisAction, JarvisContext } from '../types';
import { createProvider } from '../services/ai';
import { parseIntent, stripWakeWord } from '../services/commands/intentParser';
import { Recognizer, speechRecognitionSupported } from '../services/speech/recognition';
import { speak, stopSpeaking } from '../services/speech/synthesis';
import { useSettings } from '../state/settings';
import { usePersistentState } from './usePersistentState';
import { useAudioLevel } from './useAudioLevel';
import { germanGreeting, uid } from '../lib/util';
import type { SkillResult } from '../services/skills';

const MIC_ERRORS: Record<string, string> = {
  'not-allowed': 'Mikrofonzugriff wurde verweigert. Bitte erlauben Sie den Zugriff in den Browser-Einstellungen.',
  'service-not-allowed': 'Spracherkennung ist in diesem Kontext nicht erlaubt.',
  'audio-capture': 'Kein Mikrofon gefunden.',
  network: 'Spracherkennung benötigt eine Internetverbindung.',
  'not-supported': 'Dieser Browser unterstützt keine Spracherkennung. Bitte Chrome, Edge oder Safari verwenden — auf dem iPad ggf. die Diktierfunktion der Tastatur (Mikrofon-Taste).',
};

const welcome = (title: string): ChatMessage => ({
  id: uid(), role: 'assistant', timestamp: Date.now(), source: 'system',
  content: `${germanGreeting()}, ${title}. J.A.R.V.I.S. ist online. Sagen Sie „Hey Jarvis“ oder schreiben Sie mir — zum Beispiel „Was steht heute an?“ oder „Öffne YouTube“.`,
});

export function useAssistant(opts: { execute: (a: JarvisAction[]) => void; getContext: () => JarvisContext }) {
  const { settings } = useSettings();
  const [messages, setMessages] = usePersistentState<ChatMessage[]>('chat', () => [welcome(settings.userTitle)]);
  const [state, setState] = useState<CoreState>('idle');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const audio = useAudioLevel();
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<Recognizer | null>(null);
  const wakeRef = useRef<Recognizer | null>(null);
  const speakingRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const provider = useMemo(
    () => createProvider({ provider: settings.provider, backendUrl: settings.backendUrl, apiKey: settings.apiKey, model: settings.model }),
    [settings.provider, settings.backendUrl, settings.apiKey, settings.model],
  );

  const push = useCallback((m: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [...prev, { ...m, id: uid(), timestamp: Date.now() }].slice(-200));
  }, [setMessages]);

  const flashError = useCallback((msg: string) => {
    setLastError(msg);
    setState('error');
    setTimeout(() => setState((s) => (s === 'error' ? 'idle' : s)), 2600);
  }, []);

  const say = useCallback((text: string) => {
    if (!settings.tts || !text) { setState('idle'); return; }
    speakingRef.current = true;
    wakeRef.current?.stop(); // don't let JARVIS hear himself
    speak(text, {
      lang: settings.lang, voiceURI: settings.voiceURI || undefined, rate: settings.speechRate,
      onStart: () => setState('speaking'),
      onBoundary: () => audio.kick(0.8),
      onEnd: () => { speakingRef.current = false; setState((s) => (s === 'speaking' || s === 'thinking' ? 'idle' : s)); },
    });
  }, [settings.tts, settings.lang, settings.voiceURI, settings.speechRate, audio]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setLastError(null);
    stopSpeaking();
    push({ role: 'user', content: text });

    const intent = parseIntent(text, settings.userTitle);
    if (intent) {
      if (intent.actions.some((a) => a.type === 'clearChat')) {
        setMessages([welcome(settings.userTitle)]);
        say('Gesprächsverlauf gelöscht.');
        return;
      }
      optsRef.current.execute(intent.actions);
      if (!intent.passthrough) {
        // Skills/routines report back themselves; plain commands confirm here.
        if (intent.reply) {
          push({ role: 'assistant', content: intent.reply, source: 'command' });
          say(intent.reply);
        }
        return;
      }
    }

    // Weather is answered locally from live data — fast and always grounded.
    const ctx = optsRef.current.getContext();
    if (/(wetter|weather)/i.test(text) && ctx.weather) {
      const w = ctx.weather;
      const reply = `In ${w.city} sind es aktuell ${w.temperature} Grad, gefühlt ${w.apparent}. ${w.description}, Wind ${w.wind} km/h.` +
        (w.forecast[0] ? ` Morgen zwischen ${w.forecast[0].min} und ${w.forecast[0].max} Grad.` : '') + (w.demo ? ' (Demo-Daten — Wetterdienst nicht erreichbar.)' : '');
      push({ role: 'assistant', content: reply, source: 'weather' });
      say(reply);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState('thinking');
    try {
      const history = [...messages.filter((m) => m.role !== 'system' && !m.error), { role: 'user' as const, content: stripWakeWord(text)[0] || text }].slice(-20).map(({ role, content }) => ({ role, content }));
      const res = await provider.chat({ messages: history, context: ctx, signal: ac.signal });
      if (res.actions?.length) optsRef.current.execute(res.actions);
      push({ role: 'assistant', content: res.text, source: res.provider });
      say(res.text);
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setState('idle'); return; }
      const reason = (e as Error).message.replace(/[.\s]+$/, '');
      const msg = `Verbindung zum KI-Kern fehlgeschlagen: ${reason}. Befehle wie „Öffne …“ oder „Starte Morgenroutine“ funktionieren weiterhin.`;
      push({ role: 'assistant', content: msg, source: provider.id, error: true });
      flashError(msg);
    }
  }, [messages, provider, push, say, settings.userTitle, setMessages, flashError]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    stopSpeaking();
    speakingRef.current = false;
    setState('idle');
  }, []);

  // ── Push-to-talk ──
  const stopListening = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    audio.releaseMic();
    setListening(false);
    setInterim('');
    setState((s) => (s === 'listening' ? 'idle' : s));
  }, [audio]);

  const startListening = useCallback(() => {
    if (!speechRecognitionSupported()) { flashError(MIC_ERRORS['not-supported']); return; }
    cancel();
    wakeRef.current?.stop();
    const rec = new Recognizer(settings.lang, false);
    recRef.current = rec;
    setListening(true);
    setState('listening');
    audio.startMic();
    let got = false;
    rec.start({
      onInterim: setInterim,
      onFinal: (t) => { got = true; stopListening(); send(t); },
      onError: (code) => { if (code !== 'aborted' && code !== 'no-speech') flashError(MIC_ERRORS[code] ?? `Spracherkennung: ${code}`); },
      onEnd: () => { if (!got) stopListening(); },
    });
  }, [settings.lang, audio, cancel, send, stopListening, flashError]);

  const toggleListening = useCallback(() => (listening ? stopListening() : startListening()), [listening, startListening, stopListening]);

  // ── Wake word ("Hey Jarvis") — continuous low-priority recogniser ──
  const sendRef = useRef(send);
  sendRef.current = send;
  const startRef = useRef(startListening);
  startRef.current = startListening;
  useEffect(() => {
    if (!settings.wakeWord || listening || !speechRecognitionSupported()) return;
    let stopped = false;
    const rec = new Recognizer(settings.lang, true);
    wakeRef.current = rec;
    const run = () => {
      if (stopped || speakingRef.current) { if (!stopped) setTimeout(run, 800); return; }
      rec.start({
        onFinal: (t) => {
          const [rest, woke] = stripWakeWord(t);
          if (!woke && !/jarvis/i.test(t)) return;
          if (rest) sendRef.current(t);
          else { stopped = true; rec.stop(); startRef.current(); }
        },
        onError: (code) => { if (code === 'not-allowed') stopped = true; },
        onEnd: () => { if (!stopped) setTimeout(run, 400); }, // Chrome ends sessions periodically
      });
    };
    run();
    return () => { stopped = true; rec.stop(); wakeRef.current = null; };
  }, [settings.wakeWord, settings.lang, listening]);

  /** Speak + log a message that JARVIS initiates himself (routines, reminders). */
  const announce = useCallback((text: string, source = 'jarvis') => {
    push({ role: 'assistant', content: text, source });
    say(text);
  }, [push, say]);

  /**
   * Runs an AI skill with the same UX as a chat turn: thinking state, cancellable,
   * result (with sources / structured data) logged and the first sentences spoken.
   */
  const runSkill = useCallback(async (label: string, skill: string, fn: (signal: AbortSignal) => Promise<SkillResult>, opts?: { logUser?: boolean }) => {
    if (opts?.logUser) push({ role: 'user', content: label });
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    stopSpeaking();
    setLastError(null);
    setState('thinking');
    try {
      const r = await fn(ac.signal);
      const meta = r.data?.kind === 'email' ? r.data : undefined;
      push({ role: 'assistant', content: r.text, source: `skill:${skill}`, sources: r.sources?.slice(0, 8), meta });
      const spoken = r.text.replace(/•/g, '').split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').slice(0, 260);
      say(r.text.length > spoken.length + 20 ? `${spoken} Die Details stehen im Chat.` : spoken);
      return r;
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setState('idle'); return null; }
      const msg = `${label} fehlgeschlagen: ${(e as Error).message.replace(/[.\s]+$/, '')}.`;
      push({ role: 'assistant', content: msg, source: `skill:${skill}`, error: true });
      flashError(msg);
      return null;
    }
  }, [push, say, flashError]);

  const clear = useCallback(() => { cancel(); setMessages([welcome(settings.userTitle)]); }, [cancel, setMessages, settings.userTitle]);
  const removeMessage = useCallback((id: string) => setMessages((m) => m.filter((x) => x.id !== id)), [setMessages]);

  return {
    messages, state, interim, listening, lastError, provider,
    level: audio.level, spectrum: audio.spectrum,
    send, cancel, clear, removeMessage, toggleListening, startListening, stopListening, say, announce, runSkill,
  };
}

export type Assistant = ReturnType<typeof useAssistant>;
