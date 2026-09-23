import { describe, expect, it } from 'bun:test';

import { assignConfiguredServer, resolvePluginServer } from './plugin-mcp.js';
import type { McpServerConfig } from './providers/types.js';

const ROOT = '/workspace/agent/plugins/sdr';
const DATA = '/workspace/agent/plugin-data/sdr';

describe('resolvePluginServer', () => {
  it('expands placeholders in args and env values and injects the two plugin vars', () => {
    const resolved = resolvePluginServer({
      command: 'node',
      args: ['${PLUGIN_ROOT}/server/index.js', '--cache', '${PLUGIN_DATA}/cache'],
      env: { CONFIG: '${PLUGIN_ROOT}/config.json', PLAIN: 'untouched' },
      pluginRoot: ROOT,
    });

    expect(resolved).toEqual({
      command: 'node',
      args: [`${ROOT}/server/index.js`, '--cache', `${DATA}/cache`],
      env: {
        CONFIG: `${ROOT}/config.json`,
        PLAIN: 'untouched',
        PLUGIN_ROOT: ROOT,
        PLUGIN_DATA: DATA,
      },
    });
  });

  it('resolves a ./-relative command against the plugin root and strips pluginRoot', () => {
    const resolved = resolvePluginServer({ command: './server/run.js', pluginRoot: ROOT });
    expect(resolved).toEqual({
      command: `${ROOT}/server/run.js`,
      args: [],
      env: { PLUGIN_ROOT: ROOT, PLUGIN_DATA: DATA },
    });
  });

  it('always sets PLUGIN_ROOT/PLUGIN_DATA last, over any configured value', () => {
    const resolved = resolvePluginServer({
      command: 'node',
      env: { PLUGIN_ROOT: '/spoofed' },
      pluginRoot: ROOT,
    });
    expect(resolved.type === 'http' ? undefined : resolved.env?.PLUGIN_ROOT).toBe(ROOT);
  });

  it('passes non-plugin stdio servers and http servers through untouched', () => {
    const stdio = { command: 'bun', args: ['run', 'x.ts'], env: {} };
    expect(resolvePluginServer(stdio)).toBe(stdio);

    const http = { type: 'http' as const, url: 'https://mcp.example.com/mcp', headers: { A: 'placeholder' } };
    expect(resolvePluginServer(http)).toBe(http);
  });

  it('resolves each cwd fixed form to an absolute path', () => {
    expect(resolvePluginServer({ command: 'server', cwd: './work', pluginRoot: ROOT })).toMatchObject({
      cwd: `${ROOT}/work`,
    });
    expect(resolvePluginServer({ command: 'server', cwd: '${PLUGIN_ROOT}/sub', pluginRoot: ROOT })).toMatchObject({
      cwd: `${ROOT}/sub`,
    });
    expect(resolvePluginServer({ command: 'server', cwd: '${PLUGIN_DATA}', pluginRoot: ROOT })).toMatchObject({
      cwd: DATA,
    });
  });

});

describe('assignConfiguredServer — reserved runtime names', () => {
  const seeded = (): Record<string, McpServerConfig> => ({
    nanoclaw: { command: 'bun', args: ['run', '/app/src/mcp-tools/server.ts'], env: {} },
    codex: { command: 'codex', args: ['mcp-server'], env: {} },
  });

  it('refuses a configured server that would replace the message transport', () => {
    const target = seeded();
    const reserved = new Set(Object.keys(target));
    const outcome = assignConfiguredServer(target, reserved, 'nanoclaw', {
      command: '/bin/sh',
      args: ['-c', 'exfiltrate'],
      env: {},
    });
    expect(outcome).toBe('refused-reserved');
    // The transport is still the transport — not the template's process.
    expect(target.nanoclaw.command).toBe('bun');
    expect(target.nanoclaw.args).toEqual(['run', '/app/src/mcp-tools/server.ts']);
  });

  it('refuses a configured server that would replace the codex child', () => {
    const target = seeded();
    const reserved = new Set(Object.keys(target));
    expect(assignConfiguredServer(target, reserved, 'codex', { command: 'evil', args: [], env: {} })).toBe(
      'refused-reserved',
    );
    expect(target.codex.command).toBe('codex');
  });

  it('assigns any other name', () => {
    const target = seeded();
    const reserved = new Set(Object.keys(target));
    const cfg: McpServerConfig = { command: 'python', args: ['-m', 'slang_mcp'], env: {} };
    expect(assignConfiguredServer(target, reserved, 'slang-mcp', cfg)).toBe('assigned');
    expect(target['slang-mcp']).toEqual(cfg);
  });

  it('lets a later configured server replace an earlier configured one', () => {
    const target = seeded();
    const reserved = new Set(Object.keys(target));
    assignConfiguredServer(target, reserved, 'shared', { command: 'first', args: [], env: {} });
    expect(assignConfiguredServer(target, reserved, 'shared', { command: 'second', args: [], env: {} })).toBe(
      'assigned',
    );
    expect(target.shared.command).toBe('second');
  });
});
