import { fetchPage } from './page.mjs';
import { buildSkill, PAGE_SKILLS, SKILL_IDS, skillError } from '../shared/skills.mjs';

export { SKILL_IDS };

/** Runs a skill on the server: reads pages itself (SSRF-protected), then one model call. */
export async function runServerSkill(provider, skill, input, signal) {
  if (!SKILL_IDS.includes(skill)) throw skillError(`Unbekannte Fähigkeit: ${String(skill)}`);
  if (skill === 'research' && !provider.supportsWebSearch) throw skillError('Web-Recherche benötigt den Claude-Provider (ANTHROPIC_API_KEY)', 501);
  if (skill === 'file' && input.text == null && !provider.supportsFiles) throw skillError('Datei-Analyse benötigt den Claude-Provider', 501);
  let page = null;
  if (PAGE_SKILLS.has(skill)) {
    page = input.text
      ? { url: String(input.url ?? ''), title: String(input.title ?? ''), text: String(input.text).slice(0, 60_000) }
      : await fetchPage(String(input.url ?? ''), signal);
  }
  const spec = buildSkill(skill, input, page);
  const r = await provider.complete({ system: spec.system, messages: spec.messages, webSearch: spec.webSearch, effort: spec.effort, signal });
  return spec.finish(r.text, r.sources);
}
