import { registerProviderContract } from '../providers/provider-registry.js';
import { resolveOpenCodeExecutionPolicy, resolveOpenCodeInference } from '../providers/opencode-config.js';
import { mcpServersToOpenCodeConfig } from '../providers/mcp-to-opencode.js';
import type { ProviderRuntimeContract } from './registry.js';

export const opencodeRuntimeContract: ProviderRuntimeContract = {
  // This installed payload implements v1; a core upgrade must not opt it into a new seam.
  seamVersion: 1,
  configuration: {
    executionPolicy: { constant: resolveOpenCodeExecutionPolicy() },
    inference: resolveOpenCodeInference,
    memory: (hook) => ({ ...hook }),
    mcpServers: (servers) => mcpServersToOpenCodeConfig(servers),
  },
  // A turn emits one text event per assistant message (providers/opencode-turn.ts),
  // as the Claude SDK does, so <message> blocks deliver from the text events and
  // the result never sends content.
  textDelivery: 'mid-turn-complete',
  commands: { formatting: 'xml' },
};
registerProviderContract('opencode', opencodeRuntimeContract);
