import Anthropic from '@anthropic-ai/sdk';
import { claudeComplete, DEFAULT_MODEL } from '../../shared/claude.mjs';

/**
 * Claude provider via the official Anthropic SDK.
 * Credentials: ANTHROPIC_API_KEY (or any credential the SDK resolves automatically).
 */
export function createClaudeProvider({ model = process.env.JARVIS_MODEL || DEFAULT_MODEL, effort = process.env.JARVIS_EFFORT || 'low' } = {}) {
  const client = new Anthropic();
  const complete = (opts) => claudeComplete(client, { model, effort, ...opts, effort: opts.effort ?? effort });
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
