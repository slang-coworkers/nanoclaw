import { describe, it, expect } from 'bun:test';
import fs from 'fs';

const installed = fs.existsSync(new URL('./mcp-to-opencode.ts', import.meta.url));
const { mcpServersToOpenCodeConfig } = installed
  ? await import('./mcp-to-opencode.js')
  : ({} as typeof import('./mcp-to-opencode.js'));

// Fork-owned: mcp-to-opencode.ts is a skill payload file that a refresh of
// /add-opencode overwrites. These cases guard the two fork adaptations in it,
// so a refresh that drops them goes red here instead of silently. Skipped when
// /add-opencode is not installed.
describe.skipIf(!installed)('mcpServersToOpenCodeConfig fork adaptations', () => {
  // Fork contract (types.ts McpServerConfig.envInherit): a provider without
  // name indirection resolves the names from process.env.
  it('resolves envInherit names from process.env into the local environment', () => {
    const prev = process.env.NC_TEST_INHERITED;
    process.env.NC_TEST_INHERITED = 'from-env';
    try {
      expect(
        mcpServersToOpenCodeConfig({
          codex: { command: 'bun', args: ['bridge.ts'], env: { A: '1' }, envInherit: ['NC_TEST_INHERITED'] },
        }).codex,
      ).toEqual({
        type: 'local',
        command: ['bun', 'bridge.ts'],
        environment: { A: '1', NC_TEST_INHERITED: 'from-env' },
        enabled: true,
      });
    } finally {
      if (prev === undefined) delete process.env.NC_TEST_INHERITED;
      else process.env.NC_TEST_INHERITED = prev;
    }
  });

  it('merges codex-style httpHeaders over headers for remote servers', () => {
    expect(
      mcpServersToOpenCodeConfig({
        proxy: {
          type: 'http',
          url: 'http://host.docker.internal:8820/mcp/x',
          headers: { Accept: 'application/json', Authorization: 'Bearer old' },
          httpHeaders: { Authorization: 'Bearer new' },
        },
      }).proxy,
    ).toEqual({
      type: 'remote',
      url: 'http://host.docker.internal:8820/mcp/x',
      headers: { Accept: 'application/json', Authorization: 'Bearer new' },
      enabled: true,
    });
  });
});
