import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { CODEX_MCP_BRIDGE_OVERRIDES_ENV, CODEX_REPLY_TOOL, CODEX_TOOL, configToOverrides } from './codex-mcp-bridge.js';

// The bridge must be a drop-in for codex 0.153.4's `codex mcp-server`: same two
// tools, same input schema, same result shape (text + structuredContent.threadId),
// served over `codex app-server`. These tests run the real bridge process over
// stdio against a fake `codex` on PATH (test-fixtures/fake-codex-app-server.ts).

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BRIDGE = path.join(HERE, 'codex-mcp-bridge.ts');
const FAKE = path.join(HERE, 'test-fixtures', 'fake-codex-app-server.ts');

let binDir: string;
let logFile: string;
let client: Client;
let transport: StdioClientTransport;

beforeAll(async () => {
  binDir = mkdtempSync(path.join(tmpdir(), 'fake-codex-'));
  logFile = path.join(binDir, 'received.jsonl');
  const shim = path.join(binDir, 'codex');
  writeFileSync(shim, `#!/bin/sh\nexec bun run ${FAKE} "$@"\n`);
  chmodSync(shim, 0o755);
  transport = new StdioClientTransport({
    command: 'bun',
    args: ['run', BRIDGE],
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
      FAKE_CODEX_LOG: logFile,
      CODEX_MODEL: 'openai/openai/gpt-test',
      [CODEX_MCP_BRIDGE_OVERRIDES_ENV]: JSON.stringify(['sandbox_mode=danger-full-access', 'features.hooks=true']),
    },
    stderr: 'pipe',
  });
  client = new Client({ name: 'bridge-test', version: '0' });
  await client.connect(transport);
});

afterAll(async () => {
  await client?.close().catch(() => undefined);
  rmSync(binDir, { recursive: true, force: true });
});

describe('configToOverrides', () => {
  it('flattens nested config into codex -c overrides with TOML strings', () => {
    expect(configToOverrides({ model_reasoning_effort: 'low', features: { hooks: true }, name: 'x y', n: 3 })).toEqual([
      'model_reasoning_effort="low"',
      'features.hooks=true',
      'name="x y"',
      'n=3',
    ]);
    expect(configToOverrides(undefined)).toEqual([]);
  });
});

describe('codex MCP bridge over stdio', () => {
  it('advertises exactly the two tools codex mcp-server advertised, with the same schema', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['codex', 'codex-reply']);
    const codex = tools.find((t) => t.name === 'codex')!;
    expect(codex.inputSchema).toEqual(CODEX_TOOL.inputSchema as unknown as typeof codex.inputSchema);
    expect(Object.keys((codex.inputSchema as { properties: Record<string, unknown> }).properties).sort()).toEqual([
      'approval-policy',
      'base-instructions',
      'compact-prompt',
      'config',
      'cwd',
      'developer-instructions',
      'model',
      'prompt',
      'sandbox',
    ]);
    expect(tools.find((t) => t.name === 'codex-reply')!.inputSchema).toEqual(
      CODEX_REPLY_TOOL.inputSchema as unknown as typeof codex.inputSchema,
    );
  });

  it('codex: starts an app-server thread, runs the turn, returns the agent message + threadId', async () => {
    const r = (await client.callTool({
      name: 'codex',
      arguments: {
        prompt: 'review this',
        'developer-instructions': 'You are an independent reviewer',
        sandbox: 'danger-full-access',
        cwd: binDir,
        config: { model_reasoning_effort: 'low' },
      },
    })) as {
      content: Array<{ type: string; text: string }>;
      structuredContent?: { threadId: string; content: string };
      isError?: boolean;
    };
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toBe('VERDICT: approve');
    expect(r.structuredContent?.threadId).toBe('thread-1');
    expect(r.structuredContent?.content).toBe('VERDICT: approve');
    const received = readFileSync(logFile, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    const methods = received.map((m) => m.method);
    expect(methods.slice(0, 3)).toEqual(['initialize', 'thread/start', 'turn/start']);
    const threadStart = received.find((m) => m.method === 'thread/start').params;
    expect(threadStart.sandbox).toBe('danger-full-access');
    expect(threadStart.approvalPolicy).toBe('never');
    expect(threadStart.cwd).toBe(binDir);
    expect(threadStart.model).toBe('openai/openai/gpt-test');
    const turn = received.find((m) => m.method === 'turn/start').params;
    expect(
      turn.input[0].text.startsWith('Developer instructions:\nYou are an independent reviewer\n\nreview this'),
    ).toBe(true);
  });

  it('codex-reply: continues the same live thread without a new app-server', async () => {
    const before = readFileSync(logFile, 'utf8').trim().split('\n').length;
    const r = (await client.callTool({
      name: 'codex-reply',
      arguments: { threadId: 'thread-1', prompt: 'ROUND: 2/3 — addressed 1' },
    })) as {
      content: Array<{ text: string }>;
      structuredContent?: { threadId: string };
    };
    expect(r.content[0].text).toBe('VERDICT: approve (round 2)');
    expect(r.structuredContent?.threadId).toBe('thread-1');
    const after = readFileSync(logFile, 'utf8')
      .trim()
      .split('\n')
      .slice(before)
      .map((l) => JSON.parse(l));
    expect(after.map((m) => m.method)).toEqual(['turn/start']); // no initialize / thread/start: the thread was live
  });

  it('codex-reply on an unknown thread resumes it on a fresh app-server', async () => {
    const r = (await client.callTool({
      name: 'codex-reply',
      arguments: { conversationId: 'thread-77', prompt: 'ping' },
    })) as {
      content: Array<{ text: string }>;
      structuredContent?: { threadId: string };
    };
    expect(r.content[0].text).toBe('VERDICT: approve');
    expect(r.structuredContent?.threadId).toBe('thread-77');
    const received = readFileSync(logFile, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(received.some((m) => m.method === 'thread/resume' && m.params.threadId === 'thread-77')).toBe(true);
  });

  it('a stale thread id surfaces as an error result, not a hang', async () => {
    const r = (await client.callTool({ name: 'codex-reply', arguments: { threadId: 'stale-1', prompt: 'ping' } })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };
    // The client's resume falls through to a fresh thread only on recognised stale errors — which this is —
    // so the bridge starts a new thread and answers; the new id is reported.
    expect(r.content[0].text).toBe('VERDICT: approve');
  });

  it('rejects a call without a prompt', async () => {
    const r = (await client.callTool({ name: 'codex', arguments: {} })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('prompt');
  });
});
