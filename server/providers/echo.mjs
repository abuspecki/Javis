/** Zero-dependency provider for testing the pipeline without any API key. */
export function createEchoProvider() {
  const note = '(Echo-Modus — setzen Sie ANTHROPIC_API_KEY für echte KI-Antworten.)';
  return {
    id: 'echo',
    supportsWebSearch: false,
    supportsFiles: false,
    async complete({ messages }) {
      const last = messages[messages.length - 1]?.content;
      const preview = typeof last === 'string' ? last : JSON.stringify(last).slice(0, 200);
      return { text: `Backend online. Anfrage empfangen (${preview.length} Zeichen). ${note}`, sources: [] };
    },
    async chat({ messages }) {
      const last = messages[messages.length - 1]?.content ?? '';
      return `Backend online. Ihre Nachricht lautete: „${last}“. ${note}`;
    },
  };
}
