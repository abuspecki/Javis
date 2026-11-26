// Thin, typed wrapper around the (prefixed) Web Speech API.

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;

export const speechRecognitionSupported = () =>
  typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export interface RecognizerHandlers {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd?: () => void;
  onError?: (code: string) => void;
}

export class Recognizer {
  private rec: SR | null = null;
  private continuous: boolean;
  private lang: string;
  constructor(lang = 'de-DE', continuous = false) {
    this.lang = lang;
    this.continuous = continuous;
  }

  start(h: RecognizerHandlers) {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) { h.onError?.('not-supported'); return; }
    this.stop();
    const rec: SR = new Ctor();
    rec.lang = this.lang;
    rec.interimResults = true;
    rec.continuous = this.continuous;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) h.onFinal(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      if (interim) h.onInterim?.(interim);
    };
    rec.onerror = (e: any) => h.onError?.(e.error ?? 'unknown');
    rec.onend = () => { this.rec = null; h.onEnd?.(); };
    this.rec = rec;
    try { rec.start(); } catch { h.onError?.('start-failed'); }
  }

  stop() {
    if (this.rec) {
      try { this.rec.abort(); } catch { /* already stopped */ }
      this.rec = null;
    }
  }

  get active() { return !!this.rec; }
}
