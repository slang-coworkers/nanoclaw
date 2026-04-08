import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'events';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';

import { resetTransientDashboardStateForTests, startServer } from './server.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const GROUPS_DIR = path.join(PROJECT_ROOT, 'groups');
const GROUP_PROBE_DIR = path.join(PROJECT_ROOT, 'groups-testprobe');
const PUBLIC_PROBE_DIR = path.join(PROJECT_ROOT, 'dashboard', 'public-testprobe');
const TEAM_GROUP_DIR = path.join(GROUPS_DIR, 'dashboard-team-test');

let server: ReturnType<typeof startServer>;
let baseUrl = '';
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  consoleLogSpy.mockRestore();
});

beforeEach(async () => {
  resetTransientDashboardStateForTests();
  server = startServer(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected dashboard test server to bind an ephemeral TCP port');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  resetTransientDashboardStateForTests();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  rmSync(GROUP_PROBE_DIR, { recursive: true, force: true });
  rmSync(PUBLIC_PROBE_DIR, { recursive: true, force: true });
  rmSync(TEAM_GROUP_DIR, { recursive: true, force: true });
});

describe('dashboard server', () => {
  /**
   * Read SSE data messages from a stream, skipping comments (lines starting with ':').
   * Buffers chunks until `count` complete data-bearing messages are collected.
   */
  async function readSSEDataMessages(reader: ReadableStreamDefaultReader<Uint8Array>, count: number): Promise<any[]> {
    const decoder = new TextDecoder();
    let buffer = '';
    const results: any[] = [];
    while (results.length < count) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
        if (dataLine) {
          results.push(JSON.parse(dataLine.slice(6)));
        }
        // skip SSE comments (": connected" etc.)
      }
    }
    return results;
  }

  it('streams state updates over /api/events', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/events`, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeTruthy();

    // Read the initial state message (may span multiple chunks for large payloads)
    const [initialPayload] = await readSSEDataMessages(reader!, 1);
    expect(initialPayload.type).toBe('state');
    expect(Array.isArray(initialPayload.data.coworkers)).toBe(true);

    const payload = {
      group: 'telegram_main',
      event: 'PostToolUse',
      tool: 'Read',
      message: 'stream update',
      agent_id: 'stream-agent',
      agent_type: 'worker',
    };
    expect((await fetch(`${baseUrl}/api/hook-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })).status).toBe(200);

    // Read the next streamed state update
    const [streamedPayload] = await readSSEDataMessages(reader!, 1);
    expect(streamedPayload.type).toBe('state');
    const telegram = streamedPayload.data.coworkers.find((entry: any) => entry.folder === payload.group);
    expect(telegram.lastToolUse).toBe(payload.tool);

    controller.abort();
    await reader!.cancel().catch(() => {});
  });

  it('stores hook events and exposes live hook state through /api/state', async () => {
    const payload = {
      group: 'telegram_main',
      event: 'PostToolUse',
      tool: 'Read',
      message: 'Audit probe',
      tool_input: 'GET /api/overview',
      tool_response: '{"ok":true}',
      session_id: 'session-1',
      agent_id: 'agent-1',
      agent_type: 'worker',
    };

    const postRes = await fetch(`${baseUrl}/api/hook-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(postRes.status).toBe(200);

    const stateRes = await fetch(`${baseUrl}/api/state`);
    expect(stateRes.status).toBe(200);
    const state = await stateRes.json();

    const event = state.hookEvents.find((entry: any) => entry.group === payload.group);
    expect(event).toMatchObject({
      group: payload.group,
      event: payload.event,
      tool: payload.tool,
      message: payload.message,
      tool_input: payload.tool_input,
      tool_response: payload.tool_response,
      session_id: payload.session_id,
      agent_id: payload.agent_id,
      agent_type: payload.agent_type,
    });

    const coworker = state.coworkers.find((entry: any) => entry.folder === payload.group);
    expect(coworker).toMatchObject({
      folder: payload.group,
      lastToolUse: payload.tool,
      status: 'thinking',
    });
    expect(typeof coworker.hookTimestamp).toBe('number');
  });

  it('returns a coworker to idle after a stop event clears live activity', async () => {
    mkdirSync(TEAM_GROUP_DIR, { recursive: true });
    writeFileSync(path.join(TEAM_GROUP_DIR, 'CLAUDE.md'), '# dashboard-team-test\n', 'utf-8');

    const activePayload = {
      group: 'dashboard-team-test',
      event: 'PostToolUse',
      tool: 'Bash',
      message: 'running task',
      session_id: 'session-stop',
      agent_id: 'agent-stop',
      agent_type: 'worker',
    };
    const stopPayload = {
      ...activePayload,
      event: 'Stop',
      tool: undefined,
      message: 'stopped',
    };

    expect((await fetch(`${baseUrl}/api/hook-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activePayload),
    })).status).toBe(200);

    let state = await (await fetch(`${baseUrl}/api/state`)).json();
    let coworker = state.coworkers.find((entry: any) => entry.folder === activePayload.group);
    expect(coworker.status).toBe('working');
    expect(coworker.lastToolUse).toBe('Bash');

    expect((await fetch(`${baseUrl}/api/hook-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stopPayload),
    })).status).toBe(200);

    state = await (await fetch(`${baseUrl}/api/state`)).json();
    coworker = state.coworkers.find((entry: any) => entry.folder === activePayload.group);
    expect(coworker.status).toBe('idle');
    expect(coworker.lastToolUse).toBeNull();
  });

  it('surfaces PostToolUseFailure as error status for active coworkers', async () => {
    mkdirSync(TEAM_GROUP_DIR, { recursive: true });
    writeFileSync(path.join(TEAM_GROUP_DIR, 'CLAUDE.md'), '# dashboard-team-test\n', 'utf-8');

    const payload = {
      group: 'dashboard-team-test',
      event: 'PostToolUseFailure',
      tool: 'Edit',
      tool_use_id: 'failure-1',
      message: 'edit failed',
      session_id: 'session-failure',
      agent_id: 'agent-failure',
      agent_type: 'worker',
    };

    expect((await fetch(`${baseUrl}/api/hook-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })).status).toBe(200);

    const state = await (await fetch(`${baseUrl}/api/state`)).json();
    const coworker = state.coworkers.find((entry: any) => entry.folder === payload.group);
    expect(coworker.status).toBe('error');
    expect(coworker.lastToolUse).toBe(payload.tool);
  });

  it('rejects sibling-prefix traversal for /api/memory', async () => {
    mkdirSync(GROUP_PROBE_DIR, { recursive: true });
    writeFileSync(path.join(GROUP_PROBE_DIR, 'CLAUDE.md'), 'probe-group\n', 'utf-8');

    const res = await fetch(`${baseUrl}/api/memory/..%2Fgroups-testprobe`);

    expect(res.status).toBe(403);
    expect(await res.text()).toBe('forbidden');
  });

  it('rejects sibling-prefix traversal for static files', async () => {
    mkdirSync(PUBLIC_PROBE_DIR, { recursive: true });
    writeFileSync(path.join(PUBLIC_PROBE_DIR, 'secret.txt'), 'probe-public\n', 'utf-8');

    const res = await fetch(`${baseUrl}/..%2Fpublic-testprobe/secret.txt`);

    expect(res.status).toBe(403);
    expect(await res.text()).toBe('forbidden');
  });

  it('returns 400 for malformed URI encodings instead of crashing', async () => {
    const res = await fetch(`${baseUrl}/%E0%A4%A`);

    expect(res.status).toBe(400);
    expect(await res.text()).toBe('bad request');
  });

  it('tracks active subagents on the parent coworker and clears them on stop', async () => {
    mkdirSync(TEAM_GROUP_DIR, { recursive: true });
    writeFileSync(path.join(TEAM_GROUP_DIR, 'CLAUDE.md'), '# dashboard-team-test\n', 'utf-8');

    const startPayload = {
      group: 'dashboard-team-test',
      event: 'SubagentStart',
      message: 'spawn child worker',
      session_id: 'session-subagent',
      agent_id: 'child-worker-1234',
      agent_type: 'worker',
    };
    const toolPayload = {
      ...startPayload,
      event: 'PreToolUse',
      tool: 'Read',
      message: 'child reading memory',
    };
    const stopPayload = {
      ...startPayload,
      event: 'SubagentStop',
      message: 'child complete',
    };

    expect((await fetch(`${baseUrl}/api/hook-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(startPayload),
    })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/hook-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolPayload),
    })).status).toBe(200);

    let stateRes = await fetch(`${baseUrl}/api/state`);
    let state = await stateRes.json();
    let coworker = state.coworkers.find((entry: any) => entry.folder === startPayload.group);
    expect(coworker).toBeTruthy();
    expect(coworker.subagents).toEqual([
      expect.objectContaining({
        agentId: startPayload.agent_id,
        agentType: startPayload.agent_type,
        lastToolUse: toolPayload.tool,
        sessionId: startPayload.session_id,
        status: 'thinking',
      }),
    ]);

    expect((await fetch(`${baseUrl}/api/hook-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stopPayload),
    })).status).toBe(200);

    stateRes = await fetch(`${baseUrl}/api/state`);
    state = await stateRes.json();
    coworker = state.coworkers.find((entry: any) => entry.folder === startPayload.group);
    // SubagentStop keeps the subagent in a "leaving" phase for a short exit animation
    // before it is fully removed by the expiry timer.
    expect(coworker.subagents).toEqual([
      expect.objectContaining({
        agentId: startPayload.agent_id,
        phase: 'leaving',
        status: 'idle',
      }),
    ]);
  });

  it('rejects admin mutations when DASHBOARD_SECRET is set without auth', async () => {
    // Set a secret for this test
    process.env.DASHBOARD_SECRET = 'test-secret-123';

    // Memory PUT should require auth
    const memRes = await fetch(`${baseUrl}/api/memory/test-group`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: '# Test',
    });
    expect(memRes.status).toBe(401);

    // Chat send should require auth
    const chatRes = await fetch(`${baseUrl}/api/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: 'test', content: 'hello' }),
    });
    expect(chatRes.status).toBe(401);

    // With correct auth header, should pass (404/200, not 401)
    const authRes = await fetch(`${baseUrl}/api/memory/test-group`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain', Authorization: 'Bearer test-secret-123' },
      body: '# Test',
    });
    expect(authRes.status).not.toBe(401);

    // Cleanup
    delete process.env.DASHBOARD_SECRET;
  });

  it('allows admin mutations without DASHBOARD_SECRET (open by default)', async () => {
    delete process.env.DASHBOARD_SECRET;

    // Hook event should always work
    const hookRes = await fetch(`${baseUrl}/api/hook-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'SessionStart', group: 'test-group', session_id: 's1' }),
    });
    expect(hookRes.status).toBe(200);
  });
});
