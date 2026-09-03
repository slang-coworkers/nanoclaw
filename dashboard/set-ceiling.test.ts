/**
 * Live per-session cost-ceiling control (dash-1 set-ceiling-v2) — server-side
 * integration tests. Covers requirement (a) (a session's live ceiling is
 * exposed by GET /api/sessions independent of the `period` query param), the
 * always-fresh in-memory map's scan behavior (cold scan / mtime-triggered
 * refresh / session-deletion tombstone / transient read failure — via the
 * main-thread fallback, since the scan worker is disabled under VITEST; the
 * worker's own handoff-protocol behavior for the `costCaps` frame kind is
 * covered separately in state-delta.test.ts, which shares scan-worker.mjs's
 * message shape), the best-effort `latestCostAdjustment` join, and the new
 * POST /api/sessions/:sessionId/cost-ceiling bridge to the host ingress.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import {
  forceOpenDbForTests,
  getSessionCostCapForTests,
  refreshCostCapsForTests,
  resetTransientDashboardStateForTests,
  startServer,
} from './server.js';

const TEST_TMP_ROOT = mkdtempSync(path.join('/tmp', 'nanoclaw-set-ceiling-test-'));
const DATA_DIR = path.join(TEST_TMP_ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'v2.db');

let server: ReturnType<typeof startServer>;
let baseUrl = '';
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
const realFetch = globalThis.fetch;

beforeAll(() => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  consoleLogSpy.mockRestore();
  rmSync(TEST_TMP_ROOT, { recursive: true, force: true });
  delete process.env.NANOCLAW_DASHBOARD_DATA_DIR;
  delete process.env.NANOCLAW_DASHBOARD_DB_PATH;
});

beforeEach(async () => {
  process.env.NANOCLAW_DASHBOARD_DATA_DIR = DATA_DIR;
  process.env.NANOCLAW_DASHBOARD_DB_PATH = DB_PATH;
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
    server.close((err) => (err ? reject(err) : resolve()));
  });
  rmSync(DATA_DIR, { recursive: true, force: true });
  vi.unstubAllGlobals();
  delete process.env.DASHBOARD_SECRET;
});

function createCentralDb(): Database.Database {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE agent_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0,
      -- Mirrors migration 937. /api/sessions selects ag.paused, and a fixture
      -- without the column makes the whole query throw, so every row assertion
      -- below fails on an undefined row rather than on the value it checks.
      paused INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      agent_group_id TEXT NOT NULL,
      thread_id TEXT,
      status TEXT DEFAULT 'active',
      container_status TEXT DEFAULT 'stopped',
      last_active TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function seedSession(db: Database.Database, opts: { groupId: string; groupFolder: string; sessionId: string }): void {
  const now = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO agent_groups (id, name, folder, is_admin, created_at) VALUES (?, ?, ?, 0, ?)').run(
    opts.groupId,
    opts.groupFolder,
    opts.groupFolder,
    now,
  );
  db.prepare('INSERT INTO sessions (id, agent_group_id, status, created_at) VALUES (?, ?, ?, ?)').run(
    opts.sessionId,
    opts.groupId,
    'active',
    now,
  );
}

/** Write (or clear) a session's outbound.db `cost_cap` row. Returns the DB
 *  file path (useful for simulating a transient read failure). */
function writeOutboundCostCap(groupId: string, sessionId: string, blob: Record<string, unknown> | null): string {
  const sessDir = path.join(DATA_DIR, 'v2-sessions', groupId, sessionId);
  mkdirSync(sessDir, { recursive: true });
  const outPath = path.join(sessDir, 'outbound.db');
  const outDb = new Database(outPath);
  outDb.exec(`
    CREATE TABLE IF NOT EXISTS messages_out (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, in_reply_to TEXT);
    CREATE TABLE IF NOT EXISTS session_state (key TEXT PRIMARY KEY, value TEXT);
  `);
  if (blob) {
    outDb.prepare('INSERT OR REPLACE INTO session_state (key, value) VALUES (?, ?)').run('cost_cap', JSON.stringify(blob));
  } else {
    outDb.prepare("DELETE FROM session_state WHERE key = 'cost_cap'").run();
  }
  outDb.close();
  return outPath;
}

describe('GET /api/sessions — live cost ceiling, independent of period (requirement (a))', () => {
  it('exposes IDENTICAL ceiling/cap fields whether period=1d, 7d, or 30d', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-1', groupFolder: 'coworker-a', sessionId: 'sess-1' });
    db.close();
    writeOutboundCostCap('ag-1', 'sess-1', {
      capUsd: 10,
      spentUsd: 5,
      status: 'ok',
      immortal: false,
      window: 'lifetime',
      ceilingUsd: 150,
      supportsSetCeiling: true,
      epochKey: '7',
    });
    forceOpenDbForTests();
    refreshCostCapsForTests();

    const rows = await Promise.all(
      ['1d', '7d', '30d'].map(async (period) => {
        const res = await fetch(`${baseUrl}/api/sessions?period=${period}`);
        const data = await res.json();
        return data.sessions.find((s: any) => s.session_id === 'sess-1');
      }),
    );
    for (const row of rows) {
      expect(row.costCeiling).toBe(150);
      expect(row.costCeilingCents).toBe(15000);
      expect(row.costCap).toBe(10);
      expect(row.costSpent).toBe(5);
      expect(row.costStatus).toBe('ok');
      expect(row.costImmortal).toBe(false);
      expect(row.costWindow).toBe('lifetime');
      expect(row.costEpochKey).toBe('7');
      expect(row.costControlVersion).toBe(2);
    }
    // Not just individually correct — identical to EACH OTHER across periods.
    expect(rows[0]).toEqual(rows[1]);
    expect(rows[1]).toEqual(rows[2]);
  });

  it('a session with ZERO priced cost in the selected period still exposes its live ceiling', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-2', groupFolder: 'coworker-b', sessionId: 'sess-2' });
    db.close();
    writeOutboundCostCap('ag-2', 'sess-2', { ceilingUsd: 91, status: 'ok', spentUsd: 0, supportsSetCeiling: true });
    forceOpenDbForTests();
    refreshCostCapsForTests();

    const res = await fetch(`${baseUrl}/api/sessions?period=1d`);
    const data = await res.json();
    const row = data.sessions.find((s: any) => s.session_id === 'sess-2');
    expect(row.cost).toBe(0); // no priced transcript activity in this test env
    expect(row.costCeiling).toBe(91); // ...yet the live ceiling is still shown
    expect(row.costCeilingCents).toBe(9100);
  });

  it('omits every cost field for a session with no cost_cap data at all (older runner / no accrual yet)', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-3', groupFolder: 'coworker-c', sessionId: 'sess-3' });
    db.close();
    // No outbound.db written at all.
    forceOpenDbForTests();
    refreshCostCapsForTests();

    const res = await fetch(`${baseUrl}/api/sessions?period=30d`);
    const data = await res.json();
    const row = data.sessions.find((s: any) => s.session_id === 'sess-3');
    expect(row).toBeDefined();
    expect('costCeiling' in row).toBe(false);
    expect('costStatus' in row).toBe(false);
    expect('costControlVersion' in row).toBe(false);
    expect('latestCostAdjustment' in row).toBe(false);
  });

  it('sort=cost and costP99 stay period/spend-scoped — decoupled from the live ceiling', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-4', groupFolder: 'coworker-d', sessionId: 'sess-4' });
    db.close();
    writeOutboundCostCap('ag-4', 'sess-4', { ceilingUsd: 150, status: 'ok', spentUsd: 0, supportsSetCeiling: true });
    forceOpenDbForTests();
    refreshCostCapsForTests();

    const res = await fetch(`${baseUrl}/api/sessions?period=30d&sort=cost`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const row = data.sessions.find((s: any) => s.session_id === 'sess-4');
    expect(row.cost).toBe(0); // pricing cache untouched by this feature
    expect(row.costP99).toBeUndefined(); // still gated on cost>0, unaffected by this change
    expect(row.costCeiling).toBe(150); // ...while the live ceiling shows regardless
  });
});

describe('cost-cap live map — main-thread fallback scan (worker disabled under VITEST)', () => {
  it('cold scan: the first refresh pass populates a brand-new session', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-5', groupFolder: 'coworker-e', sessionId: 'sess-5' });
    db.close();
    writeOutboundCostCap('ag-5', 'sess-5', { ceilingUsd: 91, status: 'ok', supportsSetCeiling: true });
    forceOpenDbForTests();

    expect(getSessionCostCapForTests('sess-5')).toBeUndefined(); // nothing scanned yet
    refreshCostCapsForTests();
    expect(getSessionCostCapForTests('sess-5')?.ceilingUsd).toBe(91);
  });

  it('mtime-triggered refresh: a changed cost_cap blob is picked up on the next scan', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-6', groupFolder: 'coworker-f', sessionId: 'sess-6' });
    db.close();
    writeOutboundCostCap('ag-6', 'sess-6', { ceilingUsd: 100, status: 'ok', supportsSetCeiling: true });
    forceOpenDbForTests();
    refreshCostCapsForTests();
    expect(getSessionCostCapForTests('sess-6')?.ceilingUsd).toBe(100);

    writeOutboundCostCap('ag-6', 'sess-6', { ceilingUsd: 175, status: 'ok', supportsSetCeiling: true });
    refreshCostCapsForTests();
    expect(getSessionCostCapForTests('sess-6')?.ceilingUsd).toBe(175);
  });

  it('session-deletion tombstone: removing the session row clears its MAP entry, not just its API row', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-7', groupFolder: 'coworker-g', sessionId: 'sess-7' });
    writeOutboundCostCap('ag-7', 'sess-7', { ceilingUsd: 50, status: 'ok', supportsSetCeiling: true });
    forceOpenDbForTests();
    refreshCostCapsForTests();
    expect(getSessionCostCapForTests('sess-7')).toBeDefined();

    db.prepare('DELETE FROM sessions WHERE id = ?').run('sess-7');
    db.close();
    refreshCostCapsForTests();
    // Proves actual removal (memory-leak/stale-forever-data guard) — a naive
    // "does the API still show it" check would pass even without correct
    // tombstoning, since the SQL join already excludes a deleted session.
    expect(getSessionCostCapForTests('sess-7')).toBeUndefined();
  });

  it("deleting one session's row does not affect a DIFFERENT session's cached ceiling", async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-8', groupFolder: 'coworker-h', sessionId: 'sess-8a' });
    seedSession(db, { groupId: 'ag-8', groupFolder: 'coworker-h', sessionId: 'sess-8b' });
    writeOutboundCostCap('ag-8', 'sess-8a', { ceilingUsd: 10, status: 'ok', supportsSetCeiling: true });
    writeOutboundCostCap('ag-8', 'sess-8b', { ceilingUsd: 20, status: 'ok', supportsSetCeiling: true });
    forceOpenDbForTests();
    refreshCostCapsForTests();
    expect(getSessionCostCapForTests('sess-8a')?.ceilingUsd).toBe(10);
    expect(getSessionCostCapForTests('sess-8b')?.ceilingUsd).toBe(20);

    db.prepare('DELETE FROM sessions WHERE id = ?').run('sess-8a');
    db.close();
    refreshCostCapsForTests();
    expect(getSessionCostCapForTests('sess-8a')).toBeUndefined();
    expect(getSessionCostCapForTests('sess-8b')?.ceilingUsd).toBe(20); // untouched
  });

  it('a transient read failure (corrupt file, not a missing one) PRESERVES the previous good entry', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-9', groupFolder: 'coworker-i', sessionId: 'sess-9' });
    db.close();
    const outPath = writeOutboundCostCap('ag-9', 'sess-9', { ceilingUsd: 60, status: 'ok', supportsSetCeiling: true });
    forceOpenDbForTests();
    refreshCostCapsForTests();
    expect(getSessionCostCapForTests('sess-9')?.ceilingUsd).toBe(60);

    // Corrupt the file in place (still present, just unreadable as SQLite) —
    // the "errored, not confirmed absent" path, which both
    // pickLatestMessageTs (main thread) and refreshFile (worker) special-case
    // to PRESERVE the last good state rather than caching a false-empty.
    writeFileSync(outPath, 'not a sqlite file');
    expect(() => refreshCostCapsForTests()).not.toThrow();
    expect(getSessionCostCapForTests('sess-9')?.ceilingUsd).toBe(60); // preserved, not clobbered
  });
});

describe('latestCostAdjustment — cost_escalation_episodes join (best-effort; owned by the paired host+runner PR)', () => {
  it('omits latestCostAdjustment when cost_escalation_episodes does not exist yet (host+runner PR not deployed)', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-10', groupFolder: 'coworker-j', sessionId: 'sess-10' });
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/sessions?period=30d`);
    const data = await res.json();
    const row = data.sessions.find((s: any) => s.session_id === 'sess-10');
    expect(row.latestCostAdjustment).toBeUndefined();
  });

  it('surfaces the most recent set_ceiling episode for a session once the table exists', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-11', groupFolder: 'coworker-k', sessionId: 'sess-11' });
    db.exec(`
      CREATE TABLE cost_escalation_episodes (
        episode_id TEXT PRIMARY KEY, session_id TEXT, decision_state TEXT, effect_state TEXT,
        target_ceiling_usd REAL, created_at TEXT
      );
    `);
    const insert = db.prepare(
      'INSERT INTO cost_escalation_episodes (episode_id, session_id, decision_state, effect_state, target_ceiling_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    insert.run('esc-old', 'sess-11', 'ceiling_set', 'applied', 100, '2026-08-24T00:00:00.000Z');
    insert.run('esc-new', 'sess-11', 'pending', 'none', 175, '2026-08-25T00:00:00.000Z');
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/sessions?period=30d`);
    const data = await res.json();
    const row = data.sessions.find((s: any) => s.session_id === 'sess-11');
    expect(row.latestCostAdjustment).toEqual({
      id: 'esc-new',
      state: 'pending',
      targetCeilingCents: 17500,
      requestedAt: '2026-08-25T00:00:00.000Z',
    });
  });

  it('a plain continue/stop episode (no target_ceiling_usd) is never surfaced as a latestCostAdjustment', async () => {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-12', groupFolder: 'coworker-l', sessionId: 'sess-12' });
    db.exec(`
      CREATE TABLE cost_escalation_episodes (
        episode_id TEXT PRIMARY KEY, session_id TEXT, decision_state TEXT, effect_state TEXT,
        target_ceiling_usd REAL, created_at TEXT
      );
    `);
    db.prepare(
      'INSERT INTO cost_escalation_episodes (episode_id, session_id, decision_state, effect_state, target_ceiling_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('esc-continue', 'sess-12', 'continued', 'applied', null, '2026-08-25T00:00:00.000Z');
    db.close();
    forceOpenDbForTests();

    const res = await fetch(`${baseUrl}/api/sessions?period=30d`);
    const data = await res.json();
    const row = data.sessions.find((s: any) => s.session_id === 'sess-12');
    expect(row.latestCostAdjustment).toBeUndefined();
  });
});

describe('POST /api/sessions/:sessionId/cost-ceiling — the bridge to the host ingress', () => {
  const validBody = { requestId: 'cca-1', targetCeilingCents: 17500, expectedEpochKey: '7', expectedCeilingCents: 15000 };

  function seedBasicSession(): void {
    const db = createCentralDb();
    seedSession(db, { groupId: 'ag-x', groupFolder: 'coworker-x', sessionId: 'sess-x' });
    db.close();
    forceOpenDbForTests();
  }

  /** Stub global fetch so calls to the host ingress are intercepted while
   *  calls to the test's OWN dashboard server (baseUrl) pass through to the
   *  real fetch — both go through the same global, so this must discriminate
   *  by URL rather than replacing fetch wholesale. */
  function stubIngressFetch(handler: (url: string, init: any) => Response | Promise<Response>) {
    const spy = vi.fn(handler);
    vi.stubGlobal('fetch', (async (url: any, init?: any) => {
      const u = typeof url === 'string' ? url : String(url);
      if (u.includes('/api/dashboard/session-cost-ceiling')) return spy(u, init);
      return realFetch(url as any, init);
    }) as typeof fetch);
    return spy;
  }

  it('forwards EXACTLY requestId/targetCeilingCents/expectedEpochKey/expectedCeilingCents, plus sessionId and protocolVersion:2', async () => {
    seedBasicSession();
    const spy = stubIngressFetch(() => new Response(JSON.stringify({ id: 'cca-1', state: 'enqueued' }), { status: 202 }));

    const res = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(202);
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0];
    expect(url).toContain('/api/dashboard/session-cost-ceiling');
    const sentBody = JSON.parse(init.body);
    expect(sentBody).toEqual({
      sessionId: 'sess-x',
      requestId: 'cca-1',
      targetCeilingCents: 17500,
      expectedEpochKey: '7',
      expectedCeilingCents: 15000,
      protocolVersion: 2,
    });
  });

  it('rejects an out-of-range targetCeilingCents SERVER-SIDE, without ever calling the host (manipulated/bypassed request)', async () => {
    seedBasicSession();
    const spy = stubIngressFetch(() => new Response('{}', { status: 200 }));
    const res = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, targetCeilingCents: 200000 }), // over the $1000 bound
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/targetCeilingCents/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a negative/non-integer targetCeilingCents server-side too', async () => {
    seedBasicSession();
    const spy = stubIngressFetch(() => new Response('{}', { status: 200 }));
    const res = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, targetCeilingCents: -5 }),
    });
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON with 400', async () => {
    seedBasicSession();
    const res = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it.each([202, 200, 400, 404, 409, 422, 426, 503])(
    'translates an upstream %i to the SAME status code for the browser',
    async (status) => {
      seedBasicSession();
      stubIngressFetch(() => new Response(JSON.stringify({ error: `upstream said ${status}` }), { status }));
      const res = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });
      expect(res.status).toBe(status);
    },
  );

  it('409 (conflict) and 422 (immortal/no-live-ceiling) carry DISTINCT bodies — not collapsed to the same shape', async () => {
    seedBasicSession();
    stubIngressFetch(() => new Response(JSON.stringify({ error: 'stale epoch' }), { status: 409 }));
    const res409 = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    const data409 = await res409.json();
    expect(res409.status).toBe(409);
    expect(data409.error).toBe('stale epoch');

    vi.unstubAllGlobals();
    stubIngressFetch(() => new Response(JSON.stringify({ error: 'immortal session' }), { status: 422 }));
    const res422 = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    const data422 = await res422.json();
    expect(res422.status).toBe(422);
    expect(data422.error).toBe('immortal session');
    expect(data422.error).not.toBe(data409.error);
  });

  it('fills in a generic error when the upstream sends a non-ok status with no JSON body', async () => {
    seedBasicSession();
    stubIngressFetch(() => new Response('runner unavailable', { status: 503 }));
    const res = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(typeof data.error).toBe('string');
    expect(data.error.length).toBeGreaterThan(0);
  });

  it('translates a network-level failure to reach the host as 503 with a clear message', async () => {
    seedBasicSession();
    vi.stubGlobal(
      'fetch',
      (async (url: any, init?: any) => {
        const u = typeof url === 'string' ? url : String(url);
        if (u.includes('/api/dashboard/session-cost-ceiling')) throw new Error('connect ECONNREFUSED');
        return realFetch(url as any, init);
      }) as typeof fetch,
    );
    const res = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(typeof data.error).toBe('string');
  });

  it('requires auth when DASHBOARD_SECRET is set, matching every other admin-mutating endpoint', async () => {
    seedBasicSession();
    stubIngressFetch(() => new Response('{}', { status: 202 }));
    process.env.DASHBOARD_SECRET = 'test-secret-set-ceiling';
    try {
      const noAuth = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });
      expect(noAuth.status).toBe(401);

      const withAuth = await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-secret-set-ceiling' },
        body: JSON.stringify(validBody),
      });
      expect(withAuth.status).not.toBe(401);
    } finally {
      delete process.env.DASHBOARD_SECRET;
    }
  });

  it('sends the Bearer secret upstream when DASHBOARD_SECRET is set (same getDashboardSecret()/bridge pattern as /api/cost-override)', async () => {
    seedBasicSession();
    const spy = stubIngressFetch(() => new Response('{}', { status: 202 }));
    process.env.DASHBOARD_SECRET = 'test-secret-upstream';
    try {
      await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-secret-upstream' },
        body: JSON.stringify(validBody),
      });
      expect(spy).toHaveBeenCalledTimes(1);
      const [, init] = spy.mock.calls[0];
      expect(init.headers.Authorization).toBe('Bearer test-secret-upstream');
    } finally {
      delete process.env.DASHBOARD_SECRET;
    }
  });

  it('does NOT set an Authorization header upstream when DASHBOARD_SECRET is unset (open by default, SSO at the network layer)', async () => {
    seedBasicSession();
    const spy = stubIngressFetch(() => new Response('{}', { status: 202 }));
    await fetch(`${baseUrl}/api/sessions/sess-x/cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    const [, init] = spy.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});
