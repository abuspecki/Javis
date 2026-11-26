/** Zero-dependency provider for testing the pipeline without any API key. */
export function createEchoProvider() {
  return {
    id: 'echo',
    async chat({ messages }) {
      const last = messages[messages.length - 1]?.content ?? '';
      return `Backend online. Ihre Nachricht lautete: „${last}“. (Echo-Modus — setzen Sie ANTHROPIC_API_KEY für echte Antworten.)`;
    },
  };
}
