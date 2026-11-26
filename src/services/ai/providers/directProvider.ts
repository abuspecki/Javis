import type { AIProvider, AIRequest, AIResponse } from '../types';
import type { JarvisAction } from '../../../types';
import { claudeComplete } from '../../../../shared/claude.mjs';
import { buildSystemPrompt, extractActions } from '../../../../shared/prompt.mjs';
import { buildSkill } from '../../../../shared/skills.mjs';

/**
 * "Claude direkt": calls the Claude API straight from the browser with a key stored on this
 * device. Made for iPad / phone, where no local backend can run. The SDK is loaded lazily so
 * other modes don't pay for its bundle size.
 */
async function makeClient(apiKey: string) {
  if (!apiKey.trim()) throw new Error('Kein API-Schlüssel hinterlegt. Bitte in den Einstellungen eintragen.');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** Turns SDK/HTTP errors into messages a user can act on. */
export function explainApiError(e: unknown): Error {
  const err = e as { status?: number; name?: string; message?: string };
  if (err?.name === 'AbortError') return err as Error;
  const byStatus: Record<number, string> = {
    401: 'Der API-Schlüssel ist ungültig.',
    403: 'Der API-Schlüssel hat keine Berechtigung für dieses Modell.',
    404: 'Das gewählte Modell ist für diesen Schlüssel nicht verfügbar.',
    429: 'Zu viele Anfragen oder Guthaben aufgebraucht. Bitte kurz warten oder das Guthaben prüfen.',
    529: 'Die Claude-API ist gerade überlastet. Bitte gleich noch einmal versuchen.',
  };
  if (err?.status && byStatus[err.status]) return new Error(byStatus[err.status]);
  if (err?.status && err.status >= 500) return new Error('Die Claude-API hat einen Fehler gemeldet. Bitte erneut versuchen.');
  if (/fetch|network|Connection/i.test(err?.message ?? '')) return new Error('Keine Verbindung zur Claude-API. Besteht eine Internetverbindung?');
  return e instanceof Error ? e : new Error(String(e));
}

export class DirectProvider implements AIProvider {
  readonly id = 'direct';
  readonly label = 'Claude direkt';
  private apiKey: string;
  private model: string;
  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat({ messages, context, signal }: AIRequest): Promise<AIResponse> {
    try {
      const client = await makeClient(this.apiKey);
      const r = await claudeComplete(client, { model: this.model, system: buildSystemPrompt(context), messages, signal });
      const { text, actions } = extractActions(r.text);
      return { text: text || '…', actions: actions as JarvisAction[], provider: this.model };
    } catch (e) { throw explainApiError(e); }
  }
}

/** Runs a skill directly against Claude; pages are read by Claude's web_fetch tool. */
export async function runDirectSkill(
  apiKey: string, model: string, skill: string, input: Record<string, unknown>, signal?: AbortSignal,
  page: { url: string; title: string; text: string } | null = null,
) {
  try {
    const client = await makeClient(apiKey);
    const spec = buildSkill(skill, input, page);
    const r = await claudeComplete(client, { model, system: spec.system, messages: spec.messages, webSearch: spec.webSearch, webFetch: spec.webFetch, effort: spec.effort, signal });
    return spec.finish(r.text, r.sources);
  } catch (e) { throw explainApiError(e); }
}
