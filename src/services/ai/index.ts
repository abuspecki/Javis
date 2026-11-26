import type { AIProvider } from './types';
import { DemoProvider } from './providers/demoProvider';
import { BackendProvider } from './providers/backendProvider';
import { DirectProvider } from './providers/directProvider';

/**
 * demo    – offline persona, no network, no key
 * backend – own server (keys stay on the server), best on desktop
 * direct  – Claude API straight from the browser with a key stored on this device (iPad/phone)
 */
export type ProviderId = 'demo' | 'backend' | 'direct';

export interface ProviderConfig { provider: ProviderId; backendUrl: string; apiKey: string; model: string }

export function createProvider(c: ProviderConfig): AIProvider {
  switch (c.provider) {
    case 'backend': return new BackendProvider(c.backendUrl);
    case 'direct': return new DirectProvider(c.apiKey, c.model);
    default: return new DemoProvider();
  }
}

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — beste Qualität' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — schnell & günstiger' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — am schnellsten & günstigsten' },
];

export type { AIProvider, AIRequest, AIResponse } from './types';
