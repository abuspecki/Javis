/**
 * Offline implementations of the skills. They are deliberately simple but real:
 * extractive summaries, text statistics, Wikipedia lookups, heuristic categories.
 * The backend versions (Claude) replace them as soon as an AI backend is configured.
 */
import type { SkillResult } from './index';

const STOP = new Set(('der die das und oder aber nicht ein eine einer eines einem einen ist sind war waren wird werden hat haben mit von zu zum zur im in am an auf für bei aus als auch es sie er wir ihr ich du sich so wie was wenn dass daß noch nur schon sehr mehr über unter nach vor durch um bis kann können man dem den des diese dieser dieses jedoch sowie the a an and or of to in on for with is are was were be been by as at it this that from which not but its their have has had will would can could than then they them these those also into more most such only other about over').split(' '));

export const words = (t: string) => t.toLowerCase().match(/[\p{L}][\p{L}\p{N}'-]{2,}/gu) ?? [];

export function keywords(text: string, n = 8) {
  const freq = new Map<string, number>();
  for (const w of words(text)) if (!STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

/** Classic frequency-based extractive summary: score sentences, keep the best in original order. */
export function extractiveSummary(text: string, count = 5) {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]{25,400}[.!?]/g) ?? [];
  if (sentences.length <= count) return sentences.map((s) => s.trim());
  const freq = new Map<string, number>();
  for (const w of words(text)) if (!STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const scored = sentences.map((s, i) => {
    const ws = words(s).filter((w) => !STOP.has(w));
    const score = ws.reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.max(4, ws.length) + (i < 3 ? 0.6 : 0);
    return { s: s.trim(), i, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, count).sort((a, b) => a.i - b.i).map((x) => x.s);
}

export function guessLanguage(text: string) {
  const w = words(text.slice(0, 4000));
  const de = w.filter((x) => ['der', 'die', 'und', 'ist', 'nicht', 'mit', 'auch', 'sich'].includes(x)).length;
  const en = w.filter((x) => ['the', 'and', 'is', 'not', 'with', 'also', 'are', 'this'].includes(x)).length;
  return de > en ? 'Deutsch' : en > de ? 'Englisch' : 'unbestimmt';
}

export function localSummary(page: { title: string; text: string; url: string }): SkillResult {
  const pts = extractiveSummary(page.text, 5);
  if (!pts.length) return { text: `Die Seite „${page.title}“ enthält kaum zusammenhängenden Text.`, sources: [{ url: page.url, title: page.title }] };
  return {
    text: `Kernaussagen aus „${page.title || page.url}“ (lokale Extraktion):\n${pts.map((p) => `• ${p}`).join('\n')}`,
    sources: [{ url: page.url, title: page.title || page.url }],
  };
}

export function localAnalysis(page: { title: string; text: string; url: string; description?: string }): SkillResult {
  const n = words(page.text).length;
  const host = (() => { try { return new URL(page.url).hostname; } catch { return page.url; } })();
  return {
    text: [
      `Seitenanalyse „${page.title || host}“ (lokal):`,
      `• Domain: ${host}${page.url.startsWith('https') ? ' (verschlüsselt)' : ' (unverschlüsselt!)'}`,
      `• Umfang: ${n.toLocaleString('de-DE')} Wörter, Lesezeit ca. ${Math.max(1, Math.round(n / 220))} Min.`,
      `• Sprache: ${guessLanguage(page.text)}`,
      `• Schlüsselbegriffe: ${keywords(page.text, 8).join(', ') || '–'}`,
      page.description ? `• Selbstbeschreibung: ${page.description}` : '',
    ].filter(Boolean).join('\n'),
    sources: [{ url: page.url, title: page.title || host }],
  };
}

export async function localResearch(query: string, signal?: AbortSignal): Promise<SkillResult> {
  const api = 'https://de.wikipedia.org/w/api.php?origin=*&format=json';
  const s = await fetch(`${api}&action=query&list=search&srlimit=3&srsearch=${encodeURIComponent(query)}`, { signal }).then((r) => r.json());
  const hits: { title: string }[] = s.query?.search ?? [];
  if (!hits.length) return { text: `Zu „${query}“ habe ich in der Wissensdatenbank nichts gefunden. Für eine Web-Recherche verbinden Sie das KI-Backend.` };
  const sum = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hits[0].title.replace(/ /g, '_'))}`, { signal }).then((r) => r.json());
  return {
    text: `${sum.extract ?? hits[0].title}\n\n(Quelle: Wikipedia. Für eine KI-Recherche über das ganze Web verbinden Sie das Backend.)`,
    sources: hits.map((h) => ({ title: h.title, url: `https://de.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}` })),
  };
}

export function localEmail(request: string, sender: string): SkillResult {
  const to = request.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? '';
  const name = request.match(/\ban\s+([A-ZÄÖÜ][\wäöüß-]+)/)?.[1];
  const topic = request.replace(/^.*?\b(über|wegen|zu|bezüglich|betreffend)\b\s*/i, '').replace(/[.!?]$/, '') || request;
  const subject = topic.length > 60 ? topic.slice(0, 57) + '…' : topic.charAt(0).toUpperCase() + topic.slice(1);
  const body = `${name ? `Hallo ${name}` : 'Guten Tag'},\n\nich melde mich bezüglich ${topic}.\n\n[Ihr Anliegen hier ergänzen]\n\nViele Grüße\n${sender}`;
  return { text: `Betreff: ${subject}\n\n${body}\n\n(Vorlage — mit KI-Backend formuliert J.A.R.V.I.S. den ganzen Text.)`, data: { kind: 'email', to, subject, body } };
}

const CATEGORIES: [RegExp, string][] = [
  [/youtube|netflix|spotify|twitch|vimeo|disney|music|film|video/i, 'Unterhaltung'],
  [/github|gitlab|stackoverflow|npm|developer|docs|mdn|vercel|code/i, 'Entwicklung'],
  [/wikipedia|wiki|britannica|lexikon|scholar|arxiv|research|wissen/i, 'Wissen'],
  [/news|zeit|spiegel|tagesschau|faz|sueddeutsche|bbc|cnn|nytimes|guardian|heise/i, 'Nachrichten'],
  [/mail|gmail|outlook|calendar|kalender|drive|docs\.google|notion|slack|teams|office/i, 'Produktivität'],
  [/amazon|ebay|shop|store|zalando|otto|kaufen|preis/i, 'Shopping'],
  [/maps|openstreetmap|bahn|flug|booking|airbnb|reise|travel|wetter|weather/i, 'Reisen & Orte'],
  [/twitter|x\.com|facebook|instagram|linkedin|reddit|mastodon|tiktok/i, 'Soziale Medien'],
  [/bank|finance|börse|depot|paypal|stripe|krypto|finanz/i, 'Finanzen'],
  [/claude|openai|chatgpt|anthropic|huggingface|\bai\b|\bki\b|künstliche/i, 'KI'],
];

export function localBookmarkCategories(list: { id: string; title: string; url: string }[]): SkillResult {
  const map: Record<string, string> = {};
  for (const b of list) map[b.id] = CATEGORIES.find(([re]) => re.test(`${b.url} ${b.title}`))?.[1] ?? 'Sonstiges';
  return { text: `${new Set(Object.values(map)).size} Kategorien erstellt (lokale Regeln).`, data: { kind: 'categories', map } };
}

export function localBreakdown(task: string): SkillResult {
  const steps = [`Ziel klären: ${task}`, 'Benötigte Informationen sammeln', 'Ersten konkreten Schritt erledigen', 'Ergebnis prüfen', 'Abschließen und dokumentieren'];
  return { text: `${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n(Allgemeine Vorlage — mit KI-Backend werden die Schritte aufgabenspezifisch.)`, data: { kind: 'steps', steps } };
}

export function localFile(f: { name: string; size: number; mediaType: string; text?: string }): SkillResult {
  const kb = f.size < 1024 ? `${f.size} B` : `${(f.size / 1024).toFixed(1)} KB`;
  if (f.text == null) {
    return { text: `• Datei: ${f.name}\n• Typ: ${f.mediaType || 'unbekannt'}, ${kb} KB\n\nInhaltliche Analyse von PDFs und Bildern benötigt das KI-Backend.` };
  }
  const lines = f.text.split('\n').filter((l) => l.trim());
  const isCsv = /csv/.test(f.mediaType) || f.name.endsWith('.csv');
  const extra = isCsv ? `\n• Tabelle: ${lines.length - 1} Zeilen, Spalten: ${lines[0].split(/[;,\t]/).slice(0, 10).join(', ')}` : '';
  const summary = extractiveSummary(f.text, 3);
  return {
    text: [
      `• Datei: ${f.name} (${kb})`,
      `• ${lines.length.toLocaleString('de-DE')} Zeilen, ${words(f.text).length.toLocaleString('de-DE')} Wörter, Sprache: ${guessLanguage(f.text)}`,
      `• Schlüsselbegriffe: ${keywords(f.text, 8).join(', ') || '–'}${extra}`,
      ...(summary.length && !isCsv ? ['• Kernsätze:', ...summary.map((s) => `  – ${s}`)] : []),
    ].join('\n'),
  };
}
