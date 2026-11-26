import type { AIProvider, AIRequest, AIResponse } from '../types';

/**
 * Talks to the J.A.R.V.I.S. backend (see /server). The backend owns API keys and
 * picks the actual model, so swapping models never requires a frontend change.
 *
 * Contract: POST {baseUrl}/api/chat  { messages, context } → { text, actions?, provider }
 */
export class BackendProvider implements AIProvider {
  readonly id = 'backend';
  readonly label = 'Backend (Claude / custom)';
  private baseUrl: string;
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async chat({ messages, context, signal }: AIRequest): Promise<AIResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
      signal,
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error ?? ''; } catch { /* non-JSON */ }
      throw new Error(`Backend ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const data = await res.json();
    if (typeof data.text !== 'string') throw new Error('Backend returned an invalid response');
    return { text: data.text, actions: Array.isArray(data.actions) ? data.actions : [], provider: data.provider ?? this.id };
  }
}
