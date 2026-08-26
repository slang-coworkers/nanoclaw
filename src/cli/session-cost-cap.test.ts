/**
 * Tests for `readSessionCostCapStatus` — the reader backing `ncl cost-cap
 * status`. Session lookup and path resolution are mocked; the SQLite
 * read/parse path is exercised for real against a temp outbound.db, mirroring
 * `src/runaway-detect.test.ts`'s `makeOutDb`/`seedCost` helpers, since both
 * read the exact same `cost_cap` row written by the container's
 * `persistCostCap()` (container/agent-runner/src/db/session-state.ts).
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
vi.mock('../db/sessions.js', () => ({
  getSession: (...a: unknown[]) => mockGetSession(...a),
}));

const mockOutboundDbPath = vi.fn();
vi.mock('../mailbox/sqlite/paths.js', () => ({
  outboundDbPath: (...a: unknown[]) => mockOutboundDbPath(...a),
}));

import { readSessionCostCapStatus } from './session-cost-cap.js';

const SESSION = { id: 'sess-1', agent_group_id: 'ag-1' };

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-cost-cap-test-'));
  mockGetSession.mockReset();
  mockOutboundDbPath.mockReset();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function dbPathFor(name: string): string {
  return path.join(tmpDir, name);
}

/** Create an outbound.db with a real `session_state` table (matches the
 *  runner's schema — see src/db/schema.ts / container connection.ts). */
function makeOutboundDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.exec(`CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);`);
  return db;
}

/** Persist a cost_cap row the way the container's setCostCap does. */
function seedCostCap(db: Database.Database, state: Record<string, unknown>): void {
  db.prepare(`INSERT OR REPLACE INTO session_state (key, value, updated_at) VALUES ('cost_cap', ?, ?)`).run(
    JSON.stringify(state),
    new Date().toISOString(),
  );
}

describe('readSessionCostCapStatus', () => {
  it('throws when called with an empty session id', async () => {
    await expect(readSessionCostCapStatus('')).rejects.toThrow('--session is required');
  });

  it('throws when the session does not exist', async () => {
    mockGetSession.mockResolvedValue(undefined);
    await expect(readSessionCostCapStatus('missing')).rejects.toThrow('session not found: missing');
  });

  it('returns status "unknown" when outbound.db does not exist on disk', async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockOutboundDbPath.mockReturnValue(dbPathFor('nope.db'));
    expect(await readSessionCostCapStatus('sess-1')).toEqual({
      session_id: 'sess-1',
      agent_group_id: 'ag-1',
      status: 'unknown',
    });
  });

  it('returns status "unknown" when session_state table is absent (pre-cost-cap runner)', async () => {
    mockGetSession.mockResolvedValue(SESSION);
    const dbPath = dbPathFor('out.db');
    const db = new Database(dbPath);
    db.exec(`CREATE TABLE unrelated (x TEXT);`);
    db.close();
    mockOutboundDbPath.mockReturnValue(dbPath);
    expect((await readSessionCostCapStatus('sess-1')).status).toBe('unknown');
  });

  it('returns status "unknown" when no cost_cap row is present yet', async () => {
    mockGetSession.mockResolvedValue(SESSION);
    const dbPath = dbPathFor('out.db');
    makeOutboundDb(dbPath).close();
    mockOutboundDbPath.mockReturnValue(dbPath);
    expect((await readSessionCostCapStatus('sess-1')).status).toBe('unknown');
  });

  it('returns status "unknown" when the row is malformed JSON (never throws)', async () => {
    mockGetSession.mockResolvedValue(SESSION);
    const dbPath = dbPathFor('out.db');
    const db = makeOutboundDb(dbPath);
    db.prepare(`INSERT INTO session_state (key, value, updated_at) VALUES ('cost_cap', '{not json', ?)`).run(
      new Date().toISOString(),
    );
    db.close();
    mockOutboundDbPath.mockReturnValue(dbPath);
    expect((await readSessionCostCapStatus('sess-1')).status).toBe('unknown');
  });

  it('returns status "unknown" when the row has no recognizable status field', async () => {
    mockGetSession.mockResolvedValue(SESSION);
    const dbPath = dbPathFor('out.db');
    const db = makeOutboundDb(dbPath);
    seedCostCap(db, { capUsd: 10, spentUsd: 2 }); // no `status` key at all
    db.close();
    mockOutboundDbPath.mockReturnValue(dbPath);
    expect((await readSessionCostCapStatus('sess-1')).status).toBe('unknown');
  });

  it('returns status "unknown" for a garbage status value (defensive against future drift)', async () => {
    mockGetSession.mockResolvedValue(SESSION);
    const dbPath = dbPathFor('out.db');
    const db = makeOutboundDb(dbPath);
    seedCostCap(db, { status: 'not-a-real-status', capUsd: 10, spentUsd: 2 });
    db.close();
    mockOutboundDbPath.mockReturnValue(dbPath);
    expect((await readSessionCostCapStatus('sess-1')).status).toBe('unknown');
  });

  it('reports a live "ok" status with spend/cap/window', async () => {
    mockGetSession.mockResolvedValue(SESSION);
    const dbPath = dbPathFor('out.db');
    const db = makeOutboundDb(dbPath);
    seedCostCap(db, { status: 'ok', capUsd: 10, spentUsd: 1.5, immortal: false, window: 'lifetime' });
    db.close();
    mockOutboundDbPath.mockReturnValue(dbPath);
    expect(await readSessionCostCapStatus('sess-1')).toEqual({
      session_id: 'sess-1',
      agent_group_id: 'ag-1',
      status: 'ok',
      cap_usd: 10,
      spent_usd: 1.5,
      immortal: false,
      window: 'lifetime',
    });
  });

  it("reports 'stopped' — the case /supervise-issues cares about — with escalation timestamp", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    const dbPath = dbPathFor('out.db');
    const db = makeOutboundDb(dbPath);
    seedCostCap(db, {
      status: 'stopped',
      capUsd: 10,
      spentUsd: 10.4,
      immortal: false,
      window: 'lifetime',
      escalatedAt: '2026-08-20T00:00:00.000Z',
    });
    db.close();
    mockOutboundDbPath.mockReturnValue(dbPath);
    const result = await readSessionCostCapStatus('sess-1');
    expect(result.status).toBe('stopped');
    expect(result.escalated_at).toBe('2026-08-20T00:00:00.000Z');
    expect(result.decision).toBeUndefined();
  });

  it('reports the human decision once a Continue/Stop was recorded', async () => {
    mockGetSession.mockResolvedValue(SESSION);
    const dbPath = dbPathFor('out.db');
    const db = makeOutboundDb(dbPath);
    seedCostCap(db, {
      status: 'ok',
      capUsd: 20,
      spentUsd: 2,
      decision: 'continue',
      decidedAt: '2026-08-21T00:00:00.000Z',
    });
    db.close();
    mockOutboundDbPath.mockReturnValue(dbPath);
    const result = await readSessionCostCapStatus('sess-1');
    expect(result.decision).toBe('continue');
    expect(result.decided_at).toBe('2026-08-21T00:00:00.000Z');
  });

  it('reports an immortal daily-window session (dayKey present, never stopped)', async () => {
    mockGetSession.mockResolvedValue(SESSION);
    const dbPath = dbPathFor('out.db');
    const db = makeOutboundDb(dbPath);
    seedCostCap(db, {
      status: 'escalated',
      capUsd: 20,
      spentUsd: 25,
      immortal: true,
      window: 'daily',
      dayKey: '2026-08-24',
    });
    db.close();
    mockOutboundDbPath.mockReturnValue(dbPath);
    const result = await readSessionCostCapStatus('sess-1');
    expect(result.status).toBe('escalated');
    expect(result.day_key).toBe('2026-08-24');
    expect(result.immortal).toBe(true);
  });

  it('closes the database handle even when the row is malformed (no fd leak)', async () => {
    // Indirect check: opening+closing repeatedly against the same path must
    // never throw SQLITE_BUSY / EMFILE, which would happen if a prior call
    // left a handle open.
    mockGetSession.mockResolvedValue(SESSION);
    const dbPath = dbPathFor('out.db');
    const db = makeOutboundDb(dbPath);
    seedCostCap(db, { status: 'ok', capUsd: 1, spentUsd: 0 });
    db.close();
    mockOutboundDbPath.mockReturnValue(dbPath);
    for (let i = 0; i < 20; i++) {
      expect((await readSessionCostCapStatus('sess-1')).status).toBe('ok');
    }
  });
});
