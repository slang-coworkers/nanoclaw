import { describe, it, expect } from 'bun:test';

import { mcpServersToPiConfig } from './mcp-to-pi.js';

describe('mcpServersToPiConfig', () => {
  it('maps nanoclaw + extra stdio server like v2 index.ts merge', () => {
    const servers = {
      nanoclaw: {
        command: 'bun',
        args: ['run', '/app/src/mcp-tools/index.ts'],
        env: {
          SESSION_INBOUND_DB_PATH: '/workspace/inbound.db',
          SESSION_OUTBOUND_DB_PATH: '/workspace/outbound.db',
          SESSION_HEARTBEAT_PATH: '/workspace/.heartbeat',
        },
      },
      extra: {
        command: 'npx',
        args: ['-y', 'some-mcp'],
        env: { FOO: 'bar' },
      },
    };

    const mcp = mcpServersToPiConfig(servers);

    expect(mcp.nanoclaw).toEqual({
      command: 'bun',
      args: ['run', '/app/src/mcp-tools/index.ts'],
      env: {
        SESSION_INBOUND_DB_PATH: '/workspace/inbound.db',
        SESSION_OUTBOUND_DB_PATH: '/workspace/outbound.db',
        SESSION_HEARTBEAT_PATH: '/workspace/.heartbeat',
      },
    });

    expect(mcp.extra).toEqual({
      command: 'npx',
      args: ['-y', 'some-mcp'],
      env: { FOO: 'bar' },
    });
  });

  it('omits env when empty', () => {
    const mcp = mcpServersToPiConfig({ x: { command: 'true', args: [], env: {} } });
    expect(mcp.x).toEqual({ command: 'true', args: [] });
  });

  it('translates HTTP entries injected by the MCP proxy (cast as any at runtime)', () => {
    // index.ts injects {type:'http', url, headers} via `as any`.
    const servers = {
      proxied: { type: 'http', url: 'http://host.docker.internal:9/mcp/foo', headers: { Authorization: 'Bearer t' } },
    } as unknown as Parameters<typeof mcpServersToPiConfig>[0];
    const mcp = mcpServersToPiConfig(servers);
    expect(mcp.proxied).toEqual({
      url: 'http://host.docker.internal:9/mcp/foo',
      headers: { Authorization: 'Bearer t' },
    });
  });

  it('defaults missing args to [] and never throws on a partial entry', () => {
    const servers = { s: { command: 'x' } } as unknown as Parameters<typeof mcpServersToPiConfig>[0];
    const mcp = mcpServersToPiConfig(servers);
    expect(mcp.s).toEqual({ command: 'x', args: [] });
  });

  it('skips entries with neither command nor url', () => {
    const servers = { junk: { type: 'weird' } } as unknown as Parameters<typeof mcpServersToPiConfig>[0];
    expect(mcpServersToPiConfig(servers)).toEqual({});
  });

  it('returns empty record for undefined', () => {
    expect(mcpServersToPiConfig(undefined)).toEqual({});
  });
});
