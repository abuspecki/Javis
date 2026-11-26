import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude provider via the official Anthropic SDK.
 * Credentials: ANTHROPIC_API_KEY (or any credential the SDK resolves automatically).
 */
export function createClaudeProvider({ model = process.env.JARVIS_MODEL || 'claude-opus-5-5', effort = process.env.JARVIS_EFFORT || 'low' } = {}) {
  const client = new Anthropic();
  return {
    id: `claude:${model}`,
    async chat({ system, messages, signal }) {
      const response = await client.beta.messages.create(
        {
          model,
          max_tokens: 16000,
          // Chat replies should be fast; raise JARVIS_EFFORT for deeper research tasks.
          output_config: { effort },
          // On a safety decline, the API re-runs the request on a fallback model automatically.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system,
          messages,
        },
        { signal },
      );
      if (response.stop_reason === 'refusal') {
        return 'Diese Anfrage kann ich leider nicht bearbeiten, Sir.';
      }
      return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    },
  };
}
