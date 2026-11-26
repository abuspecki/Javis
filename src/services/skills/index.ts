import type { SkillId } from '../../types';
import { isExtension } from '../browser/host';
import * as local from './local';

export interface SkillResult {
  text: string;
  sources?: { url: string; title: string }[];
  data?:
    | { kind: 'email'; to: string; subject: string; body: string }
    | { kind: 'categories'; map: Record<string, string> }
    | { kind: 'steps'; steps: string[] };
}

export interface PageContent { url: string; title: string; text: string; description?: string }

export interface SkillEnv { useBackend: boolean; backendUrl: string; sender: string; signal?: AbortSignal }

export type SkillInput =
  | { skill: 'summarize' | 'analyze'; url: string }
  | { skill: 'translate'; url: string; target: string }
  | { skill: 'research'; query: string }
  | { skill: 'email'; request: string }
  | { skill: 'bookmarks'; bookmarks: { id: string; title: string; url: string }[] }
  | { skill: 'breakdown'; task: string }
  | { skill: 'file'; name: string; size: number; mediaType: string; text?: string; data?: string };

export const SKILL_LABELS: Record<SkillId, string> = {
  summarize: 'Seite zusammenfassen', translate: 'Seite übersetzen', analyze: 'Seite analysieren', research: 'Recherche',
  email: 'E-Mail-Entwurf', bookmarks: 'Lesezeichen sortieren', breakdown: 'Aufgabe zerlegen', file: 'Datei analysieren',
};

const base = (u: string) => u.replace(/\/$/, '');

async function postSkill(env: SkillEnv, skill: SkillId, input: unknown): Promise<SkillResult> {
  const res = await fetch(`${base(env.backendUrl)}/api/skill`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skill, input }), signal: env.signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Backend ${res.status}`);
  return body as SkillResult;
}

/**
 * Reads a page's text. As a Chrome extension we may fetch any origin directly;
 * on the web, cross-origin pages are read through the backend (/api/page, SSRF-protected).
 */
export async function readPage(url: string, env: SkillEnv): Promise<PageContent> {
  if (isExtension) {
    const res = await fetch(url, { signal: env.signal });
    if (!res.ok) throw new Error(`Seite antwortete mit ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    doc.querySelectorAll('script,style,noscript,nav,footer,header,aside,form,svg').forEach((n) => n.remove());
    const root = doc.querySelector('article,main') ?? doc.body;
    return {
      url, title: doc.title, description: doc.querySelector('meta[name=description]')?.getAttribute('content') ?? '',
      text: (root?.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim().slice(0, 60_000),
    };
  }
  const res = await fetch(`${base(env.backendUrl)}/api/page?url=${encodeURIComponent(url)}`, { signal: env.signal }).catch(() => null);
  if (!res) throw new Error('Seiteninhalte kann ich im Web-Modus nur über das Backend lesen. Starten Sie den Server (npm run dev:server) oder nutzen Sie die Chrome-Extension.');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Backend ${res.status}`);
  return body as PageContent;
}

/** Single entry point for all skills: AI backend when configured, otherwise the offline implementation. */
export async function runSkill(input: SkillInput, env: SkillEnv): Promise<SkillResult> {
  const { skill } = input;
  if (env.useBackend) {
    // The backend can read the page itself; in extension mode we send the text we already can read.
    if ((skill === 'summarize' || skill === 'analyze' || skill === 'translate') && isExtension) {
      const page = await readPage(input.url, env);
      return postSkill(env, skill, { ...page, target: skill === 'translate' ? input.target : undefined });
    }
    const { skill: _s, ...rest } = input; void _s;
    return postSkill(env, skill, { ...rest, sender: env.sender });
  }

  switch (input.skill) {
    case 'summarize': return local.localSummary(await readPage(input.url, env));
    case 'analyze': return local.localAnalysis(await readPage(input.url, env));
    case 'translate': {
      const lang = { deutsch: 'de', englisch: 'en', english: 'en', französisch: 'fr', spanisch: 'es', italienisch: 'it' }[input.target.toLowerCase()] ?? 'de';
      const url = `https://translate.google.com/translate?sl=auto&tl=${lang}&u=${encodeURIComponent(input.url)}`;
      return { text: `Für eine Übersetzung im Offline-Modus habe ich die Seite an Google Übersetzer übergeben (${input.target}). Mit KI-Backend übersetze ich direkt hier.`, sources: [{ url, title: `Google Übersetzer → ${input.target}` }] };
    }
    case 'research': return local.localResearch(input.query, env.signal);
    case 'email': return local.localEmail(input.request, env.sender);
    case 'bookmarks': return local.localBookmarkCategories(input.bookmarks);
    case 'breakdown': return local.localBreakdown(input.task);
    case 'file': return local.localFile(input);
  }
}
