/**
 * Integration test for scripts/reconcile-gh-sessions.ts.
 *
 * Builds an on-disk fixture data dir (central v2.db + per-session inbound/
 * outbound DBs) and calls `reconcileGhSessions()` IN-PROCESS (no subprocess —
 * fast and deterministic in CI), asserting the lossless-merge + seq-parity +
 * idempotence invariants.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initDb, closeDb } from '../src/db/connection.js';
import { sqliteRaw } from '../src/db/drivers/sqlite.js';
import { runMigrations } from '../src/db/migrations/index.js';
import { ensureSchema } from '../src/mailbox/sqlite/session-db.js';
import { reconcileGhSessions } from '../src/reconcile-gh-sessions.js';

let dataDir: string;

function sessDir(ag: string, sess: string): string {
  return path.join(dataDir, 'v2-sessions', ag, sess);
}

function seedSessionRow(
  db: Database.Database,
  s: { id: string; ag: string; mg: string | null; thread: string; created: string; container?: string },
) {
  db.prepare(
    `INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, created_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
  ).run(s.id, s.ag, s.mg, s.thread, s.container ?? 'stopped', s.created);
}

/** Create a session's on-disk DBs and seed one inbound + one outbound row. */
function seedSessionDbs(
  ag: string,
  sess: string,
  opts: { inId: string; inSeq: number; sourceSession: string | null; outId: string; outSeq: number },
) {
  const dir = sessDir(ag, sess);
  fs.mkdirSync(dir, { recursive: true });
  const inPath = path.join(dir, 'inbound.db');
  const outPath = path.join(dir, 'outbound.db');
  ensureSchema(inPath, 'inbound');
  ensureSchema(outPath, 'outbound');

  const inDb = new Database(inPath);
  inDb
    .prepare(
      `INSERT INTO messages_in (id, seq, kind, timestamp, status, platform_id, channel_type, thread_id, content, source_session_id)
       VALUES (?, ?, 'chat', '2026-06-20T00:00:00.000Z', 'completed', 'ag-x', 'agent', 'gh-issue-r/repo-1', ?, ?)`,
    )
    .run(opts.inId, opts.inSeq, JSON.stringify({ text: opts.inId }), opts.sourceSession);
  inDb
    .prepare(
      `INSERT INTO delivered (message_out_id, platform_message_id, status, delivered_at)
       VALUES (?, ?, 'delivered', '2026-06-20T00:00:01.000Z')`,
    )
    .run(opts.outId, `plat-${opts.outId}`);
  inDb.close();

  const outDb = new Database(outPath);
  outDb
    .prepare(
      `INSERT INTO messages_out (id, seq, timestamp, kind, platform_id, channel_type, thread_id, content)
       VALUES (?, ?, '2026-06-20T00:00:02.000Z', 'chat', 'ag-x', 'agent', 'gh-issue-r/repo-1', ?)`,
    )
    .run(opts.outId, opts.outSeq, JSON.stringify({ text: opts.outId }));
  outDb.close();
}

beforeEach(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reconcile-test-'));
  fs.mkdirSync(path.join(dataDir, 'v2-sessions'), { recursive: true });

  // `reconcileGhSessions` is a standalone repair tool that opens its own raw
  // handle, so the fixture seeds raw too — the driver here only builds schema.
  const driver = await initDb(path.join(dataDir, 'v2.db'));
  await runMigrations(driver);
  const db = sqliteRaw(driver);

  // Two agent groups so a2a_session_sources FKs resolve.
  db.prepare(
    `INSERT INTO agent_groups (id, name, folder, created_at) VALUES ('ag-fixer', 'Fixer', 'fixer', '2026-06-01T00:00:00.000Z')`,
  ).run();
  db.prepare(
    `INSERT INTO agent_groups (id, name, folder, created_at) VALUES ('ag-src', 'Src', 'src', '2026-06-01T00:00:00.000Z')`,
  ).run();

  // a2a messaging groups referenced by the split sessions (sessions.messaging_group_id FK).
  for (const mg of ['mg-a2a-A', 'mg-a2a-B', 'mg-a2a-C']) {
    db.prepare(
      `INSERT INTO messaging_groups (id, channel_type, platform_id, instance, created_at) VALUES (?, 'agent', ?, 'agent', '2026-06-01T00:00:00.000Z')`,
    ).run(mg, `agent:ag-src:ag-fixer:${mg}`);
  }

  // Three sessions on the SAME gh-issue thread for ag-fixer: a triple split.
  const thread = 'gh-issue-r/repo-1';
  seedSessionRow(db, { id: 'sess-canon', ag: 'ag-fixer', mg: 'mg-a2a-A', thread, created: '2026-06-05T10:00:00.000Z' });
  seedSessionRow(db, { id: 'sess-mid', ag: 'ag-fixer', mg: 'mg-a2a-B', thread, created: '2026-06-05T11:00:00.000Z' });
  seedSessionRow(db, { id: 'sess-late', ag: 'ag-fixer', mg: 'mg-a2a-C', thread, created: '2026-06-05T12:00:00.000Z' });
  // The source session (referenced by a2a_session_sources + source_session_id).
  seedSessionRow(db, { id: 'sess-src', ag: 'ag-src', mg: null, thread: 'other', created: '2026-06-05T09:00:00.000Z' });

  // a2a lineage rows pointing at the two non-canonical recipients.
  for (const r of ['sess-mid', 'sess-late']) {
    db.prepare(
      `INSERT INTO a2a_session_sources (recipient_session_id, recipient_agent_group_id, recipient_thread_id, source_session_id, source_agent_group_id, source_thread_id, created_at)
       VALUES (?, 'ag-fixer', ?, 'sess-src', 'ag-src', 'other', '2026-06-05T11:30:00.000Z')`,
    ).run(r, thread);
  }
  await closeDb();

  // canonical: in seq 2 / out seq 1
  seedSessionDbs('ag-fixer', 'sess-canon', {
    inId: 'in-canon',
    inSeq: 2,
    sourceSession: 'sess-src',
    outId: 'out-canon',
    outSeq: 1,
  });
  seedSessionDbs('ag-fixer', 'sess-mid', {
    inId: 'in-mid',
    inSeq: 2,
    sourceSession: 'sess-mid-src',
    outId: 'out-mid',
    outSeq: 1,
  });
  seedSessionDbs('ag-fixer', 'sess-late', {
    inId: 'in-late',
    inSeq: 2,
    sourceSession: 'sess-late-src',
    outId: 'out-late',
    outSeq: 1,
  });
});

afterEach(async () => {
  await closeDb();
  if (dataDir && fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('reconcile-gh-sessions migration', () => {
  it('dry-run reports the merge plan without mutating', () => {
    const res = reconcileGhSessions({ dataDir, apply: false });
    expect(res.groups).toBe(1);
    expect(res.merged).toBe(2); // sess-mid + sess-late would merge into sess-canon
    // Nothing changed: the two non-canonical sessions are still active.
    const db = new Database(path.join(dataDir, 'v2.db'), { readonly: true });
    const active = db
      .prepare("SELECT COUNT(*) AS n FROM sessions WHERE agent_group_id='ag-fixer' AND status='active'")
      .get() as { n: number };
    db.close();
    expect(active.n).toBe(3);
  });

  it('apply merges all rows into canonical, preserves seq parity + per-message source attribution, closes merged sessions', () => {
    const res = reconcileGhSessions({ dataDir, apply: true });
    expect(res.merged).toBe(2);

    // Canonical inbound.db now holds all three inbound rows with even seqs and
    // each row's original source_session_id preserved.
    const inDb = new Database(path.join(sessDir('ag-fixer', 'sess-canon'), 'inbound.db'), { readonly: true });
    const inRows = inDb.prepare('SELECT id, seq, source_session_id FROM messages_in ORDER BY seq').all() as Array<{
      id: string;
      seq: number;
      source_session_id: string | null;
    }>;
    inDb.close();
    expect(inRows.map((r) => r.id).sort()).toEqual(['in-canon', 'in-late', 'in-mid']);
    expect(inRows.every((r) => r.seq % 2 === 0)).toBe(true); // inbound EVEN parity
    expect(new Set(inRows.map((r) => r.seq)).size).toBe(inRows.length); // unique
    const srcById = Object.fromEntries(inRows.map((r) => [r.id, r.source_session_id]));
    expect(srcById['in-mid']).toBe('sess-mid-src');
    expect(srcById['in-late']).toBe('sess-late-src');

    // Canonical outbound.db holds all three outbound rows with odd seqs.
    const outDb = new Database(path.join(sessDir('ag-fixer', 'sess-canon'), 'outbound.db'), { readonly: true });
    const outRows = outDb.prepare('SELECT id, seq FROM messages_out ORDER BY seq').all() as Array<{
      id: string;
      seq: number;
    }>;
    outDb.close();
    expect(outRows.map((r) => r.id).sort()).toEqual(['out-canon', 'out-late', 'out-mid']);
    expect(outRows.every((r) => r.seq % 2 === 1)).toBe(true); // outbound ODD parity

    // Central DB: merged sessions closed + re-pointed lineage.
    const db = new Database(path.join(dataDir, 'v2.db'), { readonly: true });
    const statuses = db
      .prepare("SELECT id, status, display_title FROM sessions WHERE agent_group_id='ag-fixer' ORDER BY created_at")
      .all() as Array<{ id: string; status: string; display_title: string | null }>;
    const lineage = db.prepare('SELECT recipient_session_id FROM a2a_session_sources').all() as Array<{
      recipient_session_id: string;
    }>;
    db.close();
    expect(statuses.find((s) => s.id === 'sess-canon')!.status).toBe('active');
    expect(statuses.find((s) => s.id === 'sess-mid')!.status).toBe('closed');
    expect(statuses.find((s) => s.id === 'sess-late')!.status).toBe('closed');
    expect(statuses.find((s) => s.id === 'sess-mid')!.display_title).toMatch(/merged→sess-canon/);
    expect(lineage.every((l) => l.recipient_session_id === 'sess-canon')).toBe(true);
  });

  it('is idempotent — a second apply copies nothing new', () => {
    reconcileGhSessions({ dataDir, apply: true });
    const res2 = reconcileGhSessions({ dataDir, apply: true });
    // After the first merge the only remaining active session has no split.
    expect(res2.groups).toBe(0);
    expect(res2.merged).toBe(0);

    const inDb = new Database(path.join(sessDir('ag-fixer', 'sess-canon'), 'inbound.db'), { readonly: true });
    const n = inDb.prepare('SELECT COUNT(*) AS n FROM messages_in').get() as { n: number };
    inDb.close();
    expect(n.n).toBe(3);
  });

  it('rewrites source_session_id references to merged sessions across other session DBs + backs up v2.db', () => {
    // Seed the SENDER session's inbound.db with a reply row whose
    // source_session_id points at a session that will be merged away (sess-mid).
    // After the merge this must be rewritten to the canonical (sess-canon),
    // else an in_reply_to reply to it would fail resolveExplicitReplyTarget's
    // active-session check.
    const srcDir = sessDir('ag-src', 'sess-src');
    fs.mkdirSync(srcDir, { recursive: true });
    const srcInPath = path.join(srcDir, 'inbound.db');
    ensureSchema(srcInPath, 'inbound');
    const srcIn = new Database(srcInPath);
    srcIn
      .prepare(
        `INSERT INTO messages_in (id, seq, kind, timestamp, status, platform_id, channel_type, thread_id, content, source_session_id)
         VALUES ('reply-from-mid', 2, 'chat', '2026-06-20T01:00:00.000Z', 'completed', 'ag-fixer', 'agent', 'gh-issue-r/repo-1', '{}', 'sess-mid')`,
      )
      .run();
    srcIn.close();

    reconcileGhSessions({ dataDir, apply: true });

    // The reference was rewritten to the canonical session.
    const check = new Database(srcInPath, { readonly: true });
    const row = check.prepare("SELECT source_session_id FROM messages_in WHERE id = 'reply-from-mid'").get() as {
      source_session_id: string;
    };
    check.close();
    expect(row.source_session_id).toBe('sess-canon');

    // A v2.db backup was created.
    const backups = fs.readdirSync(dataDir).filter((f) => f.startsWith('v2.db.bak-reconcile-'));
    expect(backups.length).toBeGreaterThan(0);
  });

  it('aborts (no mutation) when an affected session is live', async () => {
    // Flip a merged session to a live container status.
    const db = await initDb(path.join(dataDir, 'v2.db'));
    await db.run("UPDATE sessions SET container_status = 'running' WHERE id = 'sess-late'");
    await closeDb();

    const res = reconcileGhSessions({ dataDir, apply: true });
    expect(res.abortedLive).toBe(true);
    expect(res.merged).toBe(0);

    // All three still active — nothing merged.
    const check = new Database(path.join(dataDir, 'v2.db'), { readonly: true });
    const active = check
      .prepare("SELECT COUNT(*) AS n FROM sessions WHERE agent_group_id='ag-fixer' AND status='active'")
      .get() as { n: number };
    check.close();
    expect(active.n).toBe(3);
  });

  it('clearing stale running/idle status (as startup does) lets the reconcile proceed', async () => {
    // Simulate an unclean shutdown: a split session left at container_status
    // 'running' with no real container alive. The reconcile would abort...
    const db = await initDb(path.join(dataDir, 'v2.db'));
    await db.run("UPDATE sessions SET container_status = 'running' WHERE id = 'sess-late'");
    await db.run("UPDATE sessions SET container_status = 'idle' WHERE id = 'sess-mid'");
    await closeDb();
    expect(reconcileGhSessions({ dataDir, apply: false }).abortedLive).toBe(true);

    // ...but the startup stale-status reset (src/index.ts, run BEFORE the
    // reconcile) clears running/idle → stopped, after which it proceeds.
    const db2 = await initDb(path.join(dataDir, 'v2.db'));
    await db2.run("UPDATE sessions SET container_status = 'stopped' WHERE container_status IN ('running', 'idle')");
    await closeDb();

    const res = reconcileGhSessions({ dataDir, apply: true });
    expect(res.abortedLive).toBe(false);
    expect(res.merged).toBe(2);
  });
});
