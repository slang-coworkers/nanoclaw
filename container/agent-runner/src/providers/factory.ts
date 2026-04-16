import type { AgentProvider, ProviderOptions } from './types.js';
import { ClaudeProvider } from './claude.js';
import { CodexProvider } from './codex.js';
import { MockProvider } from './mock.js';

export type ProviderName = 'claude' | 'codex' | 'mock';

export function createProvider(name: ProviderName, options: ProviderOptions = {}): AgentProvider {
  switch (name) {
    case 'claude':
      return new ClaudeProvider(options);
    case 'codex':
      return new CodexProvider(options);
    case 'mock':
      return new MockProvider(options);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}
