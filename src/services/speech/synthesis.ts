export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function listVoices(): SpeechSynthesisVoice[] {
  return ttsSupported() ? window.speechSynthesis.getVoices() : [];
}

/** Prefer a calm, male-sounding voice in the requested language if present. */
export function pickVoice(lang: string, preferredURI?: string) {
  const voices = listVoices();
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI);
    if (v) return v;
  }
  const inLang = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  return (
    inLang.find((v) => /(daniel|google uk english male|markus|stefan|male|conrad|killian)/i.test(v.name)) ??
    inLang.find((v) => v.localService) ?? inLang[0] ?? voices[0]
  );
}

export interface SpeakOptions {
  lang: string;
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  /** Fires on each word boundary — used to drive the speaking waveform. */
  onBoundary?: () => void;
  onEnd?: () => void;
}

export function speak(text: string, o: SpeakOptions) {
  if (!ttsSupported() || !text.trim()) { o.onEnd?.(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = o.lang;
  const v = pickVoice(o.lang, o.voiceURI);
  if (v) u.voice = v;
  u.rate = o.rate ?? 1.02;
  u.pitch = o.pitch ?? 0.9;
  u.onstart = () => o.onStart?.();
  u.onboundary = () => o.onBoundary?.();
  u.onend = () => o.onEnd?.();
  u.onerror = () => o.onEnd?.();
  synth.speak(u);
}

export const stopSpeaking = () => { if (ttsSupported()) window.speechSynthesis.cancel(); };

/**
 * iOS/iPadOS only lets speech start from a user gesture. Speaking a silent utterance on the
 * first tap "unlocks" the synthesizer so later answers (after async AI calls) are audible.
 */
export function unlockSpeechOnFirstGesture() {
  if (!ttsSupported()) return;
  const unlock = () => {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}
