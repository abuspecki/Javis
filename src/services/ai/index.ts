import type { AIProvider } from './types';
import { DemoProvider } from './providers/demoProvider';
import { BackendProvider } from './providers/backendProvider';

export type ProviderId = 'demo' | 'backend';

export function createProvider(id: ProviderId, backendUrl: string): AIProvider {
  switch (id) {
    case 'backend': return new BackendProvider(backendUrl);
    default: return new DemoProvider();
  }
}

export type { AIProvider, AIRequest, AIResponse } from './types';
