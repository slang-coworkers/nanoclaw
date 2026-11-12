import { afterEach, describe, expect, it } from 'bun:test';

import { buildOpenCodeConfig } from './opencode-config.js';
import { serverStartTimeoutMs } from './opencode.js';

// Fork-owned: both files are skill payload copies that a refresh of
// /add-opencode overwrites. Measured on a loaded host: `opencode serve` took
// 10-30 s to start (payload limit 10 s), and slang-mcp answered `initialize`
// in ~33 s (OpenCode's connect limit 30 s). Both limits sit above those
// numbers and stay configurable.
const MEASURED_SERVER_START_MS = 30_000;
const MEASURED_MCP_INITIALIZE_MS = 33_000;

afterEach(() => {
  delete process.env.OPENCODE_SERVER_START_TIMEOUT_MS;
  delete process.env.OPENCODE_MCP_TIMEOUT_MS;
});

describe('opencode serve start timeout', () => {
  it('defaults above the measured start time', () => {
    expect(serverStartTimeoutMs()).toBe(60_000);
    expect(serverStartTimeoutMs()).toBeGreaterThan(MEASURED_SERVER_START_MS);
  });

  it('takes OPENCODE_SERVER_START_TIMEOUT_MS and ignores an invalid value', () => {
    expect(serverStartTimeoutMs({ OPENCODE_SERVER_START_TIMEOUT_MS: '90000' })).toBe(90_000);
    expect(serverStartTimeoutMs({ OPENCODE_SERVER_START_TIMEOUT_MS: '90s' })).toBe(60_000);
    // setTimeout fires at once for delays above 2^31-1 ms.
    expect(serverStartTimeoutMs({ OPENCODE_SERVER_START_TIMEOUT_MS: '2147483648' })).toBe(60_000);
  });
});

describe('MCP server timeout', () => {
  const mcpServers = {
    local: { command: 'bun', args: ['server.ts'] },
    remote: { type: 'http' as const, url: 'http://host.docker.internal:8820/mcp/slang-mcp' },
  };

  it('gives every server a connect limit above the measured initialize time, equal to the request budget', () => {
    const config = buildOpenCodeConfig({ mcpServers });
    const mcp = config.mcp as Record<string, { timeout?: number }>;
    expect(mcp.local.timeout).toBe(330_000);
    expect(mcp.remote.timeout).toBe(330_000);
    expect(mcp.remote.timeout!).toBeGreaterThan(MEASURED_MCP_INITIALIZE_MS);
    // One per-server field sets both limits in OpenCode 1.18, so it must not
    // shrink the request budget the human-question tool relies on.
    expect(mcp.local.timeout).toBe((config.experimental as { mcp_timeout: number }).mcp_timeout);
  });

  it('takes OPENCODE_MCP_TIMEOUT_MS', () => {
    process.env.OPENCODE_MCP_TIMEOUT_MS = '600000';
    const mcp = buildOpenCodeConfig({ mcpServers }).mcp as Record<string, { timeout?: number }>;
    expect(mcp.local.timeout).toBe(600_000);
  });
});
