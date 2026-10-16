import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { log } from './log.js';
import { ensureSchema, expireOrphanedCliResponses as expireSql, openInboundDb } from './mailbox/sqlite/session-db.js';
import { wrapSqliteInbound } from './mailbox/sqlite/index.js';
import {
  CLI_RESPONSE_ORPHAN_MS,
  CONTAINER_NCL_RESPONSE_TIMEOUT_MS,
  expireOrphanedCliResponses,
} from './reconcile-session.js';

// Orphaned `ncl` replies: a `cli-resp-*` system row whose requester gave up
// stays pending forever unless the host closes it. Pins: a reply a live
// requester may still read is untouched, an orphan past the window is closed,
// nothing but pending `cli-resp-*` system rows is ever touched, and a re-run
// is a no-op.

const NOW = Date.parse('2026-10-16T12:00:00.000Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

let dir: string;
let inboundPath: string;

function statuses(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT id, status FROM messages_in ORDER BY seq').all() as Array<{
    id: string;
    status: string;
  }>;
  return Object.fromEntries(rows.map((r) => [r.id, r.status]));
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-cli-orphans-'));
  inboundPath = path.join(dir, 'inbound.db');
  ensureSchema(inboundPath, 'inbound');
  const db = new Database(inboundPath);
  const ins = db.prepare(
    'INSERT INTO messages_in (id, seq, kind, timestamp, status, trigger, content) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const old = iso(CLI_RESPONSE_ORPHAN_MS + 60_000);
  const reply = '{"type":"cli_response","requestId":"x","frame":{}}';
  ins.run('cli-resp-cli-1-live', 2, 'system', iso(5_000), 'pending', 0, reply); // requester may still poll
  ins.run('cli-resp-cli-2-edge', 4, 'system', iso(CONTAINER_NCL_RESPONSE_TIMEOUT_MS + 1_000), 'pending', 0, reply); // inside margin
  ins.run('cli-resp-cli-3-orphan', 6, 'system', old, 'pending', 0, reply); // → completed
  ins.run('cli-resp-cli-4-orphan-sqlite-ts', 8, 'system', old.replace('T', ' ').slice(0, 19), 'pending', 0, reply); // → completed
  ins.run('cli-resp-cli-5-failed', 10, 'system', old, 'failed', 0, reply); // terminal → untouched
  ins.run('sys-other', 12, 'system', old, 'pending', 0, '{"type":"cost_override"}'); // other system frame
  ins.run('chat-1', 14, 'chat', old, 'pending', 1, '{}');
  ins.run('task-1', 16, 'task', old, 'pending', 1, '{}');
  ins.run('cli-resp-chat', 18, 'chat', old, 'pending', 1, '{}'); // prefix but not system
  db.close();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('expireOrphanedCliResponses', () => {
  it('closes only pending cli-resp system rows past the window, idempotently', () => {
    const info = vi.spyOn(log, 'info').mockImplementation(() => {});
    const db = openInboundDb(inboundPath);
    const mailbox = wrapSqliteInbound(db);

    expect(expireOrphanedCliResponses(mailbox, { id: 'sess-1' }, NOW)).toBe(2);
    expect(statuses(db)).toEqual({
      'cli-resp-cli-1-live': 'pending',
      'cli-resp-cli-2-edge': 'pending',
      'cli-resp-cli-3-orphan': 'completed',
      'cli-resp-cli-4-orphan-sqlite-ts': 'completed',
      'cli-resp-cli-5-failed': 'failed',
      'sys-other': 'pending',
      'chat-1': 'pending',
      'task-1': 'pending',
      'cli-resp-chat': 'pending',
    });
    expect(info).toHaveBeenCalledWith('Closed orphaned ncl replies', expect.objectContaining({ closed: 2 }));

    info.mockClear();
    expect(expireOrphanedCliResponses(mailbox, { id: 'sess-1' }, NOW)).toBe(0);
    expect(info).not.toHaveBeenCalled();
    db.close();
  });

  it('the cutoff is strict: a reply exactly at the window edge stays', () => {
    const db = openInboundDb(inboundPath);
    expect(expireSql(db, iso(CLI_RESPONSE_ORPHAN_MS + 60_000))).toBe(0);
    db.close();
  });

  it('is a no-op on a mailbox without the capability', () => {
    expect(expireOrphanedCliResponses({}, { id: 'sess-1' }, NOW)).toBe(0);
  });

  it('mirrors the container-side ncl poll timeout exactly', () => {
    // No shared modules across the Node/Bun split: pin the mirror to the source.
    const src = fs.readFileSync(path.join(process.cwd(), 'container/agent-runner/src/cli/timeout.ts'), 'utf8');
    const m = /export const NCL_RESPONSE_TIMEOUT_MS = ([\d_]+);/.exec(src);
    expect(m).not.toBeNull();
    expect(Number(m![1].replace(/_/g, ''))).toBe(CONTAINER_NCL_RESPONSE_TIMEOUT_MS);
    expect(CLI_RESPONSE_ORPHAN_MS).toBeGreaterThan(CONTAINER_NCL_RESPONSE_TIMEOUT_MS);
  });

  it('every host writer stamps a cli-resp reply at insertion time', () => {
    // The age gate is only safe if a reply's timestamp is when it was WRITTEN
    // (after its requester started polling). A writer that copied the request's
    // own timestamp could hand a still-polling requester an already-expired row.
    const writers = ['src/cli/delivery-action.ts', 'src/delivery.ts'];
    for (const file of writers) {
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const sites = src.split('id: `cli-resp-${requestId}`').slice(1);
      expect(sites.length, file).toBeGreaterThan(0);
      for (const after of sites) {
        expect(after.split('\n').slice(0, 4).join('\n'), file).toContain('timestamp: new Date().toISOString()');
      }
    }
    // A new writer elsewhere must be added to the list above.
    const all = fs
      .readdirSync(path.join(process.cwd(), 'src'), { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .filter((f) =>
        fs.readFileSync(path.join(process.cwd(), 'src', f), 'utf8').includes('id: `cli-resp-${requestId}`'),
      )
      .map((f) => `src/${f}`)
      .sort();
    expect(all).toEqual([...writers].sort());
  });
});
