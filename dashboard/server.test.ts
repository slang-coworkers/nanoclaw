import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'events';
import { createServer } from 'http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import {
  compareMessagesAscending,
  containerExecArgs,
  ensureDashboardChatWiring,
  forceOpenDbForTests,
  matchContainerName,
  matchContainerNameForRequest,
  resetTransientDashboardStateForTests,
  resolveCoworkerTypeMetadata,
  startReadOnlyServer,
  startServer,
  timestampToEpochMs,
} from './server.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const GROUPS_DIR = path.join(PROJECT_ROOT, 'groups');
const COWORKERS_DIR = path.join(PROJECT_ROOT, 'coworkers');
const TEST_TMP_ROOT = mkdtempSync(path.join('/tmp', 'nanoclaw-dashboard-test-'));
const DATA_DIR = path.join(TEST_TMP_ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'v2.db');
const V1_IMPORT_ROOT = path.join(TEST_TMP_ROOT, 'v1-import-root');
const GROUP_PROBE_DIR = path.join(PROJECT_ROOT, 'groups-testprobe');
const PUBLIC_PROBE_DIR = path.join(PROJECT_ROOT, 'dashboard', 'public-testprobe');
const TEAM_GROUP_DIR = path.join(GROUPS_DIR, 'dashboard-team-test');
const IMPORT_COLLISION_GROUP_DIR = path.join(GROUPS_DIR, 'import-collision-reviewer');
const HIDDEN_PATH_GROUP_DIR = path.join(GROUPS_DIR, 'hidden-path-reviewer');
const EXPORT_PROBE_GROUP_DIR = path.join(GROUPS_DIR, 'export-warning-probe');
const ROUNDTRIP_SOURCE_GROUP_DIR = path.join(GROUPS_DIR, 'roundtrip-export-probe');
const ROUNDTRIP_IMPORTED_GROUP_DIR = path.join(GROUPS_DIR, 'roundtrip-imported-probe');
const COWORKER_EXPORT_PROBE_FILES = ['archive-probe.yaml', 'export-warning-probe.yaml', 'roundtrip-export-probe.yaml'];

let server: ReturnType<typeof startServer>;
let baseUrl = '';
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  consoleLogSpy.mockRestore();
  rmSync(TEST_TMP_ROOT, { recursive: true, force: true });
  delete process.env.NANOCLAW_DASHBOARD_DATA_DIR;
  delete process.env.NANOCLAW_DASHBOARD_DB_PATH;
  delete process.env.NANOCLAW_DASHBOARD_V1_IMPORT_ROOT;
});

beforeEach(async () => {
  process.env.NANOCLAW_DASHBOARD_DATA_DIR = DATA_DIR;
  process.env.NANOCLAW_DASHBOARD_DB_PATH = DB_PATH;
  process.env.NANOCLAW_DASHBOARD_V1_IMPORT_ROOT = V1_IMPORT_ROOT;
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
  rmSync(IMPORT_COLLISION_GROUP_DIR, { recursive: true, force: true });
  rmSync(HIDDEN_PATH_GROUP_DIR, { recursive: true, force: true });
  rmSync(EXPORT_PROBE_GROUP_DIR, { recursive: true, force: true });
  rmSync(ROUNDTRIP_SOURCE_GROUP_DIR, { recursive: true, force: true });
  rmSync(ROUNDTRIP_IMPORTED_GROUP_DIR, { recursive: true, force: true });
  for (const file of COWORKER_EXPORT_PROBE_FILES) {
    rmSync(path.join(COWORKERS_DIR, file), { force: true });
  }
  rmSync(DATA_DIR, { recursive: true, force: true });
  rmSync(V1_IMPORT_ROOT, { recursive: true, force: true });
});

function createDashboardTestDb(): Database.Database {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0,
      agent_provider TEXT,
      container_config TEXT,
      coworker_type TEXT,
      allowed_mcp_tools TEXT,
      routing TEXT NOT NULL DEFAULT 'direct',
      disable_overlays INTEGER NOT NULL DEFAULT 0,
      overlays TEXT,
      sidebar_group TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent_group_id TEXT NOT NULL,
      messaging_group_id TEXT,
      thread_id TEXT,
      agent_provider TEXT,
      status TEXT DEFAULT 'active',
      container_status TEXT DEFAULT 'stopped',
      last_active TEXT,
      created_at TEXT NOT NULL,
      hidden_at TEXT,
      pinned_at TEXT
    );
    CREATE TABLE IF NOT EXISTS messaging_groups (
      id TEXT PRIMARY KEY,
      channel_type TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      instance TEXT NOT NULL,
      name TEXT,
      is_group INTEGER NOT NULL DEFAULT 0,
      unknown_sender_policy TEXT DEFAULT 'strict',
      created_at TEXT NOT NULL,
      UNIQUE(channel_type, platform_id, instance)
    );
    CREATE TABLE IF NOT EXISTS messaging_group_agents (
      id TEXT PRIMARY KEY,
      messaging_group_id TEXT NOT NULL,
      agent_group_id TEXT NOT NULL,
      engage_mode TEXT,
      engage_pattern TEXT,
      sender_scope TEXT NOT NULL DEFAULT 'all',
      ignored_message_policy TEXT DEFAULT 'drop',
      session_mode TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_destinations (
      agent_group_id TEXT NOT NULL,
      local_name TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (agent_group_id, local_name)
    );
    CREATE TABLE IF NOT EXISTS hook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_folder TEXT NOT NULL,
      event TEXT NOT NULL,
      tool TEXT,
      tool_use_id TEXT,
      message TEXT,
      tool_input TEXT,
      tool_response TEXT,
      session_id TEXT,
      agent_id TEXT,
      agent_type TEXT,
      transcript_path TEXT,
      cwd TEXT,
      extra TEXT,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      agent_group_id TEXT,
      granted_by TEXT,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, role, agent_group_id)
    );
    CREATE TABLE IF NOT EXISTS agent_group_members (
      user_id TEXT NOT NULL,
      agent_group_id TEXT NOT NULL,
      added_by TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY(user_id, agent_group_id)
    );
  `);
  return db;
}

describe('dashboard server', () => {
  async function startIngressStub(
    handler: Parameters<typeof createServer>[0],
  ): Promise<{ server: ReturnType<typeof createServer>; baseUrl: string }> {
    const stub = createServer(handler);
    stub.listen(0, '127.0.0.1');
    await once(stub, 'listening');
    const address = stub.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected dashboard ingress stub to bind an ephemeral TCP port');
    }
    return { server: stub, baseUrl: `http://127.0.0.1:${address.port}` };
  }

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

  it('streams compact hook deltas over /api/events', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/events`, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeTruthy();

    // The initial snapshot contains core state only; hook history is loaded
    // separately and live events arrive as compact deltas.
    const [initialPayload] = await readSSEDataMessages(reader!, 1);
    expect(initialPayload.type).toBe('state');
    expect(Array.isArray(initialPayload.data.coworkers)).toBe(true);
    expect(initialPayload.data.hookEvents).toBeUndefined();

    const payload = {
      group: 'telegram_main',
      event: 'PostToolUse',
      tool: 'Read',
      message: 'stream update',
      agent_id: 'stream-agent',
      agent_type: 'worker',
    };
    expect(
      (
        await fetch(`${baseUrl}/api/hook-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      ).status,
    ).toBe(200);

    // Read the incremental event rather than another full state snapshot.
    const [streamedPayload] = await readSSEDataMessages(reader!, 1);
    expect(streamedPayload.type).toBe('hook-event');
    expect(streamedPayload.data).toMatchObject({
      group: payload.group,
      event: payload.event,
      tool: payload.tool,
    });
    expect(streamedPayload.coworker).toMatchObject({
      folder: payload.group,
      lastToolUse: payload.tool,
      status: 'thinking',
    });

    controller.abort();
    await reader!.cancel().catch(() => {});
  });

  it('serves shared live telemetry on the read-only port and rejects all input', async () => {
    createDashboardTestDb().close();
    const readOnlyServer = startReadOnlyServer(0);
    await once(readOnlyServer, 'listening');
    const address = readOnlyServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected read-only dashboard server to bind an ephemeral TCP port');
    }
    const readOnlyBaseUrl = `http://127.0.0.1:${address.port}`;
    const streamController = new AbortController();
    let streamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const htmlRes = await fetch(`${readOnlyBaseUrl}/`);
      expect(htmlRes.status).toBe(200);
      const html = await htmlRes.text();
      expect(html).toContain('data-dashboard-mode="readonly"');
      expect(html).toContain('viewer.css');

      const deniedHook = await fetch(`${readOnlyBaseUrl}/api/hook-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: 'viewer-worker', event: 'PostToolUse', tool: 'Read' }),
      });
      expect(deniedHook.status).toBe(403);
      expect(await deniedHook.json()).toEqual({ error: 'read-only dashboard' });

      const streamRes = await fetch(`${readOnlyBaseUrl}/api/events?snapshot=0`, {
        headers: { Accept: 'text/event-stream' },
        signal: streamController.signal,
      });
      expect(streamRes.status).toBe(200);
      streamReader = streamRes.body?.getReader();
      expect(streamReader).toBeTruthy();

      const acceptedHook = await fetch(`${baseUrl}/api/hook-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: 'viewer-worker',
          event: 'PostToolUse',
          tool: 'Read',
          message: 'shared telemetry',
        }),
      });
      expect(acceptedHook.status).toBe(200);

      const [streamedHook] = await readSSEDataMessages(streamReader!, 1);
      expect(streamedHook).toMatchObject({
        type: 'hook-event',
        data: {
          group: 'viewer-worker',
          event: 'PostToolUse',
          tool: 'Read',
          message: 'shared telemetry',
        },
      });

      const readOnlyEvents = await (await fetch(`${readOnlyBaseUrl}/api/hook-events?limit=20`)).json();
      expect(readOnlyEvents).toContainEqual(
        expect.objectContaining({
          group: 'viewer-worker',
          event: 'PostToolUse',
          tool: 'Read',
          message: 'shared telemetry',
        }),
      );

      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const denied = await fetch(`${readOnlyBaseUrl}/api/chat/send`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group: 'viewer-worker', content: 'must not send' }),
        });
        expect(denied.status).toBe(403);
      }

      const css = await (await fetch(`${readOnlyBaseUrl}/viewer.css`)).text();
      expect(css).toContain('#cw-create-btn');
      expect(css).toContain('#cw-work-shell');
    } finally {
      streamController.abort();
      await streamReader?.cancel().catch(() => {});
      await new Promise<void>((resolve, reject) => {
        readOnlyServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });

  it('keeps hook bodies out of core state and fetches details lazily', async () => {
    createDashboardTestDb().close();
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
    expect(state.hookEvents).toBeUndefined();

    const eventsRes = await fetch(`${baseUrl}/api/hook-events?limit=20`);
    expect(eventsRes.status).toBe(200);
    const events = await eventsRes.json();
    const event = events.find((entry: any) => entry.group === payload.group);
    expect(event).toMatchObject({
      group: payload.group,
      event: payload.event,
      tool: payload.tool,
      message: payload.message,
      session_id: payload.session_id,
      agent_id: payload.agent_id,
      agent_type: payload.agent_type,
      has_details: true,
    });
    expect(event.tool_input).toBeUndefined();
    expect(event.tool_response).toBeUndefined();
    expect(typeof event.id).toBe('number');

    const detailRes = await fetch(`${baseUrl}/api/hook-events/${event.id}`);
    expect(detailRes.status).toBe(200);
    expect(await detailRes.json()).toMatchObject({
      id: event.id,
      tool_input: payload.tool_input,
      tool_response: payload.tool_response,
    });

    const coworker = state.coworkers.find((entry: any) => entry.folder === payload.group);
    expect(coworker).toMatchObject({
      folder: payload.group,
      lastToolUse: payload.tool,
      status: 'thinking',
    });
    expect(typeof coworker.hookTimestamp).toBe('number');
  });

  it('keeps large tool output out of snapshots and recent-event summaries', async () => {
    createDashboardTestDb().close();
    const marker = 'large-hook-output-marker';
    const toolResponse = `${marker}:${'x'.repeat(512 * 1024)}`;
    const postRes = await fetch(`${baseUrl}/api/hook-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group: 'large-output-worker',
        event: 'PostToolUse',
        tool: 'TaskOutput',
        tool_response: toolResponse,
      }),
    });
    expect(postRes.status).toBe(200);

    const stateText = await (await fetch(`${baseUrl}/api/state`)).text();
    expect(stateText).not.toContain(marker);
    expect(stateText.length).toBeLessThan(100_000);

    const recentText = await (await fetch(`${baseUrl}/api/hook-events?limit=20`)).text();
    expect(recentText).not.toContain(marker);
    expect(recentText.length).toBeLessThan(20_000);

    const [event] = JSON.parse(recentText);
    const historyText = await (await fetch(`${baseUrl}/api/hook-events/history?limit=20`)).text();
    expect(historyText).not.toContain(marker);
    expect(historyText.length).toBeLessThan(20_000);
    expect(JSON.parse(historyText)[0]).toMatchObject({
      id: event.id,
      group: 'large-output-worker',
      group_folder: 'large-output-worker',
      has_details: true,
    });

    const detail = await (await fetch(`${baseUrl}/api/hook-events/${event.id}`)).json();
    expect(detail.tool_response).toBe(toolResponse);
  });

  it('replays compact hook events after an SSE cursor without another snapshot', async () => {
    createDashboardTestDb().close();
    const postHook = (message: string) =>
      fetch(`${baseUrl}/api/hook-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: 'cursor-worker',
          event: 'PostToolUse',
          tool: 'Read',
          message,
        }),
      });

    expect((await postHook('first')).status).toBe(200);
    const firstCursor = (await (await fetch(`${baseUrl}/api/state`)).json()).lastHookEventId;
    expect((await postHook('second')).status).toBe(200);

    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/events?snapshot=0&after=${firstCursor}`, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    const reader = res.body!.getReader();
    const [replayed] = await readSSEDataMessages(reader, 1);
    expect(replayed).toMatchObject({
      type: 'hook-event',
      data: {
        group: 'cursor-worker',
        message: 'second',
      },
    });

    controller.abort();
    await reader.cancel().catch(() => {});
  });

  it('fans out compact hook deltas to many viewers without copying large tool output', async () => {
    createDashboardTestDb().close();
    const viewers = await Promise.all(
      Array.from({ length: 50 }, async () => {
        const controller = new AbortController();
        const response = await fetch(`${baseUrl}/api/events?snapshot=0`, {
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        expect(response.status).toBe(200);
        return {
          controller,
          reader: response.body!.getReader(),
        };
      }),
    );

    try {
      const marker = 'fanout-large-hook-output-marker';
      const postResponse = await fetch(`${baseUrl}/api/hook-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: 'fanout-worker',
          event: 'PostToolUse',
          tool: 'TaskOutput',
          message: 'fan-out probe',
          tool_response: `${marker}:${'x'.repeat(512 * 1024)}`,
        }),
      });
      expect(postResponse.status).toBe(200);

      const messages = await Promise.all(viewers.map(({ reader }) => readSSEDataMessages(reader, 1)));
      for (const [message] of messages) {
        expect(message).toMatchObject({
          type: 'hook-event',
          data: {
            group: 'fanout-worker',
            event: 'PostToolUse',
            tool: 'TaskOutput',
            message: 'fan-out probe',
            has_details: true,
          },
        });
        expect(JSON.stringify(message)).not.toContain(marker);
      }

      const healthResponse = await fetch(`${baseUrl}/api/health`);
      expect(healthResponse.status).toBe(200);
    } finally {
      for (const { controller, reader } of viewers) {
        controller.abort();
        await reader.cancel().catch(() => {});
      }
    }
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

    expect(
      (
        await fetch(`${baseUrl}/api/hook-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activePayload),
        })
      ).status,
    ).toBe(200);

    let state = await (await fetch(`${baseUrl}/api/state`)).json();
    let coworker = state.coworkers.find((entry: any) => entry.folder === activePayload.group);
    expect(coworker.status).toBe('working');
    expect(coworker.lastToolUse).toBe('Bash');

    expect(
      (
        await fetch(`${baseUrl}/api/hook-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stopPayload),
        })
      ).status,
    ).toBe(200);

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

    expect(
      (
        await fetch(`${baseUrl}/api/hook-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      ).status,
    ).toBe(200);

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

  // Regression: the right-panel preview used to re-compose the spine without
  // consulting `agent_groups.disable_overlays`, so coworkers with the flag set
  // saw overlay gates in the UI even though their on-disk CLAUDE.md was clean.
  // This test pins that /api/memory reads the flag and threads it through
  // composeCoworkerSpine. We use a coworker_type that doesn't exist in this
  // branch's registry — the compose throws, code falls back to reading the
  // on-disk file — but the key assertion is that the SELECT with the new
  // column succeeds (no 500) AND the fallback path's content is returned.
  it('honors disable_overlays in the composed-memory preview (falls back to on-disk on compose error)', async () => {
    const probeFolder = 'disable-overlays-preview-probe';
    const probeDir = path.join(GROUPS_DIR, probeFolder);
    try {
      const db = createDashboardTestDb();
      db.prepare(
        `INSERT INTO agent_groups (id, name, folder, is_admin, coworker_type, disable_overlays, routing, created_at)
         VALUES ('ag-dop', 'Probe', ?, 0, 'nonexistent-probe-type', 1, 'direct', ?)`,
      ).run(probeFolder, new Date().toISOString());
      db.close();
      forceOpenDbForTests();

      mkdirSync(probeDir, { recursive: true });
      const onDiskContent = 'ON_DISK_FALLBACK_MARKER — no overlay text here\n';
      writeFileSync(path.join(probeDir, 'CLAUDE.md'), onDiskContent, 'utf-8');

      const res = await fetch(`${baseUrl}/api/memory/${probeFolder}`);

      // If the new SELECT column name were wrong, better-sqlite3 would throw
      // and the handler would 500. A 200 here proves the query succeeds.
      expect(res.status).toBe(200);
      const body = await res.text();
      // Compose fails for unknown type → falls back to on-disk file — that
      // content (and only that content) should be returned.
      expect(body).toContain('ON_DISK_FALLBACK_MARKER');
      // Belt-and-suspenders: even if compose did run, the disableOverlays=1
      // contract says no gate bodies appear.
      expect(body).not.toMatch(/MANDATORY gate|CRITIQUE OVERLAY Gate Protocol|PLAN_REVIEW/);
    } finally {
      rmSync(probeDir, { recursive: true, force: true });
    }
  });

  it('enriches cli_command approvals with a command line and resolved target label', async () => {
    const db = createDashboardTestDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS pending_approvals (
        approval_id TEXT PRIMARY KEY, session_id TEXT, request_id TEXT NOT NULL,
        action TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
        agent_group_id TEXT, channel_type TEXT, platform_id TEXT,
        platform_message_id TEXT, expires_at TEXT, status TEXT NOT NULL DEFAULT 'pending',
        title TEXT, options_json TEXT
      );
    `);
    const now = new Date().toISOString();
    // Admin group whose folder the dashboard queries against.
    db.prepare(
      `INSERT INTO agent_groups (id, name, folder, is_admin, routing, created_at)
       VALUES ('ag-orch', 'Orchestrator', 'orch-appr-probe', 1, 'direct', ?)`,
    ).run(now);
    // Two coworker groups + a self-edge a2a wiring between PerfHound and itself.
    db.prepare(
      `INSERT INTO agent_groups (id, name, folder, is_admin, routing, created_at)
       VALUES ('ag-perf', 'PerfHound', 'perfhound-appr-probe', 0, 'direct', ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO messaging_groups (id, channel_type, platform_id, instance, created_at)
       VALUES ('mg-self', 'agent', 'agent:ag-perf:ag-perf', 'agent', ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, session_mode, created_at)
       VALUES ('mga-self', 'mg-self', 'ag-perf', 'per-thread', ?)`,
    ).run(now);
    // The cli_command approval the Orchestrator raised to delete that self-edge.
    db.prepare(
      `INSERT INTO pending_approvals (approval_id, session_id, request_id, action, payload, created_at, agent_group_id, status, title)
       VALUES ('appr-1', 'sess-1', 'req-1', 'cli_command', ?, ?, 'ag-orch', 'pending', 'CLI: wirings-delete')`,
    ).run(
      JSON.stringify({ frame: { id: 'cli-1', command: 'wirings-delete', args: { id: 'mga-self' } } }),
      now,
    );
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/approvals?group=orch-appr-probe`);
    expect(res.status).toBe(200);
    const approvals = await res.json();
    expect(approvals).toHaveLength(1);
    const a = approvals[0];
    expect(a.action).toBe('cli_command');
    expect(a.title).toBe('CLI: wirings-delete');
    expect(a.commandLine).toBe('ncl wirings-delete --id mga-self');
    expect(a.targetLabel).toBe('Deletes wiring: PerfHound → PerfHound (self-edge)');
  });

  it('surfaces critique-gate identity (PR, session, class) instead of dropping it', async () => {
    const db = createDashboardTestDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS pending_approvals (
        approval_id TEXT PRIMARY KEY, session_id TEXT, request_id TEXT NOT NULL,
        action TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
        agent_group_id TEXT, channel_type TEXT, platform_id TEXT,
        platform_message_id TEXT, expires_at TEXT, status TEXT NOT NULL DEFAULT 'pending',
        title TEXT, question TEXT, options_json TEXT
      );
    `);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO agent_groups (id, name, folder, is_admin, routing, created_at)
       VALUES ('ag-orch2', 'Orchestrator', 'orch-crit-probe', 1, 'direct', ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO pending_approvals (approval_id, session_id, request_id, action, payload, created_at, agent_group_id, status, title, question)
       VALUES ('appr-crit', 'sess-crit', 'req-crit', 'critique_gate_bypass', ?, ?, 'ag-orch2', 'pending', 'Critique gate — shader-slang/slang#12186: critique returned must-fix', 'body text')`,
    ).run(
      JSON.stringify({
        sessionId: 'sess-1784687870891-dnkxu6',
        repo: 'shader-slang/slang',
        prNumber: 12186,
        prUrl: 'https://github.com/shader-slang/slang/pull/12186',
        reason: 'OUTPUT_REVIEW last verdict is "must-fix" (must be "approve").',
        hit: 'PR creation',
        class: 'failed',
        denials: 3,
        selfHealAttempts: 0,
      }),
      now,
    );
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/approvals?group=orch-crit-probe`);
    expect(res.status).toBe(200);
    const a = (await res.json())[0];
    expect(a.action).toBe('critique_gate_bypass');
    // Each of these was parsed from the payload and then dropped before.
    expect(a.sessionId).toBe('sess-1784687870891-dnkxu6');
    expect(a.repo).toBe('shader-slang/slang');
    expect(a.prNumber).toBe(12186);
    expect(a.prUrl).toBe('https://github.com/shader-slang/slang/pull/12186');
    expect(a.hit).toBe('PR creation');
    expect(a.escalationClass).toBe('failed');
    expect(a.denials).toBe(3);
    // The authored card body was persisted but never surfaced.
    expect(a.question).toBe('body text');
  });

  it('summarizes critique escalations, and reports enforcement releases separately', async () => {
    const db = createDashboardTestDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS critique_escalation_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL,
        agent_group_id TEXT, approval_id TEXT, event TEXT NOT NULL, class TEXT,
        reason TEXT, hit TEXT, repo TEXT, pr_number INTEGER, attempt INTEGER,
        created_at TEXT NOT NULL, requested_at INTEGER
      );
    `);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO agent_groups (id, name, folder, is_admin, routing, created_at)
       VALUES ('ag-fixer', 'slang-fixer', 'fixer-esc-probe', 0, 'direct', ?)`,
    ).run(now);
    const ins = db.prepare(
      `INSERT INTO critique_escalation_events (session_id, agent_group_id, event, class, created_at)
       VALUES ('sess-e', 'ag-fixer', ?, ?, ?)`,
    );
    ins.run('self_heal', 'missing', now);
    ins.run('self_heal', 'stale', now);
    ins.run('self_healed', 'missing', now);
    ins.run('carded', 'failed', now);
    ins.run('approved', 'failed', now);
    ins.run('failed_open', 'missing', now);
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/approvals/escalations?days=7`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(7);
    const totals = Object.fromEntries(body.totals.map((t: { event: string; n: number }) => [t.event, t.n]));
    expect(totals.self_heal).toBe(2);
    expect(totals.carded).toBe(1);
    // approved + failed_open are the two events that admitted a delivery with
    // the requirement unmet; they must never be buried in a total.
    expect(body.released).toBe(2);
    expect(body.byDay.some((r: { coworker: string }) => r.coworker === 'slang-fixer')).toBe(true);
  });

  it('returns an empty escalation summary when the host has no events table', async () => {
    const db = createDashboardTestDb();
    db.exec('DROP TABLE IF EXISTS critique_escalation_events;');
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/approvals/escalations`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals).toEqual([]);
    expect(body.released).toBe(0);
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

    expect(
      (
        await fetch(`${baseUrl}/api/hook-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(startPayload),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/hook-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toolPayload),
        })
      ).status,
    ).toBe(200);

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

    expect(
      (
        await fetch(`${baseUrl}/api/hook-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stopPayload),
        })
      ).status,
    ).toBe(200);

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

  it('creates an auth session cookie that works for state and SSE when DASHBOARD_SECRET is set', async () => {
    process.env.DASHBOARD_SECRET = 'test-secret-123';
    try {
      const statusRes = await fetch(`${baseUrl}/api/auth/status`);
      expect(statusRes.status).toBe(200);
      expect(await statusRes.json()).toEqual({ required: true, authenticated: false });

      const loginRes = await fetch(`${baseUrl}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'test-secret-123' }),
      });
      expect(loginRes.status).toBe(200);
      const cookie = loginRes.headers.get('set-cookie');
      expect(cookie).toContain('nanoclaw_dashboard_auth=');

      const authedStatusRes = await fetch(`${baseUrl}/api/auth/status`, {
        headers: { Cookie: cookie! },
      });
      expect(await authedStatusRes.json()).toEqual({ required: true, authenticated: true });

      const stateRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Cookie: cookie! },
      });
      expect(stateRes.status).toBe(200);

      const eventsRes = await fetch(`${baseUrl}/api/events`, {
        headers: { Cookie: cookie!, Accept: 'text/event-stream' },
      });
      expect(eventsRes.status).toBe(200);
      expect(eventsRes.headers.get('content-type')).toContain('text/event-stream');
      await eventsRes.body?.cancel();
    } finally {
      delete process.env.DASHBOARD_SECRET;
    }
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

  it('forwards chat sends to the host dashboard ingress', async () => {
    const db = createDashboardTestDb();
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-dashboard-team', 'Dashboard Team Test', 'dashboard-team-test', new Date().toISOString());
    db.close();

    const { server: stub, baseUrl: ingressBaseUrl } = await startIngressStub((req, res) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/api/dashboard/inbound');
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        expect(JSON.parse(body)).toEqual({ group: 'dashboard-team-test', content: 'hello bridge', thread_id: null });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    });

    process.env.DASHBOARD_INGRESS_PORT = ingressBaseUrl.split(':').pop()!;
    try {
      const res = await fetch(`${baseUrl}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: 'dashboard-team-test', content: 'hello bridge' }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    } finally {
      delete process.env.DASHBOARD_INGRESS_PORT;
      await new Promise<void>((resolve, reject) => {
        stub.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });

  it('surfaces host dashboard ingress failures to the browser', async () => {
    const db = createDashboardTestDb();
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-dashboard-team', 'Dashboard Team Test', 'dashboard-team-test', new Date().toISOString());
    db.close();

    const { server: stub, baseUrl: ingressBaseUrl } = await startIngressStub((_req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end('{"error":"Dashboard channel adapter not ready"}');
    });

    process.env.DASHBOARD_INGRESS_PORT = ingressBaseUrl.split(':').pop()!;
    try {
      const res = await fetch(`${baseUrl}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: 'dashboard-team-test', content: 'hello bridge' }),
      });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'Dashboard channel adapter not ready' });
    } finally {
      delete process.env.DASHBOARD_INGRESS_PORT;
      await new Promise<void>((resolve, reject) => {
        stub.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });

  it('rejects invalid dashboard auth session secrets', async () => {
    process.env.DASHBOARD_SECRET = 'test-secret-123';
    try {
      const res = await fetch(`${baseUrl}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'wrong-secret' }),
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'invalid dashboard secret' });
    } finally {
      delete process.env.DASHBOARD_SECRET;
    }
  });

  it('uses the project-local MCP management token for server restart actions', async () => {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(path.join(DATA_DIR, '.mcp-management-token'), 'project-local-token', 'utf-8');
    process.env.MCP_PROXY_PORT = '3100';

    const realFetch = globalThis.fetch;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (typeof input === 'string' && input.startsWith('http://172.17.0.1:3100/servers/restart')) {
        let auth: string | null | undefined;
        if (init && typeof init === 'object') {
          const headers = init.headers;
          if (headers instanceof Headers) auth = headers.get('Authorization');
          else if (Array.isArray(headers)) auth = headers.find(([k]) => k === 'Authorization')?.[1];
          else auth = headers ? (headers as Record<string, string>).Authorization : undefined;
        }
        return Promise.resolve(
          new Response(
            JSON.stringify(auth === 'Bearer project-local-token' ? { ok: true } : { error: 'Unauthorized' }),
            {
              status: auth === 'Bearer project-local-token' ? 200 : 401,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }
      return realFetch(input, init);
    });

    try {
      const res = await fetch(`${baseUrl}/api/mcp-control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart', name: 'deepwiki' }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://172.17.0.1:3100/servers/restart?name=deepwiki',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer project-local-token' },
        }),
      );
    } finally {
      fetchSpy.mockRestore();
      delete process.env.MCP_PROXY_PORT;
    }
  });

  it('ensureDashboardChatWiring creates the dashboard reply ACL and is idempotent', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE messaging_groups (
        id TEXT PRIMARY KEY,
        channel_type TEXT NOT NULL,
        platform_id TEXT NOT NULL,
        instance TEXT NOT NULL,
        name TEXT,
        is_group INTEGER NOT NULL DEFAULT 0,
        unknown_sender_policy TEXT DEFAULT 'strict',
        created_at TEXT NOT NULL,
        UNIQUE(channel_type, platform_id, instance)
      );
      CREATE TABLE messaging_group_agents (
        id TEXT PRIMARY KEY,
        messaging_group_id TEXT NOT NULL,
        agent_group_id TEXT NOT NULL,
        engage_mode TEXT,
        engage_pattern TEXT,
        sender_scope TEXT NOT NULL DEFAULT 'all',
        ignored_message_policy TEXT DEFAULT 'drop',
        session_mode TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE agent_destinations (
        agent_group_id TEXT NOT NULL,
        local_name TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (agent_group_id, local_name)
      );
    `);

    const group = { id: 'ag-reviewer', folder: 'reviewer', name: 'Reviewer' };
    const now = '2026-04-14T00:00:00.000Z';

    const first = ensureDashboardChatWiring(db, group, '@Reviewer', now);
    const mg = db.prepare('SELECT * FROM messaging_groups').get() as any;
    const mga = db.prepare('SELECT * FROM messaging_group_agents').get() as any;
    const dest = db.prepare('SELECT * FROM agent_destinations').get() as any;

    expect(first.messagingGroupId).toBe(mg.id);
    expect(mg.platform_id).toBe('dashboard:reviewer');
    expect(mga.engage_mode).toBe('always');
    expect(mga.engage_pattern).toBe('@Reviewer');
    expect(mga.sender_scope).toBe('all');
    expect(dest.target_type).toBe('channel');
    expect(dest.target_id).toBe(mg.id);

    ensureDashboardChatWiring(db, group, '@Reviewer', now);
    expect((db.prepare('SELECT COUNT(*) AS c FROM messaging_groups').get() as any).c).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS c FROM messaging_group_agents').get() as any).c).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS c FROM agent_destinations').get() as any).c).toBe(1);

    db.close();
  });

  it('resolves composite coworker type metadata by merging role descriptions and MCP tools', () => {
    const meta = resolveCoworkerTypeMetadata('slang-ir+slang-backend', {
      'slang-ir': {
        description: 'IR work',
        allowedMcpTools: ['mcp__slang__inspect_ir'],
      },
      'slang-backend': {
        description: 'Backend work',
        allowedMcpTools: ['mcp__slang__build_backend', 'mcp__slang__inspect_ir'],
      },
    });

    expect(meta.known).toBe(true);
    expect(meta.description).toBe('IR work + Backend work');
    expect(meta.allowedMcpTools.sort()).toEqual(['mcp__slang__build_backend', 'mcp__slang__inspect_ir']);
  });

  it('auto-provisions dashboard chat wiring for existing coworkers before forwarding chat', async () => {
    const db = createDashboardTestDb();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-existing', 'Existing Worker', 'existing-worker', now);
    db.close();

    const { server: stub, baseUrl: ingressBaseUrl } = await startIngressStub((req, res) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/api/dashboard/inbound');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });

    process.env.DASHBOARD_INGRESS_PORT = ingressBaseUrl.split(':').pop()!;
    try {
      const res = await fetch(`${baseUrl}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: 'existing-worker', content: 'hello bridge' }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });

      const verifyDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
      const mg = verifyDb
        .prepare("SELECT id FROM messaging_groups WHERE channel_type = 'dashboard' AND platform_id = ?")
        .get('dashboard:existing-worker') as any;
      const mga = verifyDb
        .prepare('SELECT id FROM messaging_group_agents WHERE messaging_group_id = ? AND agent_group_id = ?')
        .get(mg.id, 'ag-existing') as any;
      const dest = verifyDb
        .prepare(
          "SELECT local_name FROM agent_destinations WHERE agent_group_id = ? AND target_type = 'channel' AND target_id = ?",
        )
        .get('ag-existing', mg.id) as any;

      expect(mg).toBeTruthy();
      expect(mga).toBeTruthy();
      expect(dest).toBeTruthy();
      verifyDb.close();
    } finally {
      delete process.env.DASHBOARD_INGRESS_PORT;
      await new Promise<void>((resolve, reject) => {
        stub.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });

  it('direct-routing coworker is bound to admin messaging group AND its own dashboard tab', async () => {
    const db = createDashboardTestDb();
    const now = new Date().toISOString();
    // Seed admin + admin's dashboard messaging group + the binding row, so
    // the lookup `WHERE ag.is_admin = 1 AND mg.channel_type = 'dashboard'`
    // resolves.
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 1, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-admin', 'Orchestrator', 'orchestrator', now);
    db.prepare(
      "INSERT INTO messaging_groups (id, channel_type, platform_id, instance, name, is_group, unknown_sender_policy, created_at) VALUES ('mg-admin', 'dashboard', 'dashboard:orchestrator', 'dashboard', 'Orchestrator', 0, 'public', ?)",
    ).run(now);
    db.prepare(
      "INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, session_mode, priority, created_at) VALUES ('mga-admin', 'mg-admin', 'ag-admin', 'always', '@Orchestrator', 'all', 'shared', 0, ?)",
    ).run(now);
    db.close();

    const res = await fetch(`${baseUrl}/api/coworkers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Review Bot',
        folder: 'review-bot',
        trigger: '@ReviewBot',
        // routing defaults to 'direct'
      }),
    });
    expect(res.status).toBe(201);
    const created = await res.json();

    const verifyDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    // The new coworker should have BOTH wirings:
    //   1. its own dashboard messaging group (dashboard:review-bot)
    //   2. a row in admin's messaging group with @reviewbot engage pattern
    const ownMg = verifyDb
      .prepare("SELECT id FROM messaging_groups WHERE platform_id = 'dashboard:review-bot' AND channel_type = 'dashboard'")
      .get() as { id: string } | undefined;
    expect(ownMg, 'direct routing must give the coworker its own dashboard tab').toBeTruthy();
    const ownMembership = verifyDb
      .prepare('SELECT 1 FROM messaging_group_agents WHERE messaging_group_id = ? AND agent_group_id = ?')
      .get(ownMg!.id, created.id);
    expect(ownMembership, 'coworker must be a member of its own dashboard mg').toBeTruthy();

    const adminMembership = verifyDb
      .prepare(
        "SELECT engage_mode, engage_pattern FROM messaging_group_agents WHERE messaging_group_id = 'mg-admin' AND agent_group_id = ?",
      )
      .get(created.id) as { engage_mode: string; engage_pattern: string } | undefined;
    expect(adminMembership, 'coworker must also be bound into admin mg so orchestrator can see it').toBeTruthy();
    expect(adminMembership!.engage_mode).toBe('pattern');
    expect(adminMembership!.engage_pattern).toBe('@review-bot\\b');
    verifyDb.close();
  });

  it('persists the sidebar group: a user id is stored, "prod" is normalized to NULL', async () => {
    createDashboardTestDb().close();

    // Scoped to a specific user → stored verbatim.
    const scoped = await fetch(`${baseUrl}/api/coworkers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User One Bot', folder: 'user-one-bot', group: 'dashboard:user1' }),
    });
    expect(scoped.status).toBe(201);
    const scopedCreated = await scoped.json();

    // Shared prod group (and the default) → NULL.
    const prod = await fetch(`${baseUrl}/api/coworkers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Prod Bot', folder: 'prod-bot', group: 'prod' }),
    });
    expect(prod.status).toBe(201);
    const prodCreated = await prod.json();

    const verifyDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    const scopedRow = verifyDb
      .prepare('SELECT sidebar_group FROM agent_groups WHERE id = ?')
      .get(scopedCreated.id) as { sidebar_group: string | null };
    const prodRow = verifyDb
      .prepare('SELECT sidebar_group FROM agent_groups WHERE id = ?')
      .get(prodCreated.id) as { sidebar_group: string | null };
    verifyDb.close();

    expect(scopedRow.sidebar_group).toBe('dashboard:user1');
    expect(prodRow.sidebar_group).toBeNull();
  });

  it('creates coworker with parent↔child agent wiring when an admin group exists', async () => {
    const db = createDashboardTestDb();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 1, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-admin', 'Main', 'main', now);
    db.close();

    const res = await fetch(`${baseUrl}/api/coworkers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Review Bot',
        folder: 'review-bot',
        trigger: '@ReviewBot',
      }),
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.ok).toBe(true);
    expect(created.id).toBeTruthy();

    const verifyDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    const adminToChild = verifyDb
      .prepare(
        "SELECT local_name, target_type FROM agent_destinations WHERE agent_group_id = ? AND target_type = 'agent' AND target_id = ?",
      )
      .get('ag-admin', created.id) as any;
    const childToAdmin = verifyDb
      .prepare(
        "SELECT local_name, target_type FROM agent_destinations WHERE agent_group_id = ? AND target_type = 'agent' AND target_id = ?",
      )
      .get(created.id, 'ag-admin') as any;
    const childChannelDest = verifyDb
      .prepare("SELECT local_name FROM agent_destinations WHERE agent_group_id = ? AND target_type = 'channel'")
      .get(created.id) as any;
    verifyDb.close();

    expect(adminToChild).toBeTruthy();
    expect(adminToChild.target_type).toBe('agent');
    expect(childToAdmin).toBeTruthy();
    expect(childToAdmin.target_type).toBe('agent');
    expect(childToAdmin.local_name).toMatch(/^parent(?:-\d+)?$/);
    expect(childChannelDest).toBeTruthy();
  });

  it('imports destinations with a renamed alias when the imported name collides with auto-wired dashboard chat', async () => {
    const db = createDashboardTestDb();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-peer', 'Peer Worker', 'peer-worker', now);
    db.close();

    const bundle = {
      version: 3,
      agent: {
        name: 'Reviewer',
        folder: 'import-collision-reviewer',
        coworkerType: null,
        allowedMcpTools: null,
        agentProvider: null,
        containerConfig: null,
      },
      trigger: '@Reviewer',
      destinations: [{ name: 'reviewer-dashboard', type: 'agent', targetFolder: 'peer-worker' }],
    };

    const res = await fetch(`${baseUrl}/api/coworkers/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(bundle),
    });
    expect(res.status).toBe(201);

    const result = await res.json();
    expect(result.ok).toBe(true);
    expect(result.destsCreated).toBe(1);
    expect(result.resolvedDests).toEqual([
      expect.objectContaining({
        name: 'reviewer-dashboard-2',
        type: 'agent',
        resolvedTo: expect.stringContaining('peer-worker'),
      }),
    ]);
    expect(result.warnings).toContain(
      'Destination "reviewer-dashboard" renamed to "reviewer-dashboard-2" to avoid name collision',
    );

    const verifyDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    const importedGroup = verifyDb
      .prepare('SELECT id FROM agent_groups WHERE folder = ?')
      .get('import-collision-reviewer') as any;
    const destinations = verifyDb
      .prepare('SELECT local_name, target_type FROM agent_destinations WHERE agent_group_id = ? ORDER BY local_name')
      .all(importedGroup.id) as any[];
    verifyDb.close();

    expect(destinations).toEqual([
      expect.objectContaining({ local_name: 'reviewer-dashboard', target_type: 'channel' }),
      expect.objectContaining({ local_name: 'reviewer-dashboard-2', target_type: 'agent' }),
    ]);
  });

  it('blocks hidden path components during import but still imports safe files', async () => {
    createDashboardTestDb().close();

    const bundle = {
      version: 3,
      agent: {
        name: 'Hidden Path Reviewer',
        folder: 'hidden-path-reviewer',
        coworkerType: null,
        allowedMcpTools: null,
        agentProvider: null,
        containerConfig: null,
      },
      instructions: 'Review only the visible files.',
      files: {
        '.ssh/config': 'Host *',
        'notes/.secret': 'classified',
        'notes/report.md': '# safe',
      },
    };

    const res = await fetch(`${baseUrl}/api/coworkers/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(bundle),
    });
    expect(res.status).toBe(201);

    const result = await res.json();
    expect(result.ok).toBe(true);
    expect(result.filesWritten).toBe(1);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Blocked file: ".ssh/config" (hidden path component)',
        'Blocked file: "notes/.secret" (hidden path component)',
      ]),
    );

    expect(existsSync(path.join(HIDDEN_PATH_GROUP_DIR, 'notes', 'report.md'))).toBe(true);
    expect(existsSync(path.join(HIDDEN_PATH_GROUP_DIR, '.ssh', 'config'))).toBe(false);
    expect(existsSync(path.join(HIDDEN_PATH_GROUP_DIR, 'notes', '.secret'))).toBe(false);
  });

  it('exports YAML bundles with instruction template metadata (config only, no runtime files)', async () => {
    const db = createDashboardTestDb();
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-export', 'Export Probe', 'export-warning-probe', new Date().toISOString());
    db.close();

    mkdirSync(path.join(EXPORT_PROBE_GROUP_DIR, 'reports'), { recursive: true });
    writeFileSync(path.join(EXPORT_PROBE_GROUP_DIR, '.instructions.md'), 'Export me\n', 'utf-8');
    writeFileSync(
      path.join(EXPORT_PROBE_GROUP_DIR, '.instruction-meta.json'),
      JSON.stringify({ template: 'code-reviewer' }),
    );
    writeFileSync(path.join(EXPORT_PROBE_GROUP_DIR, 'notes.md'), '# notes\n', 'utf-8');

    const res = await fetch(`${baseUrl}/api/coworkers/export-warning-probe/export`);
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.ok).toBe(true);
    expect(result.path).toBeDefined();

    const jsYaml = await import('js-yaml');
    const bundle = jsYaml.load(readFileSync(result.path, 'utf-8')) as any;
    expect(bundle.mode).toBe('standard');
    expect(bundle.instructionTemplate).toBe('code-reviewer');
    expect(bundle.instructions).toBe('Export me\n');
    // Export only includes config — no runtime files
    expect(bundle.files).toBeUndefined();
    expect(bundle.exportWarnings).toBeUndefined();
  });

  it('lightweight export omits instructions and memory so the new instance rehydrates from the local lego registry', async () => {
    const db = createDashboardTestDb();
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-light', 'Lightweight Probe', 'export-warning-probe', new Date().toISOString());
    db.close();

    mkdirSync(EXPORT_PROBE_GROUP_DIR, { recursive: true });
    writeFileSync(path.join(EXPORT_PROBE_GROUP_DIR, '.instructions.md'), 'Should not appear\n', 'utf-8');
    writeFileSync(
      path.join(EXPORT_PROBE_GROUP_DIR, '.instruction-meta.json'),
      JSON.stringify({ template: 'code-reviewer' }),
    );

    // Also seed memory — it should also be excluded in lightweight mode
    const memDir = path.join(
      DATA_DIR,
      'v2-sessions',
      'ag-light',
      '.claude-shared',
      'projects',
      '-workspace-agent',
      'memory',
    );
    mkdirSync(memDir, { recursive: true });
    writeFileSync(path.join(memDir, 'user.md'), '# Memory should not appear\n', 'utf-8');

    const res = await fetch(`${baseUrl}/api/coworkers/export-warning-probe/export?mode=lightweight`);
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.ok).toBe(true);

    const jsYaml = await import('js-yaml');
    const bundle = jsYaml.load(readFileSync(result.path, 'utf-8')) as any;
    expect(bundle.mode).toBe('lightweight');
    expect(bundle.instructionTemplate).toBe('code-reviewer');
    // Lightweight bundles strip user-specific payload so re-imports rehydrate from the type
    expect(bundle.instructions).toBeUndefined();
    expect(bundle.memory).toBeUndefined();
    // Metadata still present
    expect(bundle.agent?.folder).toBe('export-warning-probe');
    expect(bundle.version).toBe(3);
  });

  it('round-trips .instructions.md via top-level instructions without hidden-path warnings', async () => {
    const db = createDashboardTestDb();
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-roundtrip', 'Roundtrip Export Probe', 'roundtrip-export-probe', new Date().toISOString());
    db.close();

    mkdirSync(ROUNDTRIP_SOURCE_GROUP_DIR, { recursive: true });
    writeFileSync(path.join(ROUNDTRIP_SOURCE_GROUP_DIR, '.instructions.md'), 'Line one\nLine two\n', 'utf-8');
    writeFileSync(path.join(ROUNDTRIP_SOURCE_GROUP_DIR, 'notes.md'), '# hello\n', 'utf-8');

    const exportRes = await fetch(`${baseUrl}/api/coworkers/roundtrip-export-probe/export`);
    expect(exportRes.status).toBe(200);
    const exportResult = await exportRes.json();
    expect(exportResult.ok).toBe(true);
    const jsYaml = await import('js-yaml');
    const exportedBundle = jsYaml.load(readFileSync(exportResult.path, 'utf-8')) as any;
    expect(exportedBundle.instructions).toContain('Line one');
    // Config-only export: no files map
    expect(exportedBundle.files).toBeUndefined();

    exportedBundle.agent.name = 'Roundtrip Imported Probe';
    exportedBundle.agent.folder = 'roundtrip-imported-probe';
    const importRes = await fetch(`${baseUrl}/api/coworkers/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(exportedBundle),
    });
    expect(importRes.status).toBe(201);
    const importResult = await importRes.json();
    expect(importResult.ok).toBe(true);
    expect((importResult.warnings || []).some((w: string) => w.includes('Blocked file: ".instructions.md"'))).toBe(
      false,
    );
    expect(existsSync(path.join(ROUNDTRIP_IMPORTED_GROUP_DIR, '.instructions.md'))).toBe(true);
    expect(readFileSync(path.join(ROUNDTRIP_IMPORTED_GROUP_DIR, '.instructions.md'), 'utf-8')).toContain('Line one');
  });

  it('full archive export saves to data/exports/ and includes .git dirs', async () => {
    const db = createDashboardTestDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, agent_group_id TEXT NOT NULL, messaging_group_id TEXT,
        thread_id TEXT, agent_provider TEXT, status TEXT DEFAULT 'active',
        container_status TEXT DEFAULT 'stopped', last_active TEXT, created_at TEXT NOT NULL
      );
    `);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, 0, ?)').run(
      'ag-archive',
      'Archive Probe',
      'archive-probe',
      now,
    );
    db.prepare('INSERT INTO sessions (id, agent_group_id, status, created_at) VALUES (?, ?, ?, ?)').run(
      'sess-archive',
      'ag-archive',
      'active',
      now,
    );
    db.close();

    // Create group dir with a .git subdirectory (should NOT be excluded)
    const archiveGroupDir = path.join(GROUPS_DIR, 'archive-probe');
    mkdirSync(path.join(archiveGroupDir, '.git', 'refs'), { recursive: true });
    writeFileSync(path.join(archiveGroupDir, '.instructions.md'), 'Test archive\n');
    writeFileSync(path.join(archiveGroupDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(path.join(archiveGroupDir, '.git', 'refs', 'heads'), 'abc123\n');

    // Create session dir with inbound.db
    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-archive', 'sess-archive');
    mkdirSync(sessDir, { recursive: true });
    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec(
      'CREATE TABLE messages_in (id TEXT PRIMARY KEY, seq INTEGER, kind TEXT, timestamp TEXT, status TEXT, content TEXT, process_after TEXT, recurrence TEXT)',
    );
    inDb.close();

    const res = await fetch(`${baseUrl}/api/coworkers/archive-probe/export?full=true`);
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.ok).toBe(true);
    expect(result.path).toContain('data/exports/');
    expect(result.path).toContain('-full.tar.gz');
    expect(result.size).toBeGreaterThan(0);
    expect(existsSync(result.path)).toBe(true);

    // Verify .git files are in the archive
    const { execSync } = await import('child_process');
    const listing = execSync(`tar tzf "${result.path}"`).toString();
    expect(listing).toContain('group-files/.git/HEAD');

    // Cleanup
    rmSync(archiveGroupDir, { recursive: true, force: true });
  });

  it('v1 import backfills chat messages from v1 messages table', async () => {
    const db = createDashboardTestDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, agent_group_id TEXT NOT NULL, messaging_group_id TEXT,
        thread_id TEXT, agent_provider TEXT, status TEXT DEFAULT 'active',
        container_status TEXT DEFAULT 'stopped', last_active TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pending_approvals (
        approval_id TEXT PRIMARY KEY, session_id TEXT, request_id TEXT NOT NULL,
        action TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
        agent_group_id TEXT, channel_type TEXT, platform_id TEXT,
        platform_message_id TEXT, expires_at TEXT, status TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE IF NOT EXISTS pending_credentials (
        id TEXT PRIMARY KEY, agent_group_id TEXT NOT NULL, session_id TEXT,
        name TEXT NOT NULL, type TEXT NOT NULL, host_pattern TEXT NOT NULL,
        path_pattern TEXT, header_name TEXT, value_format TEXT, description TEXT,
        channel_type TEXT NOT NULL, platform_id TEXT NOT NULL,
        platform_message_id TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
      );
    `);
    db.close();

    // Create a mock v1 instance under the configured import root.
    const v1Root = path.join(V1_IMPORT_ROOT, '.nanoclaw-test-v1-' + Date.now());
    const v1Folder = 'dashboard_test-agent';
    mkdirSync(path.join(v1Root, 'groups', v1Folder), { recursive: true });
    mkdirSync(path.join(v1Root, 'groups', 'global'), { recursive: true });
    mkdirSync(path.join(v1Root, 'store'), { recursive: true });

    // Write CLAUDE.md (instructions)
    writeFileSync(path.join(v1Root, 'groups', v1Folder, 'CLAUDE.md'), '# Test Agent\n\nYou are a test agent.\n');
    writeFileSync(path.join(v1Root, 'groups', 'global', 'CLAUDE.md'), '# Andy\n\nBase template.\n');

    // Create v1 store/messages.db with registered_groups + messages
    const sdb = new Database(path.join(v1Root, 'store', 'messages.db'));
    sdb.exec(`
      CREATE TABLE registered_groups (
        folder TEXT PRIMARY KEY, name TEXT, trigger_pattern TEXT,
        coworker_type TEXT, allowed_mcp_tools TEXT, container_config TEXT
      );
      CREATE TABLE sessions (
        group_folder TEXT PRIMARY KEY, session_id TEXT
      );
      CREATE TABLE scheduled_tasks (
        id TEXT PRIMARY KEY, group_folder TEXT, prompt TEXT, script TEXT,
        schedule_type TEXT, schedule_value TEXT, next_run TEXT, status TEXT
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY, chat_jid TEXT, content TEXT, timestamp TEXT,
        is_from_me INTEGER, is_bot_message INTEGER, sender TEXT, sender_name TEXT
      );
    `);
    sdb
      .prepare('INSERT INTO registered_groups VALUES (?, ?, ?, NULL, NULL, NULL)')
      .run(v1Folder, 'Test Agent', '@TestAgent');
    sdb.prepare('INSERT INTO sessions VALUES (?, ?)').run(v1Folder, 'v1-sess-abc');
    // Insert 4 messages: 2 inbound (user), 2 outbound (bot)
    sdb
      .prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('msg-1', 'dashboard:test-agent', 'Hello agent', '2026-04-01T10:00:00Z', 0, 0, 'web@dashboard', 'User');
    sdb
      .prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('msg-2', 'dashboard:test-agent', 'Hi there!', '2026-04-01T10:00:05Z', 1, 1, null, 'Test Agent');
    sdb
      .prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('msg-3', 'dashboard:test-agent', 'Fix the bug', '2026-04-01T11:00:00Z', 0, 0, 'web@dashboard', 'User');
    sdb
      .prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('msg-4', 'dashboard:test-agent', 'Done, bug fixed.', '2026-04-01T11:05:00Z', 1, 1, null, 'Test Agent');
    sdb.close();

    // Call v1 import
    const res = await fetch(`${baseUrl}/api/coworkers/import-v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ v1Path: v1Root, folder: v1Folder }),
    });
    expect(res.status).toBe(201);
    const result = await res.json();
    expect(result.ok).toBe(true);
    expect(result.name).toBe('Test Agent');
    expect(result.sessionsRestored).toBe(1);

    // Verify chat messages were backfilled into session DBs
    const agId = result.id;
    const agSessDir = path.join(DATA_DIR, 'v2-sessions', agId);
    const sessDirs = require('fs')
      .readdirSync(agSessDir)
      .filter((d: string) => d.startsWith('sess-'));
    expect(sessDirs.length).toBe(1);

    const inDbPath = path.join(agSessDir, sessDirs[0], 'inbound.db');
    const outDbPath = path.join(agSessDir, sessDirs[0], 'outbound.db');
    expect(existsSync(inDbPath)).toBe(true);
    expect(existsSync(outDbPath)).toBe(true);

    const inDb = new Database(inDbPath, { readonly: true });
    const inRows = inDb.prepare("SELECT * FROM messages_in WHERE kind = 'chat'").all() as any[];
    expect(inRows.length).toBe(2); // 2 user messages
    expect(inRows[0].id).toBe('msg-1');
    expect(inRows[1].id).toBe('msg-3');
    inDb.close();

    const outDb = new Database(outDbPath, { readonly: true });
    const outRows = outDb.prepare("SELECT * FROM messages_out WHERE kind = 'chat'").all() as any[];
    expect(outRows.length).toBe(2); // 2 bot messages
    expect(outRows[0].id).toBe('msg-2');
    expect(outRows[1].id).toBe('msg-4');
    outDb.close();

    // Verify instructions were extracted
    const importedGroupDir = path.join(GROUPS_DIR, v1Folder);
    expect(existsSync(path.join(importedGroupDir, '.instructions.md'))).toBe(true);

    // Cleanup
    rmSync(importedGroupDir, { recursive: true, force: true });
    rmSync(v1Root, { recursive: true, force: true });
  });

  // ── /api/hook-events/sessions — nanoclaw session as primary, SDK UUIDs as sub-sessions ──
  describe('/api/hook-events/sessions — nested nanoclaw/SDK shape', () => {
    function seedHookEventsSchema(db: Database.Database): void {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          agent_group_id TEXT NOT NULL,
          messaging_group_id TEXT,
          thread_id TEXT,
          agent_provider TEXT,
          status TEXT DEFAULT 'active',
          container_status TEXT DEFAULT 'stopped',
          last_active TEXT,
          created_at TEXT NOT NULL
        );
      `);
    }

    function insertHookEvent(
      db: Database.Database,
      row: {
        group_folder: string;
        event: string;
        session_id: string;
        timestamp: number;
        tool?: string;
        extra?: any;
      },
    ) {
      db.prepare(
        `INSERT INTO hook_events (group_folder, event, tool, session_id, extra, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        row.group_folder,
        row.event,
        row.tool ?? null,
        row.session_id,
        row.extra ? JSON.stringify(row.extra) : null,
        row.timestamp,
      );
    }

    it('nests SDK sub-sessions under the active nanoclaw v2 session and classifies shapes', async () => {
      const db = createDashboardTestDb();
      seedHookEventsSchema(db);
      const now = Date.now();
      const createdAt = new Date(now - 86400000).toISOString();

      // One agent_group + one ACTIVE nanoclaw session (the primary identity).
      db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, 0, ?)').run(
        'ag-forger',
        'Forger',
        'nanoclaw-forger',
        createdAt,
      );
      db.prepare(
        `INSERT INTO sessions (id, agent_group_id, status, container_status, last_active, created_at)
         VALUES (?, ?, 'active', 'running', ?, ?)`,
      ).run('sess-forger', 'ag-forger', new Date(now - 10000).toISOString(), createdAt);

      // Three SDK sub-sessions with varying shapes:
      //   main — heavy, source=startup, includes a UserPromptSubmit
      //   task-fire — heavy, source=resume, includes a UserPromptSubmit
      //   ghost — 2 events, no UserPromptSubmit
      insertHookEvent(db, {
        group_folder: 'nanoclaw-forger',
        event: 'SessionStart',
        session_id: 'sdk-main',
        timestamp: now - 60000,
        extra: { source: 'startup' },
      });
      insertHookEvent(db, {
        group_folder: 'nanoclaw-forger',
        event: 'UserPromptSubmit',
        session_id: 'sdk-main',
        timestamp: now - 59000,
      });
      for (let i = 0; i < 45; i++) {
        insertHookEvent(db, {
          group_folder: 'nanoclaw-forger',
          event: 'PostToolUse',
          tool: 'Read',
          session_id: 'sdk-main',
          timestamp: now - 50000 + i,
        });
      }

      insertHookEvent(db, {
        group_folder: 'nanoclaw-forger',
        event: 'SessionStart',
        session_id: 'sdk-task',
        timestamp: now - 30000,
        extra: { source: 'resume' },
      });
      insertHookEvent(db, {
        group_folder: 'nanoclaw-forger',
        event: 'UserPromptSubmit',
        session_id: 'sdk-task',
        timestamp: now - 29000,
      });
      for (let i = 0; i < 45; i++) {
        insertHookEvent(db, {
          group_folder: 'nanoclaw-forger',
          event: 'PostToolUse',
          tool: 'Bash',
          session_id: 'sdk-task',
          timestamp: now - 20000 + i,
        });
      }

      insertHookEvent(db, {
        group_folder: 'nanoclaw-forger',
        event: 'SessionStart',
        session_id: 'sdk-ghost',
        timestamp: now - 15000,
        extra: { source: 'startup' },
      });
      insertHookEvent(db, {
        group_folder: 'nanoclaw-forger',
        event: 'InstructionsLoaded',
        session_id: 'sdk-ghost',
        timestamp: now - 14999,
      });

      db.close();

      const res = await fetch(`${baseUrl}/api/hook-events/sessions`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      expect(Array.isArray(body)).toBe(true);

      const forger = body.find((p: any) => p.group_folder === 'nanoclaw-forger');
      expect(forger).toBeDefined();
      expect(forger.nanoclaw_session_id).toBe('sess-forger');
      expect(forger.agent_group_id).toBe('ag-forger');
      expect(forger.container_status).toBe('running');
      // event_count_total spans all SDK sub-sessions.
      expect(forger.event_count_total).toBeGreaterThanOrEqual(45 * 2 + 2); // at least the tool-use batches + prompts
      expect(Array.isArray(forger.sdk_subsessions)).toBe(true);
      expect(forger.sdk_subsessions.length).toBe(3);

      // Sub-sessions sorted DESC by last_ts — task-fire most recent, ghost older, main oldest.
      for (let i = 1; i < forger.sdk_subsessions.length; i++) {
        expect(forger.sdk_subsessions[i - 1].last_ts).toBeGreaterThanOrEqual(forger.sdk_subsessions[i].last_ts);
      }

      const main = forger.sdk_subsessions.find((s: any) => s.session_id === 'sdk-main');
      const task = forger.sdk_subsessions.find((s: any) => s.session_id === 'sdk-task');
      const ghost = forger.sdk_subsessions.find((s: any) => s.session_id === 'sdk-ghost');
      expect(main.shape).toBe('main');
      expect(task.shape).toBe('task-fire');
      expect(ghost.shape).toBe('ghost');
    });

    it('classifies a session with only InstructionsLoaded events (no UserPromptSubmit) as "ghost"', async () => {
      const db = createDashboardTestDb();
      seedHookEventsSchema(db);
      const now = Date.now();
      const createdAt = new Date(now - 3600000).toISOString();
      db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, 0, ?)').run(
        'ag-g',
        'Ghosts',
        'ghost-probe',
        createdAt,
      );
      db.prepare(
        `INSERT INTO sessions (id, agent_group_id, status, container_status, created_at) VALUES (?, ?, 'active', 'stopped', ?)`,
      ).run('sess-g', 'ag-g', createdAt);
      insertHookEvent(db, {
        group_folder: 'ghost-probe',
        event: 'SessionStart',
        session_id: 'sdk-g',
        timestamp: now - 10000,
      });
      insertHookEvent(db, {
        group_folder: 'ghost-probe',
        event: 'InstructionsLoaded',
        session_id: 'sdk-g',
        timestamp: now - 9999,
      });
      db.close();

      const res = await fetch(`${baseUrl}/api/hook-events/sessions`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      const g = body.find((p: any) => p.group_folder === 'ghost-probe');
      expect(g).toBeDefined();
      expect(g.sdk_subsessions).toHaveLength(1);
      expect(g.sdk_subsessions[0].shape).toBe('ghost');
    });

    it('still returns the old flat shape when ?flat=1 is passed', async () => {
      const db = createDashboardTestDb();
      seedHookEventsSchema(db);
      const now = Date.now();
      const createdAt = new Date(now - 3600000).toISOString();
      db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, 0, ?)').run(
        'ag-f',
        'Flat',
        'flat-probe',
        createdAt,
      );
      db.prepare(`INSERT INTO sessions (id, agent_group_id, status, created_at) VALUES (?, ?, 'active', ?)`).run(
        'sess-f',
        'ag-f',
        createdAt,
      );
      insertHookEvent(db, {
        group_folder: 'flat-probe',
        event: 'UserPromptSubmit',
        session_id: 'sdk-f',
        timestamp: now - 5000,
      });
      insertHookEvent(db, {
        group_folder: 'flat-probe',
        event: 'PostToolUse',
        tool: 'Read',
        session_id: 'sdk-f',
        timestamp: now - 4000,
      });
      db.close();

      const res = await fetch(`${baseUrl}/api/hook-events/sessions?flat=1`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      expect(Array.isArray(body)).toBe(true);
      const row = body.find((r: any) => r.session_id === 'sdk-f');
      expect(row).toBeDefined();
      expect(row).toHaveProperty('session_id');
      expect(row).toHaveProperty('first_ts');
      expect(row).toHaveProperty('last_ts');
      expect(row).toHaveProperty('event_count');
      // Nested-shape fields must NOT appear in flat mode.
      expect(row).not.toHaveProperty('nanoclaw_session_id');
      expect(row).not.toHaveProperty('sdk_subsessions');
    });

    // Regression: selecting a nanoclaw session must return ALL sub-sessions of that coworker
    // and ZERO events from any other coworker — and the reverse (single SDK filter) must
    // return only the matching UUID's events. This is the "no mix" guarantee the UI relies on.
    it('nanoclaw-session-flow and session-flow both enforce strict no-mixing across coworkers', async () => {
      const db = createDashboardTestDb();
      seedHookEventsSchema(db);
      const now = Date.now();
      const createdAt = new Date(now - 3600000).toISOString();

      // Two coworkers. Coworker X has ONE nanoclaw session with TWO SDK sub-sessions
      // (uuid-main + uuid-taskfire — representing the post-PR-#108 "new_session:true"
      // world where each task fire spins up a fresh SDK UUID under the same nanoclaw
      // session). Coworker Y is a DIFFERENT coworker on a DIFFERENT folder — its events
      // must never leak into X's aggregated view.
      db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, 0, ?)').run(
        'ag-X',
        'CoworkerX',
        'cw-x',
        createdAt,
      );
      db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, 0, ?)').run(
        'ag-Y',
        'CoworkerY',
        'cw-y',
        createdAt,
      );
      db.prepare(
        `INSERT INTO sessions (id, agent_group_id, status, container_status, last_active, created_at)
         VALUES (?, ?, 'active', 'running', ?, ?)`,
      ).run('sess-A', 'ag-X', new Date(now - 1000).toISOString(), createdAt);

      // Coworker X — uuid-main: UserPromptSubmit + PostToolUse pair (Pre/Post for duration).
      insertHookEvent(db, {
        group_folder: 'cw-x',
        event: 'UserPromptSubmit',
        session_id: 'uuid-main',
        timestamp: now - 60000,
      });
      insertHookEvent(db, {
        group_folder: 'cw-x',
        event: 'SessionStart',
        session_id: 'uuid-main',
        timestamp: now - 59500,
      });
      insertHookEvent(db, { group_folder: 'cw-x', event: 'Stop', session_id: 'uuid-main', timestamp: now - 59000 });
      // Coworker X — uuid-taskfire: UserPromptSubmit + SessionStart + Stop (all flow-renderable).
      insertHookEvent(db, {
        group_folder: 'cw-x',
        event: 'UserPromptSubmit',
        session_id: 'uuid-taskfire',
        timestamp: now - 30000,
      });
      insertHookEvent(db, {
        group_folder: 'cw-x',
        event: 'SessionStart',
        session_id: 'uuid-taskfire',
        timestamp: now - 29500,
      });
      insertHookEvent(db, { group_folder: 'cw-x', event: 'Stop', session_id: 'uuid-taskfire', timestamp: now - 29000 });
      // Coworker Y — uuid-other: three flow-renderable events on a DIFFERENT folder.
      insertHookEvent(db, {
        group_folder: 'cw-y',
        event: 'UserPromptSubmit',
        session_id: 'uuid-other',
        timestamp: now - 20000,
      });
      insertHookEvent(db, {
        group_folder: 'cw-y',
        event: 'SessionStart',
        session_id: 'uuid-other',
        timestamp: now - 19500,
      });
      insertHookEvent(db, { group_folder: 'cw-y', event: 'Stop', session_id: 'uuid-other', timestamp: now - 19000 });

      db.close();

      // 1) Nanoclaw-session-flow for sess-A should return exactly 6 flow entries (both sub-sessions
      //    of X — 3 each) and ZERO from Y.
      const nanoRes = await fetch(
        `${baseUrl}/api/hook-events/nanoclaw-session-flow?agent_group_id=ag-X&nanoclaw_session_id=sess-A`,
      );
      expect(nanoRes.status).toBe(200);
      const nanoBody = (await nanoRes.json()) as any;
      expect(nanoBody.group_folder).toBe('cw-x');
      expect(nanoBody.entries).toHaveLength(6);
      const nanoSessionIds = new Set<string>(nanoBody.entries.map((e: any) => e.session_id));
      expect(nanoSessionIds.has('uuid-main')).toBe(true);
      expect(nanoSessionIds.has('uuid-taskfire')).toBe(true);
      expect(nanoSessionIds.has('uuid-other')).toBe(false);

      // 2) Single-SDK session-flow for uuid-main + group=cw-x must return ONLY uuid-main events.
      const sdkRes = await fetch(`${baseUrl}/api/hook-events/session-flow?session_id=uuid-main&group=cw-x`);
      expect(sdkRes.status).toBe(200);
      const sdkBody = (await sdkRes.json()) as any;
      expect(sdkBody.entries).toHaveLength(3);
      // No taskfire / other leakage — all event timestamps must fall in uuid-main's range.
      for (const e of sdkBody.entries) {
        expect(e.timestamp).toBeGreaterThanOrEqual(now - 60000);
        expect(e.timestamp).toBeLessThanOrEqual(now - 59000);
      }

      // 3) /api/hook-events/sessions — coworker X's parent has both sdks, Y's has only uuid-other.
      const sessRes = await fetch(`${baseUrl}/api/hook-events/sessions`);
      expect(sessRes.status).toBe(200);
      const sessBody = (await sessRes.json()) as any[];
      const parentX = sessBody.find((p: any) => p.group_folder === 'cw-x');
      const parentY = sessBody.find((p: any) => p.group_folder === 'cw-y');
      expect(parentX).toBeDefined();
      expect(parentX.nanoclaw_session_id).toBe('sess-A');
      const xSubIds = new Set<string>(parentX.sdk_subsessions.map((s: any) => s.session_id));
      expect(xSubIds.has('uuid-main')).toBe(true);
      expect(xSubIds.has('uuid-taskfire')).toBe(true);
      expect(xSubIds.has('uuid-other')).toBe(false);
      // Y has no active nanoclaw session — but the orphan entry must still list its SDK
      // sub-session (bucketed under a null parent) and must NOT include X's sdks.
      expect(parentY).toBeDefined();
      const ySubIds = new Set<string>(parentY.sdk_subsessions.map((s: any) => s.session_id));
      expect(ySubIds.has('uuid-other')).toBe(true);
      expect(ySubIds.has('uuid-main')).toBe(false);
      expect(ySubIds.has('uuid-taskfire')).toBe(false);
    });
  });
});

// ── Ask-question & credential card tests ──

function createTestDbWithSessions(): Database.Database {
  const db = createDashboardTestDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent_group_id TEXT NOT NULL,
      messaging_group_id TEXT,
      thread_id TEXT,
      agent_provider TEXT,
      status TEXT DEFAULT 'active',
      container_status TEXT DEFAULT 'stopped',
      last_active TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_questions (
      question_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      message_out_id TEXT NOT NULL,
      platform_id TEXT,
      channel_type TEXT,
      thread_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_approvals (
      approval_id TEXT PRIMARY KEY,
      session_id TEXT,
      request_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      agent_group_id TEXT,
      channel_type TEXT,
      platform_id TEXT,
      platform_message_id TEXT,
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS pending_credentials (
      id TEXT PRIMARY KEY,
      agent_group_id TEXT NOT NULL,
      session_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      host_pattern TEXT NOT NULL,
      path_pattern TEXT,
      header_name TEXT,
      value_format TEXT,
      description TEXT,
      channel_type TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      platform_message_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS a2a_session_sources (
      recipient_session_id     TEXT PRIMARY KEY,
      recipient_agent_group_id TEXT NOT NULL,
      recipient_thread_id      TEXT,
      source_session_id        TEXT NOT NULL,
      source_agent_group_id    TEXT NOT NULL,
      source_thread_id         TEXT,
      created_at               TEXT NOT NULL
    );
  `);
  return db;
}

describe('/api/messages — card metadata and pending state', () => {
  it('returns cardType and isPending for ask_question messages', async () => {
    const db = createTestDbWithSessions();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'ag-q',
      'Q-Agent',
      'q-agent',
      0,
      now,
    );
    db.prepare('INSERT INTO sessions (id, agent_group_id, status, created_at) VALUES (?, ?, ?, ?)').run(
      'sess-q',
      'ag-q',
      'active',
      now,
    );
    db.prepare(
      'INSERT INTO pending_questions (question_id, session_id, message_out_id, created_at) VALUES (?, ?, ?, ?)',
    ).run('qid-1', 'sess-q', 'msg-1', now);
    // Create session outbound.db with an ask_question message
    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-q', 'sess-q');
    mkdirSync(sessDir, { recursive: true });
    const outDb = new Database(path.join(sessDir, 'outbound.db'));
    outDb.exec(
      'CREATE TABLE messages_out (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, in_reply_to TEXT)',
    );
    outDb
      .prepare('INSERT INTO messages_out (id, kind, content, timestamp) VALUES (?, ?, ?, ?)')
      .run(
        'msg-1',
        'chat-sdk',
        JSON.stringify({ type: 'ask_question', questionId: 'qid-1', question: 'Pick one', options: ['A', 'B'] }),
        now,
      );
    outDb.close();
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/messages?group=q-agent&limit=10`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const msg = data.messages.find((m: any) => m.id === 'msg-1');
    expect(msg).toBeDefined();
    expect(msg.cardType).toBe('ask_question');
    expect(msg.questionId).toBe('qid-1');
    expect(msg.options).toEqual(['A', 'B']);
    expect(msg.isPending).toBe(true);
    expect(msg.displayContent).toBe('Pick one');
  });

  it('returns isPending=false when question is already resolved', async () => {
    const db = createTestDbWithSessions();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'ag-q2',
      'Q2-Agent',
      'q2-agent',
      0,
      now,
    );
    db.prepare('INSERT INTO sessions (id, agent_group_id, status, created_at) VALUES (?, ?, ?, ?)').run(
      'sess-q2',
      'ag-q2',
      'active',
      now,
    );
    // No pending_questions row → already resolved
    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-q2', 'sess-q2');
    mkdirSync(sessDir, { recursive: true });
    const outDb = new Database(path.join(sessDir, 'outbound.db'));
    outDb.exec(
      'CREATE TABLE messages_out (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, in_reply_to TEXT)',
    );
    outDb
      .prepare('INSERT INTO messages_out (id, kind, content, timestamp) VALUES (?, ?, ?, ?)')
      .run(
        'msg-2',
        'chat-sdk',
        JSON.stringify({ type: 'ask_question', questionId: 'qid-gone', question: 'Old Q', options: ['X'] }),
        now,
      );
    outDb.close();
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/messages?group=q2-agent&limit=10`);
    const data = await res.json();
    const msg = data.messages.find((m: any) => m.id === 'msg-2');
    expect(msg.cardType).toBe('ask_question');
    expect(msg.isPending).toBe(false);
  });

  it('folds message edits and reactions onto the delivered outgoing message', async () => {
    const db = createTestDbWithSessions();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'ag-ops',
      'Ops-Agent',
      'ops-agent',
      0,
      now,
    );
    db.prepare('INSERT INTO sessions (id, agent_group_id, status, created_at) VALUES (?, ?, ?, ?)').run(
      'sess-ops',
      'ag-ops',
      'active',
      now,
    );
    db.close();
    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-ops', 'sess-ops');
    mkdirSync(sessDir, { recursive: true });

    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec(`
      CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT);
      CREATE TABLE delivered (
        message_out_id TEXT PRIMARY KEY,
        platform_message_id TEXT,
        status TEXT
      );
    `);
    inDb.prepare('INSERT INTO delivered VALUES (?, ?, ?)').run('msg-base', 'platform-1', 'delivered');
    inDb.close();

    const outDb = new Database(path.join(sessDir, 'outbound.db'));
    outDb.exec(
      'CREATE TABLE messages_out (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, in_reply_to TEXT)',
    );
    outDb
      .prepare('INSERT INTO messages_out (id, kind, content, timestamp) VALUES (?, ?, ?, ?)')
      .run(
        'msg-base',
        'chat-sdk',
        JSON.stringify({ text: 'Draft update', files: ['report.txt'] }),
        '2026-04-16T10:00:00.000Z',
      );
    outDb
      .prepare('INSERT INTO messages_out (id, kind, content, timestamp) VALUES (?, ?, ?, ?)')
      .run(
        'msg-edit',
        'chat-sdk',
        JSON.stringify({ operation: 'edit', messageId: 'platform-1', text: 'Final update' }),
        '2026-04-16T10:01:00.000Z',
      );
    outDb
      .prepare('INSERT INTO messages_out (id, kind, content, timestamp) VALUES (?, ?, ?, ?)')
      .run(
        'msg-react',
        'chat-sdk',
        JSON.stringify({ operation: 'reaction', messageId: 'platform-1', emoji: ':thumbsup:' }),
        '2026-04-16T10:02:00.000Z',
      );
    outDb.close();

    const attachmentDir = path.join(sessDir, 'outbox', 'msg-base');
    mkdirSync(attachmentDir, { recursive: true });
    writeFileSync(path.join(attachmentDir, 'report.txt'), 'attached report', 'utf-8');

    forceOpenDbForTests();
    const res = await fetch(`${baseUrl}/api/messages?group=ops-agent&limit=10`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages.find((m: any) => m.id === 'msg-edit')).toBeUndefined();
    expect(data.messages.find((m: any) => m.id === 'msg-react')).toBeUndefined();
    const msg = data.messages.find((m: any) => m.id === 'msg-base');
    expect(msg).toBeDefined();
    expect(msg.displayContent).toBe('Final update');
    expect(msg.edited).toBe(true);
    expect(msg.reactions).toEqual([':thumbsup:']);
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0].name).toBe('report.txt');
  });

  it('serves message attachments from preserved dashboard outbox files', async () => {
    const db = createTestDbWithSessions();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'ag-files',
      'Files-Agent',
      'files-agent',
      0,
      now,
    );
    db.prepare('INSERT INTO sessions (id, agent_group_id, status, created_at) VALUES (?, ?, ?, ?)').run(
      'sess-files',
      'ag-files',
      'active',
      now,
    );
    db.close();
    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-files', 'sess-files');
    mkdirSync(sessDir, { recursive: true });

    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec(`
      CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT);
      CREATE TABLE delivered (
        message_out_id TEXT PRIMARY KEY,
        platform_message_id TEXT,
        status TEXT
      );
    `);
    inDb.prepare('INSERT INTO delivered VALUES (?, ?, ?)').run('msg-file', 'platform-file', 'delivered');
    inDb.close();

    const outDb = new Database(path.join(sessDir, 'outbound.db'));
    outDb.exec(
      'CREATE TABLE messages_out (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, in_reply_to TEXT)',
    );
    outDb
      .prepare('INSERT INTO messages_out (id, kind, content, timestamp) VALUES (?, ?, ?, ?)')
      .run('msg-file', 'chat-sdk', JSON.stringify({ files: ['artifact.json'] }), now);
    outDb.close();

    const attachmentDir = path.join(sessDir, 'outbox', 'msg-file');
    mkdirSync(attachmentDir, { recursive: true });
    writeFileSync(path.join(attachmentDir, 'artifact.json'), '{"ok":true}', 'utf-8');

    forceOpenDbForTests();
    const res = await fetch(`${baseUrl}/api/messages?group=files-agent&limit=10`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const msg = data.messages.find((m: any) => m.id === 'msg-file');
    expect(msg.attachments).toHaveLength(1);

    const downloadRes = await fetch(`${baseUrl}${msg.attachments[0].url}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get('content-type')).toContain('application/json');
    expect(await downloadRes.text()).toBe('{"ok":true}');
  });
});

describe('/api/questions/respond', () => {
  it('rejects missing fields', async () => {
    const res = await fetch(`${baseUrl}/api/questions/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'qid-1' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/selectedOption/);
  });

  it('accepts arbitrary option values (not limited to Approve/Reject)', async () => {
    // The point is it doesn't reject with 400 for non-Approve/Reject values.
    // If ingress is running (shared machine), we get 200; if not, 500. Either is fine.
    const res = await fetch(`${baseUrl}/api/questions/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'qid-1', selectedOption: 'Option C' }),
    });
    // Must NOT be 400 — arbitrary options are valid, not limited to Approve/Reject
    expect(res.status).not.toBe(400);
  });
});

describe('container exec endpoint auth', () => {
  it('container exec endpoint does not demand DASHBOARD_SECRET', async () => {
    // Previously this endpoint was behind a strict-auth gate that returned
    // 403 whenever DASHBOARD_SECRET was unset. Now it matches every other
    // endpoint: open on localhost when no secret is configured.
    const res = await fetch(`${baseUrl}/api/coworkers/any-folder/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'true' }),
    });
    expect(res.status).not.toBe(403);
  });
});

describe('timestampToEpochMs', () => {
  it('parses ISO UTC strings', () => {
    expect(timestampToEpochMs('2026-05-05T08:05:45.526Z')).toBe(Date.parse('2026-05-05T08:05:45.526Z'));
  });

  it('parses SQLite-format datetime as UTC', () => {
    // Outbound DB writes "YYYY-MM-DD HH:MM:SS" and the agent-runner inserts UTC;
    // the normalizer must treat it as UTC, not local, to stay monotonic with
    // ISO-formatted inbound rows.
    expect(timestampToEpochMs('2026-05-05 08:06:38')).toBe(Date.parse('2026-05-05T08:06:38Z'));
  });

  it('parses numeric ms as number and as string, including trailing ".0"', () => {
    expect(timestampToEpochMs(1777692192745)).toBe(1777692192745);
    expect(timestampToEpochMs('1777692192745')).toBe(1777692192745);
    // This shape is what caused the forger bisection: SQLite stored REAL,
    // Python/Node saw "1777692192745.0", and the old normalizer produced
    // unparseable "1777692192745.0.000Z".
    expect(timestampToEpochMs('1777692192745.0')).toBe(1777692192745);
  });

  it('returns NaN for unparseable input rather than a poisoned value', () => {
    expect(Number.isNaN(timestampToEpochMs(''))).toBe(true);
    expect(Number.isNaN(timestampToEpochMs('not a date'))).toBe(true);
    expect(Number.isNaN(timestampToEpochMs(null))).toBe(true);
    expect(Number.isNaN(timestampToEpochMs(undefined))).toBe(true);
  });
});

describe('compareMessagesAscending', () => {
  it('orders mixed ISO and SQLite formats chronologically', () => {
    const a = { id: 'a', timestamp: '2026-05-05T08:05:45.526Z' };
    const b = { id: 'b', timestamp: '2026-05-05 08:06:38' };
    expect(compareMessagesAscending(a, b)).toBeLessThan(0);
    expect(compareMessagesAscending(b, a)).toBeGreaterThan(0);
  });

  it('does not bisect a sort when one row has an unparseable timestamp', () => {
    // Regression: the real forger bug. One malformed row produced NaN from
    // Date.parse, poisoning the comparator and splitting the sort into two
    // direction-clustered runs instead of interleaving by time.
    const messages = [
      { id: 'out-2', direction: 'outgoing', timestamp: '2026-05-05T08:37:39.000Z' },
      { id: 'in-2', direction: 'incoming', timestamp: '2026-05-05T08:37:26.414Z' },
      { id: 'out-1', direction: 'outgoing', timestamp: '2026-05-05T08:06:38.000Z' },
      { id: 'in-1', direction: 'incoming', timestamp: '2026-05-05T08:05:45.526Z' },
      { id: 'bad', direction: 'incoming', timestamp: 'not-a-date' },
    ];
    const sorted = [...messages].sort(compareMessagesAscending);
    const realOrder = sorted.filter((m) => m.id !== 'bad').map((m) => m.id);
    expect(realOrder).toEqual(['in-1', 'out-1', 'in-2', 'out-2']);
    // NaN-timestamped row is pushed to the tail so the good rows stay interleaved.
    expect(sorted[sorted.length - 1].id).toBe('bad');
  });
});

describe('/api/messages system-id filter', () => {
  function seedFilterTestSession() {
    const db = createTestDbWithSessions();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'ag-filter-test',
      'FilterTest',
      'filter-test',
      0,
      now,
    );
    db.prepare('INSERT INTO sessions (id, agent_group_id, status, created_at) VALUES (?, ?, ?, ?)').run(
      'sess-filter-test',
      'ag-filter-test',
      'active',
      now,
    );
    db.close();

    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-filter-test', 'sess-filter-test');
    mkdirSync(sessDir, { recursive: true });

    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec('CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT)');
    const inIns = inDb.prepare('INSERT INTO messages_in VALUES (?, ?, ?, ?)');
    inIns.run('dash-real-1', 'chat', '{"text":"real user message"}', now);
    inIns.run('claudemd-refresh-1', 'chat', '{"text":"Your instructions were updated"}', now);
    inIns.run('a2a-noise-1', 'chat', '{"text":"No response requested"}', now);
    // ncl polling chatter (cli_response, id cli-resp-…) — must be hidden so it
    // doesn't consume the LIMIT window.
    inIns.run('cli-resp-1', 'system', '{"type":"cli_response","ok":true}', now);
    inDb.close();

    const outDb = new Database(path.join(sessDir, 'outbound.db'));
    outDb.exec(
      'CREATE TABLE messages_out (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, in_reply_to TEXT)',
    );
    const outIns = outDb.prepare('INSERT INTO messages_out VALUES (?, ?, ?, ?, ?)');
    outIns.run('msg-real-reply', 'chat', '{"text":"real agent reply"}', now, 'dash-real-1');
    outIns.run('msg-ack-claudemd', 'chat', '{"text":"ack"}', now, 'claudemd-refresh-1');
    outIns.run('msg-ack-a2a', 'chat', '{"text":"ack a2a"}', now, 'a2a-noise-1');
    // ncl polling chatter (cli_request, id cli-…) — must be hidden by default.
    outIns.run('cli-1', 'system', '{"action":"cli_request","command":"sessions-list"}', now, null);
    outDb.close();

    forceOpenDbForTests();
  }

  it('hides claudemd-refresh, a2a, and cli- chatter by default', async () => {
    seedFilterTestSession();
    const res = await fetch(`${baseUrl}/api/messages?group=filter-test&limit=50`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: any[] };
    const ids = data.messages.map((m) => m.id).sort();
    // cli-1 / cli-resp-1 (ncl polling chatter) excluded server-side so they
    // never consume the LIMIT window.
    expect(ids).toEqual(['dash-real-1', 'msg-real-reply']);
  });

  it('returns the full stream when includeSystem=1 (debug/timeline)', async () => {
    seedFilterTestSession();
    const res = await fetch(`${baseUrl}/api/messages?group=filter-test&limit=50&includeSystem=1`);
    const data = (await res.json()) as { messages: any[] };
    const ids = data.messages.map((m) => m.id).sort();
    expect(ids).toEqual([
      'a2a-noise-1',
      'claudemd-refresh-1',
      'cli-1',
      'cli-resp-1',
      'dash-real-1',
      'msg-ack-a2a',
      'msg-ack-claudemd',
      'msg-real-reply',
    ]);
  });

  it('surfaces a2a messages from a real coworker with senderKind/senderCoworkerName', async () => {
    const db = createTestDbWithSessions();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'ag-receiver',
      'Receiver',
      'receiver',
      0,
      now,
    );
    // The "other" coworker whose platform_id will be embedded in the a2a row
    db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'ag-sender-123',
      'SenderBot',
      'sender-bot',
      0,
      now,
    );
    db.prepare('INSERT INTO sessions (id, agent_group_id, status, created_at) VALUES (?, ?, ?, ?)').run(
      'sess-receiver',
      'ag-receiver',
      'active',
      now,
    );
    db.close();

    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-receiver', 'sess-receiver');
    mkdirSync(sessDir, { recursive: true });
    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec(
      'CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT)',
    );
    const inIns = inDb.prepare('INSERT INTO messages_in VALUES (?, ?, ?, ?, ?, ?)');
    // Legit inter-coworker send: platform_id resolves to a real agent_group
    inIns.run('a2a-from-real-coworker', 'chat', '{"text":"Hey, can you bump deps?"}', now, 'agent', 'ag-sender-123');
    // Plumbing ping: no matching agent_group — should stay filtered
    inIns.run('a2a-plumbing-noise', 'chat', '{"text":"ping"}', now, 'agent', 'ag-does-not-exist');
    // Human dashboard message — baseline
    inIns.run('dash-real-1', 'chat', '{"text":"hi"}', now, 'dashboard', 'dashboard:receiver');
    inDb.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/messages?group=receiver&limit=50`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: any[] };
    const ids = data.messages.map((m) => m.id).sort();
    // Real coworker a2a shows up; unresolvable ag-* IDs surface as (deleted).
    expect(ids).toEqual(['a2a-from-real-coworker', 'a2a-plumbing-noise', 'dash-real-1']);
    const coworkerMsg = data.messages.find((m) => m.id === 'a2a-from-real-coworker');
    expect(coworkerMsg.senderKind).toBe('coworker');
    expect(coworkerMsg.senderCoworkerName).toBe('SenderBot');
    const deletedMsg = data.messages.find((m) => m.id === 'a2a-plumbing-noise');
    expect(deletedMsg.senderKind).toBe('coworker');
    expect(deletedMsg.senderCoworkerName).toBe('(deleted)');
    const human = data.messages.find((m) => m.id === 'dash-real-1');
    expect(human.senderKind).toBeUndefined();
  });
});

describe('/api/messages — Slack-style thread filtering', () => {
  function seedThreadScenario(): void {
    const db = createTestDbWithSessions();
    const now = new Date().toISOString();

    // One coworker with both a dashboard channel AND a Slack channel wired.
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-thread', 'ThreadAgent', 'thread-agent', now);

    db.prepare(
      'INSERT INTO messaging_groups (id, channel_type, platform_id, instance, name, is_group, unknown_sender_policy, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
    ).run('mg-dash', 'dashboard', 'dashboard:thread-agent', 'dashboard', 'Dashboard', 'public', now);

    db.prepare(
      'INSERT INTO messaging_groups (id, channel_type, platform_id, instance, name, is_group, unknown_sender_policy, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    ).run('mg-slack', 'slack', 'slack:C123', 'slack', 'Slack', 'public', now);

    // Four active sessions under ag-thread:
    //  - dash root (thread_id NULL, mg-dash)
    //  - dash thread t1  (mg-dash)
    //  - dash thread t2  (mg-dash)
    //  - slack root (thread_id NULL, mg-slack) — the cross-channel leak guard
    const sess = (id: string, mg: string, tid: string | null) =>
      db
        .prepare(
          "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES (?, ?, ?, ?, 'active', 'stopped', NULL, ?)",
        )
        .run(id, 'ag-thread', mg, tid, now);
    sess('sess-dash-root', 'mg-dash', null);
    sess('sess-dash-t1', 'mg-dash', 't1');
    sess('sess-dash-t2', 'mg-dash', 't2');
    sess('sess-slack-root', 'mg-slack', null);

    // Seed one or two messages per session's inbound.db (the /api/messages
    // handler also reads outbound.db but inbound is enough to exercise the
    // filter). Each row carries a thread_id matching the session.
    const seedInbound = (sid: string, msgs: Array<{ id: string; thread_id: string | null; text: string }>) => {
      const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-thread', sid);
      mkdirSync(sessDir, { recursive: true });
      const inDb = new Database(path.join(sessDir, 'inbound.db'));
      inDb.exec(
        `CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, thread_id TEXT);
         CREATE TABLE delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT);`,
      );
      const ins = inDb.prepare(
        "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id) VALUES (?, 'chat', ?, ?, ?, ?, ?)",
      );
      let i = 0;
      for (const m of msgs) {
        const ts = new Date(Date.parse(now) + ++i * 1000).toISOString();
        ins.run(m.id, JSON.stringify({ text: m.text }), ts, 'dashboard', 'dashboard:thread-agent', m.thread_id);
      }
      inDb.close();
    };
    seedInbound('sess-dash-root', [{ id: 'dash-root-1', thread_id: null, text: 'root msg 1' }]);
    seedInbound('sess-dash-t1', [
      { id: 'dash-t1-a', thread_id: 't1', text: 'thread t1 reply 1' },
      { id: 'dash-t1-b', thread_id: 't1', text: 'thread t1 reply 2' },
    ]);
    seedInbound('sess-dash-t2', [{ id: 'dash-t2-a', thread_id: 't2', text: 'thread t2 reply' }]);
    // Slack root uses slack channel_type — its rows must never surface in
    // the dashboard /api/messages response regardless of thread_id.
    {
      const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-thread', 'sess-slack-root');
      mkdirSync(sessDir, { recursive: true });
      const inDb = new Database(path.join(sessDir, 'inbound.db'));
      inDb.exec(
        `CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, thread_id TEXT);
         CREATE TABLE delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT);`,
      );
      inDb
        .prepare(
          "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id) VALUES (?, 'chat', ?, ?, 'slack', 'slack:C123', NULL)",
        )
        .run('slack-root-1', JSON.stringify({ text: 'slack root msg' }), now);
      inDb.close();
    }

    db.close();
    forceOpenDbForTests();
  }

  it('main view returns only the dashboard-channel root session (no threads, no cross-channel leak)', async () => {
    seedThreadScenario();
    const res = await fetch(`${baseUrl}/api/messages?group=thread-agent&limit=50`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: any[] };
    const ids = data.messages.map((m) => m.id).sort();
    expect(ids).toEqual(['dash-root-1']);
    // Thread rows stay out of the main view.
    expect(ids).not.toContain('dash-t1-a');
    expect(ids).not.toContain('dash-t2-a');
    // Slack root stays out — its thread_id could otherwise collide with a
    // dashboard thread_id, and it also wouldn't belong in the dashboard's
    // Slack-style per-channel view.
    expect(ids).not.toContain('slack-root-1');
  });

  it("thread view returns only that thread's messages", async () => {
    seedThreadScenario();
    const res = await fetch(`${baseUrl}/api/messages?group=thread-agent&thread_id=t1&limit=50`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: any[] };
    const ids = data.messages.map((m) => m.id).sort();
    expect(ids).toEqual(['dash-t1-a', 'dash-t1-b']);
    // The other thread + root + Slack must not bleed in.
    expect(ids).not.toContain('dash-t2-a');
    expect(ids).not.toContain('dash-root-1');
    expect(ids).not.toContain('slack-root-1');
  });

  it('main view response includes threadSummaries for every per-thread session', async () => {
    seedThreadScenario();
    const res = await fetch(`${baseUrl}/api/messages?group=thread-agent&limit=50`);
    const data = (await res.json()) as {
      threadSummaries: Record<string, { replyCount: number; lastReplyTs: string | null }>;
    };
    expect(data.threadSummaries).toBeDefined();
    expect(Object.keys(data.threadSummaries).sort()).toEqual(['t1', 't2']);
    expect(data.threadSummaries.t1.replyCount).toBe(2);
    expect(data.threadSummaries.t2.replyCount).toBe(1);
    expect(typeof data.threadSummaries.t1.lastReplyTs).toBe('string');
  });

  it('main view threadSummaries include a2a sibling threads, not Slack/Discord', async () => {
    seedThreadScenario();
    const db = new Database(DB_PATH);
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO messaging_groups (id, channel_type, platform_id, instance, name, is_group, unknown_sender_policy, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
    ).run('mg-a2a-thread', 'agent', 'agent:ag-thread:ag-thread', 'agent', 'A2A self-loop', 'public', now);
    db.prepare(
      "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES (?, 'ag-thread', 'mg-a2a-thread', ?, 'active', 'stopped', NULL, ?)",
    ).run('sess-a2a-self-loop', 'self-loop-thread', now);
    db.close();

    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-thread', 'sess-a2a-self-loop');
    mkdirSync(sessDir, { recursive: true });
    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec(
      `CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, thread_id TEXT);
       CREATE TABLE delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT);`,
    );
    inDb
      .prepare(
        "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id) VALUES (?, 'chat', ?, ?, 'agent', 'ag-thread', 'self-loop-thread')",
      )
      .run('a2a-self-1', JSON.stringify({ text: 'self-loop prompt' }), now);
    inDb.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/messages?group=thread-agent&limit=50`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      threadSummaries: Record<string, { replyCount: number; lastReplyTs: string | null; sessionId: string | null }>;
    };
    expect(data.threadSummaries.t1).toBeDefined();
    expect(data.threadSummaries.t2).toBeDefined();
    expect(data.threadSummaries['self-loop-thread']).toBeDefined();
    expect(data.threadSummaries['self-loop-thread'].replyCount).toBe(1);
    expect(data.threadSummaries['self-loop-thread'].sessionId).toBe('sess-a2a-self-loop');
    expect(Object.keys(data.threadSummaries)).not.toContain('slack-thread');
  });

  // Helper: extend the base scenario with a self-loop a2a thread under the
  // same agent group. The inbound row carries channel_type='agent' and
  // platform_id='ag-thread' (the same agent group id), which trips the
  // isSelfEcho filter on the main view.
  function seedSelfLoopThread(): void {
    const db = new Database(DB_PATH);
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO messaging_groups (id, channel_type, platform_id, instance, name, is_group, unknown_sender_policy, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
    ).run('mg-a2a-thread', 'agent', 'agent:ag-thread:ag-thread', 'agent', 'A2A self-loop', 'public', now);
    db.prepare(
      "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES (?, 'ag-thread', 'mg-a2a-thread', ?, 'active', 'stopped', NULL, ?)",
    ).run('sess-a2a-self-loop', 'self-loop-thread', now);
    db.close();
    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-thread', 'sess-a2a-self-loop');
    mkdirSync(sessDir, { recursive: true });
    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec(
      `CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, thread_id TEXT);
       CREATE TABLE delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT);`,
    );
    inDb
      .prepare(
        "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id) VALUES (?, 'chat', ?, ?, 'agent', 'ag-thread', 'self-loop-thread')",
      )
      .run('a2a-self-1', JSON.stringify({ text: 'self-loop prompt' }), now);
    inDb.close();
    forceOpenDbForTests();
  }

  it('main view hides self-loop a2a rows (self-echo plumbing stays out)', async () => {
    seedThreadScenario();
    seedSelfLoopThread();
    const res = await fetch(`${baseUrl}/api/messages?group=thread-agent&limit=50`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: any[] };
    const ids = data.messages.map((m) => m.id);
    expect(ids).not.toContain('a2a-self-1');
  });

  it('thread view shows self-loop a2a rows (explicit thread defeats the self-echo hide)', async () => {
    seedThreadScenario();
    seedSelfLoopThread();
    const res = await fetch(
      `${baseUrl}/api/messages?group=thread-agent&thread_id=self-loop-thread&limit=50`,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: any[] };
    const ids = data.messages.map((m) => m.id);
    expect(ids).toContain('a2a-self-1');
  });

  // Helper: seed a "receiver" session in ag-thread holding ONE inbound a2a
  // row whose source_session_id points at a DIFFERENT session in the same
  // agent group. This is the cross-session-within-same-coworker case
  // (e.g. one slang-fixer chain handing work to another) that the old
  // platform_id-only isSelfEcho test wrongly conflated with single-session
  // routing echo.
  function seedCrossSessionA2a(opts: {
    sourceSessionId: string | null;
  }): { receiverSessionId: string; rowId: string } {
    const db = new Database(DB_PATH);
    const now = new Date().toISOString();
    const receiverId = 'sess-a2a-receiver';
    const rowId = 'a2a-cross-session-1';
    db.prepare(
      "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES (?, 'ag-thread', 'mg-dash', NULL, 'active', 'stopped', NULL, ?)",
    ).run(receiverId, now);
    if (opts.sourceSessionId) {
      // Source session is also in ag-thread but distinct from the receiver.
      db.prepare(
        "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES (?, 'ag-thread', 'mg-dash', NULL, 'active', 'stopped', NULL, ?)",
      ).run(opts.sourceSessionId, now);
    }
    db.close();
    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-thread', receiverId);
    mkdirSync(sessDir, { recursive: true });
    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec(
      `CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, thread_id TEXT, source_session_id TEXT);
       CREATE TABLE delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT);`,
    );
    inDb
      .prepare(
        "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id, source_session_id) VALUES (?, 'chat', ?, ?, 'agent', 'ag-thread', NULL, ?)",
      )
      .run(rowId, JSON.stringify({ text: 'cross-session a2a' }), now, opts.sourceSessionId);
    inDb.close();
    forceOpenDbForTests();
    return { receiverSessionId: receiverId, rowId };
  }

  it('sessionDirect view shows cross-session a2a within same agent group', async () => {
    seedThreadScenario();
    const { receiverSessionId, rowId } = seedCrossSessionA2a({
      sourceSessionId: 'sess-a2a-sender',
    });
    const res = await fetch(
      `${baseUrl}/api/messages?group=thread-agent&session_id=${encodeURIComponent(receiverSessionId)}&limit=50`,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: any[] };
    const ids = data.messages.map((m) => m.id);
    expect(ids).toContain(rowId);
  });

  it('sessionDirect view still hides true single-session self-echo', async () => {
    // source_session_id === receiver session id is a routing-loop artifact,
    // not a substantive a2a — must stay hidden on every non-thread view.
    seedThreadScenario();
    const db = new Database(DB_PATH);
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES ('sess-true-echo', 'ag-thread', 'mg-dash', NULL, 'active', 'stopped', NULL, ?)",
    ).run(now);
    db.close();
    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-thread', 'sess-true-echo');
    mkdirSync(sessDir, { recursive: true });
    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec(
      `CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, thread_id TEXT, source_session_id TEXT);
       CREATE TABLE delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT);`,
    );
    inDb
      .prepare(
        "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id, source_session_id) VALUES ('a2a-true-echo', 'chat', ?, ?, 'agent', 'ag-thread', NULL, 'sess-true-echo')",
      )
      .run(JSON.stringify({ text: 'single-session loop' }), now);
    inDb.close();
    forceOpenDbForTests();
    const res = await fetch(
      `${baseUrl}/api/messages?group=thread-agent&session_id=sess-true-echo&limit=50`,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: any[] };
    const ids = data.messages.map((m) => m.id);
    expect(ids).not.toContain('a2a-true-echo');
  });

  it('legacy a2a (source_session_id NULL) stays hidden — preserves old behavior', async () => {
    // a2a rows written before the source_session_id column existed surface
    // as NULL. Without provenance we cannot tell echo from cross-session,
    // so keep them hidden so the dashboard does not regress on older DBs.
    seedThreadScenario();
    const { receiverSessionId, rowId } = seedCrossSessionA2a({ sourceSessionId: null });
    const res = await fetch(
      `${baseUrl}/api/messages?group=thread-agent&session_id=${encodeURIComponent(receiverSessionId)}&limit=50`,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: any[] };
    const ids = data.messages.map((m) => m.id);
    expect(ids).not.toContain(rowId);
  });

  it('thread view surfaces claudemd-refresh / sys plumbing (main view still hides them)', async () => {
    seedThreadScenario();
    // A per-thread session whose inbound contains a claudemd-refresh- row
    // (a system ping). The current code drops these on the main view; with
    // the fix, opening the thread should surface them.
    const db = new Database(DB_PATH);
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES (?, 'ag-thread', 'mg-dash', ?, 'active', 'stopped', NULL, ?)",
    ).run('sess-claudemd-thread', 'claudemd-thread', now);
    db.close();
    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-thread', 'sess-claudemd-thread');
    mkdirSync(sessDir, { recursive: true });
    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec(
      `CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, thread_id TEXT);
       CREATE TABLE delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT);`,
    );
    inDb
      .prepare(
        "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id) VALUES (?, 'chat', ?, ?, 'host', 'host', 'claudemd-thread')",
      )
      .run('claudemd-refresh-1', JSON.stringify({ text: 'CLAUDE.md changed' }), now);
    inDb.close();
    forceOpenDbForTests();

    // Main view: still hides the plumbing row.
    const main = await fetch(`${baseUrl}/api/messages?group=thread-agent&limit=50`);
    const mainData = (await main.json()) as { messages: any[] };
    expect(mainData.messages.map((m) => m.id)).not.toContain('claudemd-refresh-1');

    // Thread view: surfaces it.
    const thr = await fetch(
      `${baseUrl}/api/messages?group=thread-agent&thread_id=claudemd-thread&limit=50`,
    );
    const thrData = (await thr.json()) as { messages: any[] };
    expect(thrData.messages.map((m) => m.id)).toContain('claudemd-refresh-1');
  });

  it('threadSummaries sums replyCount across sessions sharing a thread_id', async () => {
    seedThreadScenario();
    // Add two extra per-thread sessions for the same thread_id ("multi-sess")
    // under the same agent group. Each session contributes its own row count;
    // the badge must reflect the sum, not the last-iterated session.
    const db = new Database(DB_PATH);
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO messaging_groups (id, channel_type, platform_id, instance, name, is_group, unknown_sender_policy, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
    ).run('mg-a2a-multi', 'agent', 'agent:ag-thread:ag-thread', 'agent', 'A2A multi', 'public', now);
    for (const [sid, count] of [
      ['sess-multi-a', 2],
      ['sess-multi-b', 3],
      ['sess-multi-c', 5],
    ] as Array<[string, number]>) {
      db.prepare(
        "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES (?, 'ag-thread', 'mg-a2a-multi', 'multi-sess', 'active', 'stopped', NULL, ?)",
      ).run(sid, now);
      const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-thread', sid);
      mkdirSync(sessDir, { recursive: true });
      const inDb = new Database(path.join(sessDir, 'inbound.db'));
      inDb.exec(
        `CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, thread_id TEXT);
         CREATE TABLE delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT);`,
      );
      const stmt = inDb.prepare(
        "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id) VALUES (?, 'chat', ?, ?, 'agent', 'ag-other', 'multi-sess')",
      );
      for (let i = 0; i < count; i++) {
        stmt.run(`${sid}-msg-${i}`, JSON.stringify({ text: `msg ${i}` }), now);
      }
      inDb.close();
    }
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/messages?group=thread-agent&limit=50`);
    const data = (await res.json()) as {
      threadSummaries: Record<string, { replyCount: number; sessionId: string | null }>;
    };
    expect(data.threadSummaries['multi-sess']).toBeDefined();
    expect(data.threadSummaries['multi-sess'].replyCount).toBe(10); // 2 + 3 + 5
  });

  it('threadSummaries replyCount excludes rows whose thread_id does not match the session', async () => {
    seedThreadScenario();
    // A per-thread session whose inbound DB contains 3 rows for its own
    // thread plus 2 rows tagged with a different thread_id (legacy / webhook
    // collision). Badge should report 3, not 5.
    const db = new Database(DB_PATH);
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES ('sess-mixed', 'ag-thread', 'mg-dash', 'mixed-thread', 'active', 'stopped', NULL, ?)",
    ).run(now);
    db.close();
    const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-thread', 'sess-mixed');
    mkdirSync(sessDir, { recursive: true });
    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec(
      `CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, thread_id TEXT);
       CREATE TABLE delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT);`,
    );
    const ins = inDb.prepare(
      "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id) VALUES (?, 'chat', ?, ?, 'dashboard', 'dashboard:thread-agent', ?)",
    );
    ins.run('mixed-1', JSON.stringify({ text: 'a' }), now, 'mixed-thread');
    ins.run('mixed-2', JSON.stringify({ text: 'b' }), now, 'mixed-thread');
    ins.run('mixed-3', JSON.stringify({ text: 'c' }), now, 'mixed-thread');
    ins.run('other-1', JSON.stringify({ text: 'x' }), now, 'unrelated-thread');
    ins.run('other-2', JSON.stringify({ text: 'y' }), now, 'unrelated-thread');
    inDb.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/messages?group=thread-agent&limit=50`);
    const data = (await res.json()) as {
      threadSummaries: Record<string, { replyCount: number }>;
    };
    expect(data.threadSummaries['mixed-thread']).toBeDefined();
    expect(data.threadSummaries['mixed-thread'].replyCount).toBe(3);
  });
});

describe('/api/a2a-session — read-only inspector (Option C)', () => {
  function seedA2aScenario(): void {
    const db = createTestDbWithSessions();
    const now = new Date().toISOString();
    // reviewer is the recipient; implementer's bubble "from @reviewer"
    // opens its session. Seed two delegation threads so we can assert
    // scoping.
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-reviewer', 'Reviewer', 'reviewer', now);
    // a2a messaging_group scoped to reviewer (the ensureA2aWiring convention).
    db.prepare(
      'INSERT INTO messaging_groups (id, channel_type, platform_id, instance, name, is_group, unknown_sender_policy, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
    ).run('mg-a2a-reviewer', 'agent', 'agent:ag-reviewer', 'agent', 'A2a:reviewer', 'public', now);
    // Two per-thread sessions under reviewer on the a2a mg — one per
    // sender-side thread.
    const sess = (id: string, tid: string) =>
      db
        .prepare(
          "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES (?, 'ag-reviewer', 'mg-a2a-reviewer', ?, 'active', 'stopped', NULL, ?)",
        )
        .run(id, tid, now);
    sess('sess-rev-pra', 'thread-pr-A');
    sess('sess-rev-prb', 'thread-pr-B');

    // Seed a2a_session_sources mapping (post-PR-#308: inspector lookup is
    // (recipient_ag, source_thread_id) → recipient_session_id).
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)',
    ).run('ag-implementer', 'Implementer', 'implementer', now);
    db.prepare(
      "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES (?, 'ag-implementer', NULL, ?, 'active', 'stopped', NULL, ?)",
    ).run('sess-impl-pra', 'thread-pr-A', now);
    db.prepare(
      "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at) VALUES (?, 'ag-implementer', NULL, ?, 'active', 'stopped', NULL, ?)",
    ).run('sess-impl-prb', 'thread-pr-B', now);
    const insertSource = db.prepare(
      'INSERT INTO a2a_session_sources (recipient_session_id, recipient_agent_group_id, recipient_thread_id, source_session_id, source_agent_group_id, source_thread_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    insertSource.run(
      'sess-rev-pra',
      'ag-reviewer',
      'thread-pr-A',
      'sess-impl-pra',
      'ag-implementer',
      'thread-pr-A',
      now,
    );
    insertSource.run(
      'sess-rev-prb',
      'ag-reviewer',
      'thread-pr-B',
      'sess-impl-prb',
      'ag-implementer',
      'thread-pr-B',
      now,
    );

    const seedInOut = (
      sid: string,
      inMsgs: Array<{ id: string; text: string }>,
      outMsgs: Array<{ id: string; text: string }>,
      threadId: string,
    ) => {
      const sessDir = path.join(DATA_DIR, 'v2-sessions', 'ag-reviewer', sid);
      mkdirSync(sessDir, { recursive: true });
      const inDb = new Database(path.join(sessDir, 'inbound.db'));
      inDb.exec(
        'CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, thread_id TEXT);',
      );
      let i = 0;
      for (const m of inMsgs) {
        const ts = new Date(Date.parse(now) + ++i * 1000).toISOString();
        inDb
          .prepare(
            "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id) VALUES (?, 'chat', ?, ?, 'agent', 'ag-implementer', ?)",
          )
          .run(m.id, JSON.stringify({ text: m.text }), ts, threadId);
      }
      inDb.close();
      const outDb = new Database(path.join(sessDir, 'outbound.db'));
      outDb.exec(
        'CREATE TABLE messages_out (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT, platform_id TEXT, in_reply_to TEXT, thread_id TEXT);',
      );
      for (const m of outMsgs) {
        const ts = new Date(Date.parse(now) + ++i * 1000).toISOString();
        outDb
          .prepare(
            "INSERT INTO messages_out (id, kind, content, timestamp, channel_type, platform_id, in_reply_to, thread_id) VALUES (?, 'chat', ?, ?, 'agent', 'ag-implementer', NULL, ?)",
          )
          .run(m.id, JSON.stringify({ text: m.text }), ts, threadId);
      }
      outDb.close();
    };
    seedInOut(
      'sess-rev-pra',
      [{ id: 'a2a-pra-in-1', text: 'please review PR-A' }],
      [{ id: 'a2a-pra-out-1', text: 'PR-A looks good' }],
      'thread-pr-A',
    );
    seedInOut(
      'sess-rev-prb',
      [{ id: 'a2a-prb-in-1', text: 'please review PR-B' }],
      [{ id: 'a2a-prb-out-1', text: 'PR-B has issues' }],
      'thread-pr-B',
    );

    db.close();
    forceOpenDbForTests();
  }

  it('returns joined inbound+outbound for the keyed recipient session', async () => {
    seedA2aScenario();
    const res = await fetch(
      `${baseUrl}/api/a2a-session?recipient_agent_group_id=ag-reviewer&sender_thread=thread-pr-A`,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      session: { id: string; thread_id: string | null };
      messages: Array<{ id: string; direction: string }>;
    };
    expect(data.session.id).toBe('sess-rev-pra');
    expect(data.session.thread_id).toBe('thread-pr-A');
    const ids = data.messages.map((m) => m.id).sort();
    expect(ids).toEqual(['a2a-pra-in-1', 'a2a-pra-out-1']);
    // PR-B's messages must not leak into PR-A's inspector view.
    expect(ids).not.toContain('a2a-prb-in-1');
    expect(ids).not.toContain('a2a-prb-out-1');
  });

  it('returns 404 when no recipient session exists for the thread', async () => {
    seedA2aScenario();
    const res = await fetch(
      `${baseUrl}/api/a2a-session?recipient_agent_group_id=ag-reviewer&sender_thread=thread-does-not-exist`,
    );
    expect(res.status).toBe(404);
  });

  it('scopes to (recipient_ag, a2a_mg, thread_id) — different sender threads produce different inspector views', async () => {
    seedA2aScenario();
    const resA = await fetch(
      `${baseUrl}/api/a2a-session?recipient_agent_group_id=ag-reviewer&sender_thread=thread-pr-A`,
    );
    const resB = await fetch(
      `${baseUrl}/api/a2a-session?recipient_agent_group_id=ag-reviewer&sender_thread=thread-pr-B`,
    );
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    const dataA = (await resA.json()) as { session: { id: string }; messages: Array<{ id: string }> };
    const dataB = (await resB.json()) as { session: { id: string }; messages: Array<{ id: string }> };
    expect(dataA.session.id).toBe('sess-rev-pra');
    expect(dataB.session.id).toBe('sess-rev-prb');
    expect(dataA.messages.map((m) => m.id).sort()).toEqual(['a2a-pra-in-1', 'a2a-pra-out-1']);
    expect(dataB.messages.map((m) => m.id).sort()).toEqual(['a2a-prb-in-1', 'a2a-prb-out-1']);
  });

  it('rejects missing recipient_agent_group_id with 400', async () => {
    seedA2aScenario();
    const res = await fetch(`${baseUrl}/api/a2a-session?sender_thread=thread-pr-A`);
    expect(res.status).toBe(400);
  });
});

// ============================================================
// matchContainerName — pure unit tests. The full shape invariant is:
//   <prefix>-<folder>-<session-tail>-<13-digit-ts>
// and we need to reject shared-prefix collisions (folder `foo` matching
// a container for `foo-bar`) + non-NanoClaw names that happen to share
// the folder prefix.
// ============================================================
describe('matchContainerName', () => {
  const PREFIX = 'nc-dev';

  it('with sessionId → exact match on <prefix>-<folder>-<tail>-<ts>', () => {
    const tail = '1778143510824-x485si';
    const names = [`${PREFIX}-orchestrator-${tail}-1762512225123`, `${PREFIX}-orchestrator-other-tail-1762512225999`];
    expect(matchContainerName(names, 'orchestrator', 'sess-' + tail, PREFIX)).toBe(names[0]);
  });

  it('with sessionId → rejects when the trailing 13-digit timestamp is missing', () => {
    const tail = '1778143510824-x485si';
    const names = [`${PREFIX}-orchestrator-${tail}-manual`];
    expect(matchContainerName(names, 'orchestrator', 'sess-' + tail, PREFIX)).toBeNull();
  });

  it('without sessionId → matches any NanoClaw-shaped container for the folder', () => {
    const names = [`${PREFIX}-orchestrator-1778143510824-x485si-1762512225123`];
    expect(matchContainerName(names, 'orchestrator', null, PREFIX)).toBe(names[0]);
  });

  it('without sessionId → rejects names that share the folder prefix but are not NanoClaw containers', () => {
    const names = [`${PREFIX}-orchestrator-adhoc-debug-shell`];
    expect(matchContainerName(names, 'orchestrator', null, PREFIX)).toBeNull();
  });

  it('folder `foo` does NOT match a container for `foo-bar` when knownFolders is supplied', () => {
    const names = [`${PREFIX}-foo-bar-1778143510824-x485si-1762512225123`];
    const knownFolders = new Set(['foo', 'foo-bar']);
    expect(matchContainerName(names, 'foo', null, PREFIX, knownFolders)).toBeNull();
    expect(matchContainerName(names, 'foo-bar', null, PREFIX, knownFolders)).toBe(names[0]);
  });

  it('folder `foo` DOES match a container for `foo` when a rival `foo-bar` also exists', () => {
    const tail = '1778143510824-x485si';
    const names = [`${PREFIX}-foo-${tail}-1762512225123`, `${PREFIX}-foo-bar-${tail}-1762512225999`];
    const knownFolders = new Set(['foo', 'foo-bar']);
    expect(matchContainerName(names, 'foo', null, PREFIX, knownFolders)).toBe(names[0]);
  });

  it('preserves folder underscores in container name match', () => {
    // Container names are built verbatim from agent_groups.folder
    // (src/container-runner.ts:435), so `my_cw` produces `nc-…-my_cw-…`,
    // not `nc-…-my-cw-…`. PR #448 removed an earlier `_` → `-` normalize
    // that silently broke folder lookup for coworkers like `codex_test`.
    const namesWithUnderscore = [`${PREFIX}-my_cw-1778143510824-x485si-1762512225123`];
    const namesWithDash = [`${PREFIX}-my-cw-1778143510824-x485si-1762512225123`];
    expect(matchContainerName(namesWithUnderscore, 'my_cw', null, PREFIX)).toBe(namesWithUnderscore[0]);
    expect(matchContainerName(namesWithDash, 'my-cw', null, PREFIX)).toBe(namesWithDash[0]);
    // Cross-match must NOT happen: `my_cw` does not match `nc-…-my-cw-…`
    // and vice versa.
    expect(matchContainerName(namesWithDash, 'my_cw', null, PREFIX)).toBeNull();
    expect(matchContainerName(namesWithUnderscore, 'my-cw', null, PREFIX)).toBeNull();
  });

  it('returns null when no candidate matches', () => {
    expect(matchContainerName([], 'orchestrator', null, PREFIX)).toBeNull();
    expect(matchContainerName([`${PREFIX}-other-folder-abc-1762512225123`], 'orchestrator', null, PREFIX)).toBeNull();
  });

  it('folder-scoped Shared Artifacts falls back when the root session container is stopped', () => {
    const rootSession = 'sess-root-tail';
    const threadContainer = `${PREFIX}-orchestrator-thread-tail-1762512225123`;
    expect(
      matchContainerNameForRequest([threadContainer], 'orchestrator', rootSession, false, PREFIX),
    ).toBe(threadContainer);
  });

  it('an explicit thread never falls back to another session container', () => {
    const requestedSession = 'sess-requested-tail';
    const otherContainer = `${PREFIX}-orchestrator-other-tail-1762512225123`;
    expect(
      matchContainerNameForRequest([otherContainer], 'orchestrator', requestedSession, true, PREFIX),
    ).toBeNull();
  });

  it('passes container commands as execFile arguments without host-shell interpolation', () => {
    const command = `printf '%s\\n' "$HOME" && echo $(uname)`;
    expect(containerExecArgs('nc-dev-orchestrator-tail-1762512225123', command)).toEqual([
      'exec',
      'nc-dev-orchestrator-tail-1762512225123',
      'bash',
      '-c',
      command,
    ]);
  });
});

// ── /api/messages: session scoping + swim-lane (thread-vs-session work) ──

describe('/api/messages session scoping + swim-lane', () => {
  // Seed a session row + its inbound.db with one chat message.
  function seedSession(
    db: Database.Database,
    s: { id: string; ag: string; folder: string; mg: string | null; thread: string | null },
    msg: { id: string; text: string; ts: string },
  ) {
    const now = new Date().toISOString();
    const agExists = db.prepare('SELECT 1 FROM agent_groups WHERE id = ?').get(s.ag);
    if (!agExists) {
      db.prepare('INSERT INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, 0, ?)').run(
        s.ag,
        s.folder,
        s.folder,
        now,
      );
    }
    db.prepare(
      'INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(s.id, s.ag, s.mg, s.thread, 'active', msg.ts);
    const sessDir = path.join(DATA_DIR, 'v2-sessions', s.ag, s.id);
    mkdirSync(sessDir, { recursive: true });
    const inDb = new Database(path.join(sessDir, 'inbound.db'));
    inDb.exec('CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, thread_id TEXT)');
    inDb
      .prepare('INSERT INTO messages_in (id, kind, content, timestamp, thread_id) VALUES (?, ?, ?, ?, ?)')
      .run(msg.id, 'chat', JSON.stringify({ text: msg.text }), msg.ts, s.thread);
    inDb.close();
  }

  it('session_id scoping returns only the named session (not siblings on the same thread)', async () => {
    const db = createTestDbWithSessions();
    const thread = 'gh-issue-r/repo-501';
    seedSession(
      db,
      { id: 'sess-webhook', ag: 'ag-main', folder: 'main', mg: null, thread },
      { id: 'm-webhook', text: 'webhook msg', ts: '2026-06-20T00:00:00.000Z' },
    );
    seedSession(
      db,
      { id: 'sess-a2a', ag: 'ag-main', folder: 'main', mg: 'mg-a2a-1', thread },
      { id: 'm-a2a', text: 'a2a msg', ts: '2026-06-20T00:01:00.000Z' },
    );
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/messages?session_id=sess-webhook&limit=50`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const ids = data.messages.map((m: any) => m.id);
    expect(ids).toContain('m-webhook');
    expect(ids).not.toContain('m-a2a');
    // Every returned row carries its origin session_id.
    expect(data.messages.every((m: any) => m.session_id === 'sess-webhook')).toBe(true);
  });

  it('thread_id union returns both sessions on the thread, each row stamped with its session_id', async () => {
    const db = createTestDbWithSessions();
    const thread = 'gh-issue-r/repo-502';
    seedSession(
      db,
      { id: 'sess-wh2', ag: 'ag-main', folder: 'main', mg: null, thread },
      { id: 'm-wh2', text: 'webhook', ts: '2026-06-20T00:00:00.000Z' },
    );
    seedSession(
      db,
      { id: 'sess-a2a2', ag: 'ag-main', folder: 'main', mg: 'mg-a2a-2', thread },
      { id: 'm-a2a2', text: 'a2a', ts: '2026-06-20T00:01:00.000Z' },
    );
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/messages?group=main&thread_id=${encodeURIComponent(thread)}&limit=50`);
    const data = await res.json();
    const bySession = new Set(data.messages.map((m: any) => m.session_id));
    expect(bySession.has('sess-wh2')).toBe(true);
    expect(bySession.has('sess-a2a2')).toBe(true);
  });

  it('lane mode unions every coworker on the thread and returns an ordered lanes[] list', async () => {
    const db = createTestDbWithSessions();
    const thread = 'gh-issue-r/repo-503';
    // Three different coworkers, each with a session on the same thread.
    seedSession(
      db,
      { id: 'sess-orch', ag: 'ag-orch', folder: 'orch', mg: null, thread },
      { id: 'm-orch', text: 'orch', ts: '2026-06-20T00:00:00.000Z' },
    );
    seedSession(
      db,
      { id: 'sess-tri', ag: 'ag-tri', folder: 'triager', mg: 'mg-a2a-x', thread },
      { id: 'm-tri', text: 'triager', ts: '2026-06-20T00:01:00.000Z' },
    );
    seedSession(
      db,
      { id: 'sess-fix', ag: 'ag-fix', folder: 'fixer', mg: 'mg-a2a-y', thread },
      { id: 'm-fix', text: 'fixer', ts: '2026-06-20T00:02:00.000Z' },
    );
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/messages?thread_id=${encodeURIComponent(thread)}&lane=1&limit=50`);
    expect(res.status).toBe(200);
    const data = await res.json();
    // Messages from all three coworkers present.
    const folders = new Set(data.messages.map((m: any) => m.group_folder));
    expect(folders.has('orch')).toBe(true);
    expect(folders.has('triager')).toBe(true);
    expect(folders.has('fixer')).toBe(true);
    // Ordered lanes[] with one entry per coworker, orch first (earliest session).
    expect(Array.isArray(data.lanes)).toBe(true);
    const laneFolders = data.lanes.map((l: any) => l.folder);
    expect(laneFolders).toContain('orch');
    expect(laneFolders).toContain('triager');
    expect(laneFolders).toContain('fixer');
    expect(laneFolders[0]).toBe('orch');
  });

  it('non-lane request omits the lanes key', async () => {
    const db = createTestDbWithSessions();
    seedSession(
      db,
      { id: 'sess-nl', ag: 'ag-nl', folder: 'nl', mg: null, thread: 'gh-issue-r/repo-504' },
      { id: 'm-nl', text: 'x', ts: '2026-06-20T00:00:00.000Z' },
    );
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/messages?group=nl&thread_id=gh-issue-r/repo-504&limit=10`);
    const data = await res.json();
    expect('lanes' in data).toBe(false);
  });
});

describe('/api/kb-health — a malformed drift report never renders as zero', () => {
  const sharedDir = path.join(DATA_DIR, 'shared');
  const doctorPath = path.join(sharedDir, '.kb-doctor.json');

  const writeDoctor = (body: string) => {
    mkdirSync(sharedDir, { recursive: true });
    writeFileSync(doctorPath, body);
  };
  const clearDoctor = () => rmSync(doctorPath, { force: true });

  afterEach(() => clearDoctor());

  it('missing report is unavailable with a reason, and driftCount is null not 0', async () => {
    clearDoctor();
    const data = await (await fetch(`${baseUrl}/api/kb-health`)).json();
    expect(data.doctor.available).toBe(false);
    expect(data.doctor.reason).toBe('no drift report');
    // The distinction the whole panel turns on: unknown is not zero.
    expect(data.driftCount).toBeNull();
  });

  it('a CORRUPT report is distinguished from an absent one', async () => {
    // Both were reported as "no drift report", which conflates "the checker has not
    // run" with "the checker's output is damaged" — different problems with different
    // fixes, and the operator was told the milder one.
    writeDoctor('{ this is not json');
    const data = await (await fetch(`${baseUrl}/api/kb-health`)).json();
    expect(data.doctor.available).toBe(false);
    expect(data.doctor.reason).toMatch(/unreadable/);
    expect(data.doctor.reason).not.toBe('no drift report');
    expect(data.driftCount).toBeNull();
  });

  it('counts.drift:0 beside a non-empty drift array does NOT report zero drift', async () => {
    // The end-to-end shape of the finding: schema 1, so the old route accepted it,
    // took driftCount straight from the tally, and rendered a healthy panel over a
    // report that had found something.
    writeDoctor(
      JSON.stringify({
        schema: 1,
        generatedAt: new Date().toISOString(),
        status: 'drift',
        complete: true,
        counts: { ok: 0, drift: 0, unknown: 0 },
        drift: ['tasks: a live definition differs from the snapshot'],
        unknown: [],
      }),
    );
    const data = await (await fetch(`${baseUrl}/api/kb-health`)).json();
    expect(data.doctor.available).toBe(false);
    expect(data.doctor.reason).toMatch(/counts disagree with their arrays/);
    expect(data.driftCount).toBeNull();
    expect(data.driftCount).not.toBe(0);
  });

  it('a well-formed report is still reported normally', async () => {
    writeDoctor(
      JSON.stringify({
        schema: 1,
        generatedAt: new Date().toISOString(),
        status: 'drift',
        complete: true,
        counts: { ok: 1, drift: 1, unknown: 0 },
        drift: ['tasks: one difference'],
        unknown: [],
      }),
    );
    const data = await (await fetch(`${baseUrl}/api/kb-health`)).json();
    expect(data.doctor.available).toBe(true);
    expect(data.driftCount).toBe(1);
    expect(data.doctor.stale).toBe(false);
  });
});

describe('/api/sessions — GitHub PR/issue badge', () => {
  // pr_session_mappings and gh_thread_origin are nv-main-owned tables (see
  // src/modules/pr-mapping/store.ts and src/db/gh-thread-origin.ts there) —
  // this branch's own createDashboardTestDb() fixture doesn't create them
  // (mirrors production: an install that hasn't migrated yet), so each test
  // adds only the table(s) it needs directly.
  function seedSessionRow(
    db: Database.Database,
    row: { id: string; agentGroupId: string; threadId: string | null },
  ): void {
    db.prepare(
      'INSERT INTO agent_groups (id, name, folder, is_admin, routing, created_at) VALUES (?, ?, ?, 0, ?, ?) ON CONFLICT(id) DO NOTHING',
    ).run(row.agentGroupId, row.agentGroupId, row.agentGroupId, 'direct', new Date().toISOString());
    db.prepare('INSERT INTO sessions (id, agent_group_id, thread_id, status, created_at) VALUES (?, ?, ?, ?, ?)').run(
      row.id,
      row.agentGroupId,
      row.threadId,
      'active',
      new Date().toISOString(),
    );
  }

  it('leaves gh fields undefined for a session with no GitHub association', async () => {
    const db = createDashboardTestDb();
    seedSessionRow(db, { id: 'sess-plain', agentGroupId: 'ag-plain', threadId: null });
    db.close();
    forceOpenDbForTests();

    const data = await (await fetch(`${baseUrl}/api/sessions`)).json();
    const row = data.sessions.find((s: { session_id: string }) => s.session_id === 'sess-plain');
    expect(row).toBeTruthy();
    expect(row.ghNumber).toBeUndefined();
    expect(row.ghAuthor).toBeUndefined();
  });

  it('resolves repo/number/kind from a gh-issue-<repo>-<num> thread_id when there is no PR mapping', async () => {
    const db = createDashboardTestDb();
    seedSessionRow(db, {
      id: 'sess-triage',
      agentGroupId: 'ag-orch',
      threadId: 'gh-issue-shader-slang/slang-11487',
    });
    db.close();
    forceOpenDbForTests();

    const data = await (await fetch(`${baseUrl}/api/sessions`)).json();
    const row = data.sessions.find((s: { session_id: string }) => s.session_id === 'sess-triage');
    expect(row.ghRepo).toBe('shader-slang/slang');
    expect(row.ghNumber).toBe(11487);
    expect(row.ghKind).toBe('issue');
    expect(row.ghUrl).toBe('https://github.com/shader-slang/slang/issues/11487');
  });

  it('prefers pr_session_mappings over the thread_id parse when both exist', async () => {
    const db = createDashboardTestDb();
    // Fixer session's own thread is the ORIGIN issue's thread (per
    // docs/thread-vs-session.md), but it has claimed a DIFFERENT PR number
    // via report_pr_created — the mapping wins for repo/number (it's the
    // authoritative "this PR's webhooks route here" claim).
    seedSessionRow(db, {
      id: 'sess-fixer',
      agentGroupId: 'ag-fixer',
      threadId: 'gh-issue-shader-slang/slang-11487',
    });
    db.exec(`
      CREATE TABLE pr_session_mappings (
        repo TEXT NOT NULL, pr_number INTEGER NOT NULL, agent_group_id TEXT NOT NULL,
        session_id TEXT NOT NULL, thread_id TEXT, created_at TEXT NOT NULL, owner_instance TEXT NOT NULL,
        PRIMARY KEY (repo, pr_number)
      );
    `);
    db.prepare(
      `INSERT INTO pr_session_mappings (repo, pr_number, agent_group_id, session_id, thread_id, created_at, owner_instance)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('shader-slang/slang', 11500, 'ag-fixer', 'sess-fixer', 'gh-issue-shader-slang/slang-11487', new Date().toISOString(), 'prod');
    db.close();
    forceOpenDbForTests();

    const data = await (await fetch(`${baseUrl}/api/sessions`)).json();
    const row = data.sessions.find((s: { session_id: string }) => s.session_id === 'sess-fixer');
    expect(row.ghRepo).toBe('shader-slang/slang');
    expect(row.ghNumber).toBe(11500); // the mapped PR, not the origin issue #11487
    expect(row.ghKind).toBe('pr');
  });

  it('joins the author from gh_thread_origin by thread_id, independent of how repo/number were resolved', async () => {
    const db = createDashboardTestDb();
    // Same setup as the mapping-wins test above: session works PR #11500,
    // but its thread_id is origin issue #11487.
    seedSessionRow(db, {
      id: 'sess-fixer2',
      agentGroupId: 'ag-fixer2',
      threadId: 'gh-issue-shader-slang/slang-11487',
    });
    db.exec(`
      CREATE TABLE pr_session_mappings (
        repo TEXT NOT NULL, pr_number INTEGER NOT NULL, agent_group_id TEXT NOT NULL,
        session_id TEXT NOT NULL, thread_id TEXT, created_at TEXT NOT NULL, owner_instance TEXT NOT NULL,
        PRIMARY KEY (repo, pr_number)
      );
      CREATE TABLE gh_thread_origin (
        thread_id TEXT PRIMARY KEY, repo TEXT NOT NULL, number INTEGER NOT NULL,
        kind TEXT NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL
      );
    `);
    db.prepare(
      `INSERT INTO pr_session_mappings (repo, pr_number, agent_group_id, session_id, thread_id, created_at, owner_instance)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('shader-slang/slang', 11500, 'ag-fixer2', 'sess-fixer2', 'gh-issue-shader-slang/slang-11487', new Date().toISOString(), 'prod');
    db.prepare(
      `INSERT INTO gh_thread_origin (thread_id, repo, number, kind, author, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('gh-issue-shader-slang/slang-11487', 'shader-slang/slang', 11487, 'issue', 'the-original-filer', new Date().toISOString());
    db.close();
    forceOpenDbForTests();

    const data = await (await fetch(`${baseUrl}/api/sessions`)).json();
    const row = data.sessions.find((s: { session_id: string }) => s.session_id === 'sess-fixer2');
    expect(row.ghNumber).toBe(11500); // still the PR the session is actually working
    expect(row.ghAuthor).toBe('the-original-filer'); // but attributed to who filed the origin issue
  });

  it('degrades to no badge (not a broken response) when gh_thread_origin/pr_session_mappings do not exist', async () => {
    // No CREATE TABLE for either — this branch's own DB, and any install that
    // hasn't run the nv-main migration yet, looks exactly like this.
    const db = createDashboardTestDb();
    seedSessionRow(db, { id: 'sess-premigration', agentGroupId: 'ag-premigration', threadId: 'gh-pr-shader-slang/slang-1' });
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/sessions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const row = data.sessions.find((s: { session_id: string }) => s.session_id === 'sess-premigration');
    // thread_id parse still works (that part needs no new table) —
    expect(row.ghNumber).toBe(1);
    // — but there is no author, and the response as a whole did not break.
    expect(row.ghAuthor).toBeUndefined();
    expect(Array.isArray(data.sessions)).toBe(true);
  });
});
