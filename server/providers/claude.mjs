import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude provider via the official Anthropic SDK.
 * Credentials: ANTHROPIC_API_KEY (or any credential the SDK resolves automatically).
 */
export function createClaudeProvider({ model = process.env.JARVIS_MODEL || 'claude-opus-5-5', effort = process.env.JARVIS_EFFORT || 'low' } = {}) {
  const client = new Anthropic();

  /** One completion. `webSearch` enables Anthropic's server-side web search (results come back with citations). */
  async function complete({ system, messages, signal, webSearch = false, effort: eff = effort }) {
    const tools = webSearch ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }] : undefined;
    let convo = messages;
    let response;
    // Server tools can pause a long turn (pause_turn); resume by re-sending the assistant content.
    for (let i = 0; i < 4; i++) {
      response = await client.beta.messages.create(
        {
          model,
          max_tokens: 16000,
          output_config: { effort: eff },
          // On a safety decline, the API re-runs the request on a fallback model automatically.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system,
          messages: convo,
          ...(tools ? { tools } : {}),
        },
        { signal },
      );
      if (response.stop_reason !== 'pause_turn') break;
      convo = [...messages, { role: 'assistant', content: response.content }];
    }
    if (response.stop_reason === 'refusal') return { text: 'Diese Anfrage kann ich leider nicht bearbeiten, Sir.', sources: [] };

    const sources = new Map();
    let text = '';
    for (const block of response.content) {
      if (block.type !== 'text') continue;
      text += block.text;
      for (const c of block.citations ?? []) {
        if (c.url && !sources.has(c.url)) sources.set(c.url, { url: c.url, title: c.title || c.url });
      }
    }
    return { text: text.trim(), sources: [...sources.values()] };
  }

  return {
    id: `claude:${model}`,
    supportsWebSearch: true,
    supportsFiles: true,
    complete,
    async chat({ system, messages, signal }) {
      return (await complete({ system, messages, signal })).text;
    },
  };
}
