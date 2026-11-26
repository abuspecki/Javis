import type { ChatMessage, JarvisAction, JarvisContext } from '../../types';

export interface AIRequest {
  messages: Pick<ChatMessage, 'role' | 'content'>[];
  context: JarvisContext;
  signal?: AbortSignal;
}

export interface AIResponse {
  text: string;
  /** Optional UI automation the model asks the shell to perform. */
  actions?: JarvisAction[];
  provider: string;
}

/**
 * Provider contract. Every model (local demo, Claude via backend, any other LLM
 * behind the same backend route) implements this one method, so the UI never
 * depends on a specific model.
 */
export interface AIProvider {
  readonly id: string;
  readonly label: string;
  chat(req: AIRequest): Promise<AIResponse>;
}
