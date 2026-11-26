/**
 * Isomorphic Claude call used by the Node backend AND the browser ("Claude direkt" on iPad).
 * The caller passes an Anthropic SDK client, so this file has no dependencies.
 */
export const DEFAULT_MODEL = 'claude-opus-5-5';

/**
 * @param client  Anthropic SDK client
 * @param opts    { model, effort, system, messages, webSearch, webFetch, signal }
 * @returns       { text, sources: {url,title}[] }
 */
export async function claudeComplete(client, { model = DEFAULT_MODEL, effort = 'low', system, messages, webSearch = false, webFetch = false, signal }) {
  const tools = [];
  if (webSearch) tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: 6 });
  if (webFetch) tools.push({ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 });
  let convo = messages;
  let response;
  // Server tools can pause a long turn (pause_turn); resume by re-sending the assistant content.
  for (let i = 0; i < 4; i++) {
    response = await client.beta.messages.create(
      {
        model,
        max_tokens: 16000,
        output_config: { effort },
        // On a safety decline, the API re-runs the request on a fallback model automatically.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        messages: convo,
        ...(tools.length ? { tools } : {}),
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
