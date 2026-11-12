import { describe, expect, it } from 'vitest';

import './index.js';
import { getProviderContainerConfig } from './provider-container-registry.js';

// Fork-owned: src/providers/opencode.ts is a skill payload copy. The runner's
// OpenCode timeouts (opencode.timeouts.fork.test.ts) are set on the host, so
// the host adapter must pass them into the container.
describe('OpenCode host adapter', () => {
  it('passes the server-start and MCP timeouts through to the container', async () => {
    const contribution = await getProviderContainerConfig('opencode')!({
      sessionDir: '/tmp/opencode-fork-test/session',
      groupDir: '/tmp/opencode-fork-test/group',
      agentGroupId: 'test',
      selectedSkills: [],
      hostEnv: { OPENCODE_SERVER_START_TIMEOUT_MS: '90000', OPENCODE_MCP_TIMEOUT_MS: '600000' },
      coreOwnsProviderSurfaces: true as const,
    });
    expect(contribution.env).toMatchObject({
      OPENCODE_SERVER_START_TIMEOUT_MS: '90000',
      OPENCODE_MCP_TIMEOUT_MS: '600000',
    });
  });
});
