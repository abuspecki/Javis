export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export const fmtTime = (t: number, locale = 'de-DE', seconds = false) =>
  new Date(t).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) });

export const fmtDate = (t: number, locale = 'de-DE') =>
  new Date(t).toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'GOOD EVENING';
  if (h < 12) return 'GOOD MORNING';
  if (h < 18) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

export function germanGreeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'Guten Morgen';
  if (h >= 11 && h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function isSameDay(a: number, b: number) {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** Turn user input into a navigable URL, or null if it looks like a search query. */
export function toUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^jarvis:\/\//i.test(s)) return s.toLowerCase();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(s)) return 'http://' + s;
  if (!/\s/.test(s) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s)) return 'https://' + s;
  return null;
}

export function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
