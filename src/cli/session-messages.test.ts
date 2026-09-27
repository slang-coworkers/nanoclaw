/**
 * Unit tests for the read-only session transcript reader.
 *
 * Seeds a temp session folder with synthetic inbound/outbound rows and
 * exercises projection (chat-sdk text + sender, system frame rendering),
 * seq-based ordering across both DBs, default system filter, truncation,
 * and the missing-DB → empty-array path.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../config.js', async () => {
  const actual = await vi.importActual('../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-session-messages' };
});

const TEST_DIR = '/tmp/nanoclaw-test-session-messages';

import { initTestDb, closeDb, runMigrations, createAgentGroup } from '../db/index.js';
import { createSession } from '../db/sessions.js';
import { inboundDbPath, outboundDbPath } from '../mailbox/sqlite/paths.js';
import { initSessionFolder } from '../session-manager.js';
import { readSessionMessages } from './session-messages.js';

const AG = 'ag-test';
const SESS = 'sess-test';

function now(): string {
  return new Date().toISOString();
}

function seedSession() {
  createAgentGroup({ id: AG, name: 'test', folder: 'test', agent_provider: null, created_at: now() });
  createSession({
    id: SESS,
    agent_group_id: AG,
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: null,
    created_at: now(),
  });
  initSessionFolder(AG, SESS);
}

function writeInbound(rows: Array<{ seq: number; kind: string; timestamp: string; content: string }>) {
  const db = new Database(inboundDbPath(AG, SESS));
  for (const r of rows) {
    db.prepare(
      "INSERT INTO messages_in (id, seq, kind, timestamp, status, content) VALUES (?, ?, ?, ?, 'pending', ?)",
    ).run(`in-${r.seq}`, r.seq, r.kind, r.timestamp, r.content);
  }
  db.close();
}

function writeOutbound(rows: Array<{ seq: number; kind: string; timestamp: string; content: string }>) {
  const db = new Database(outboundDbPath(AG, SESS));
  for (const r of rows) {
    db.prepare('INSERT INTO messages_out (id, seq, kind, timestamp, content) VALUES (?, ?, ?, ?, ?)').run(
      `out-${r.seq}`,
      r.seq,
      r.kind,
      r.timestamp,
      r.content,
    );
  }
  db.close();
}

describe('readSessionMessages', () => {
  beforeEach(async () => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    await runMigrations(await initTestDb());
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  it('merges inbound + outbound by seq, hides system rows by default', async () => {
    seedSession();
    writeInbound([
      {
        seq: 2,
        kind: 'chat-sdk',
        timestamp: '2026-05-19T08:00:00.000Z',
        content: JSON.stringify({
          _type: 'chat:Message',
          text: 'hello',
          threadId: 'telegram:123',
          from: { displayName: 'Harsh' },
        }),
      },
      {
        seq: 4,
        kind: 'system',
        timestamp: '2026-05-19T08:00:01.000Z',
        content: JSON.stringify({ type: 'cli_response', frame: { ok: true, data: [] } }),
      },
    ]);
    writeOutbound([
      {
        seq: 3,
        kind: 'chat',
        timestamp: '2026-05-19 08:00:00',
        content: JSON.stringify({ text: 'world' }),
      },
      {
        seq: 5,
        kind: 'system',
        timestamp: '2026-05-19 08:00:01',
        content: JSON.stringify({ action: 'cli_request', command: 'sessions-list' }),
      },
    ]);

    const rows = await readSessionMessages({ id: SESS });

    // System rows filtered by default; chat-sdk + chat ordered by seq.
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ seq: 2, direction: 'in', kind: 'chat-sdk', text: 'hello', sender: 'Harsh' });
    expect(rows[1]).toMatchObject({ seq: 3, direction: 'out', kind: 'chat', text: 'world' });
  });

  it('include_system=true surfaces system frames with rendered tags', async () => {
    seedSession();
    writeInbound([
      {
        seq: 2,
        kind: 'system',
        timestamp: '2026-05-19T08:00:00.000Z',
        content: JSON.stringify({ type: 'cli_response', frame: { ok: true } }),
      },
    ]);
    writeOutbound([
      {
        seq: 3,
        kind: 'system',
        timestamp: '2026-05-19 08:00:00',
        content: JSON.stringify({ action: 'cli_request', command: 'sessions-list' }),
      },
    ]);

    const rows = await readSessionMessages({ id: SESS, include_system: true });

    expect(rows).toHaveLength(2);
    expect(rows[0].text).toBe('[system: cli_response]');
    expect(rows[1].text).toBe('[system: cli_request: sessions-list]');
  });

  it('truncates text >300 chars by default and flags truncated', async () => {
    seedSession();
    const long = 'x'.repeat(500);
    writeInbound([
      {
        seq: 2,
        kind: 'chat-sdk',
        timestamp: '2026-05-19T08:00:00.000Z',
        content: JSON.stringify({ _type: 'chat:Message', text: long }),
      },
    ]);

    const truncated = await readSessionMessages({ id: SESS });
    expect(truncated[0].text).toHaveLength(301);
    expect(truncated[0].text.endsWith('…')).toBe(true);
    expect(truncated[0].truncated).toBe(true);

    const full = await readSessionMessages({ id: SESS, full: true });
    expect(full[0].text).toBe(long);
    expect(full[0].truncated).toBeUndefined();
  });

  it('returns empty when session DB folder is missing', async () => {
    seedSession();
    fs.rmSync(inboundDbPath(AG, SESS));
    fs.rmSync(outboundDbPath(AG, SESS));

    const rows = await readSessionMessages({ id: SESS });
    expect(rows).toEqual([]);
  });

  it('throws when session id does not exist', async () => {
    await expect(readSessionMessages({ id: 'sess-nope' })).rejects.toThrow(/session not found/);
  });

  it('pages with offset/limit across both tables in seq order without loading the rest', async () => {
    seedSession();
    // 20 inbound (odd seq) + 20 outbound (even seq) chat rows, interleaved.
    writeInbound(Array.from({ length: 20 }, (_, i) => ({ seq: 2 * i + 1, kind: 'chat', timestamp: now(), content: JSON.stringify({ text: `in ${2 * i + 1}` }) })));
    writeOutbound(Array.from({ length: 20 }, (_, i) => ({ seq: 2 * i + 2, kind: 'chat', timestamp: now(), content: JSON.stringify({ text: `out ${2 * i + 2}` }) })));
    const page = await readSessionMessages({ id: SESS, offset: 5, limit: 10 });
    expect(page.map((r) => r.seq)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    const last = await readSessionMessages({ id: SESS, limit: 1, reverse: true });
    expect(last.map((r) => r.seq)).toEqual([40]);
    const tail = await readSessionMessages({ id: SESS, limit: 3, reverse: true, offset: 1 });
    expect(tail.map((r) => r.seq)).toEqual([39, 38, 37]);
    const since = await readSessionMessages({ id: SESS, since_seq: 36 });
    expect(since.map((r) => r.seq)).toEqual([37, 38, 39, 40]);
  });

  it('filters system rows in SQL so --limit counts only visible rows', async () => {
    seedSession();
    // 400 system rows first, then 3 chat rows: the old in-memory filter would have
    // needed all 403 rows to return the 3 visible ones.
    writeInbound(Array.from({ length: 400 }, (_, i) => ({ seq: 2 * i + 1, kind: 'system', timestamp: now(), content: JSON.stringify({ type: 'cli_response' }) })));
    writeOutbound([801, 803, 805].map((seq) => ({ seq, kind: 'chat', timestamp: now(), content: JSON.stringify({ text: `t${seq}` }) })));
    const rows = await readSessionMessages({ id: SESS, limit: 3 });
    expect(rows.map((r) => r.seq)).toEqual([801, 803, 805]);
  });

  it('replaces an oversized row body with a placeholder instead of loading it', async () => {
    seedSession();
    writeInbound([
      { seq: 1, kind: 'chat', timestamp: now(), content: JSON.stringify({ text: 'x'.repeat(1_000_001) }) },
      { seq: 3, kind: 'chat', timestamp: now(), content: JSON.stringify({ text: 'small' }) },
    ]);
    const rows = await readSessionMessages({ id: SESS, full: true });
    expect(rows[0].text).toMatch(/^\[content too large to display: \d+ bytes\]$/);
    expect(rows[0].truncated).toBe(true);
    expect(rows[1].text).toBe('small');
  });
});
