/**
 * Read-only transcript reader for a single session.
 *
 * Merges `messages_in` (inbound.db) and `messages_out` (outbound.db) by
 * `seq`. Both tables share a single interleaved seq space (ncl writers
 * compute nextSeq from MAX(in,out) + 1/2 — see container/agent-runner/
 * src/cli/ncl.ts), so seq is the canonical merge key. Timestamps are kept
 * as raw strings (in: ISO 8601, out: SQL `YYYY-MM-DD HH:MM:SS`) — they're
 * for display, not ordering.
 */
import Database from 'better-sqlite3';
import fs from 'fs';

import { getSession } from '../db/sessions.js';
import { inboundDbPath, outboundDbPath } from '../mailbox/sqlite/paths.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const TRUNCATE_CHARS = 300;

export interface ReadOpts {
  id: string;
  limit?: number;
  offset?: number;
  since_seq?: number;
  kind?: string;
  include_system?: boolean;
  full?: boolean;
  reverse?: boolean;
}

export interface TranscriptRow {
  seq: number;
  direction: 'in' | 'out';
  kind: string;
  timestamp: string;
  sender?: string;
  text: string;
  truncated?: true;
}

interface RawRow {
  seq: number;
  kind: string;
  timestamp: string;
  /** null when the row's content exceeds MAX_CONTENT_BYTES (see readRows). */
  content: string | null;
  content_len: number;
}

/**
 * Offset ceiling. Paging by offset needs each table to hand over
 * `offset + limit` rows, so an unbounded offset is a bounded-but-huge read.
 * Callers that need to walk deep history use `since_seq` instead.
 */
const MAX_OFFSET = 5_000;

/**
 * Rows whose content is larger than this are returned as a placeholder. A
 * transcript read must never allocate a row's entire body just to print
 * 300 chars of it.
 */
const MAX_CONTENT_BYTES = 1_000_000;

export async function readSessionMessages(opts: ReadOpts): Promise<TranscriptRow[]> {
  if (!opts.id) throw new Error('--id is required');

  const session = await getSession(opts.id);
  if (!session) throw new Error(`session not found: ${opts.id}`);

  const limit = clampLimit(opts.limit);
  const offset = Math.min(MAX_OFFSET, Math.max(0, Math.floor(Number(opts.offset ?? 0)) || 0));
  const sinceSeq = opts.since_seq !== undefined ? Number(opts.since_seq) : 0;
  const kindFilter = opts.kind ? String(opts.kind) : undefined;
  const includeSystem = Boolean(opts.include_system);
  const full = Boolean(opts.full);
  const reverse = Boolean(opts.reverse);

  const inPath = inboundDbPath(session.agent_group_id, session.id);
  const outPath = outboundDbPath(session.agent_group_id, session.id);

  // Two-phase read. Phase 1 walks each table's seq index and returns ONLY the
  // keys of the first `offset + limit` matching rows — no `content` column is
  // touched, so SQLite never reads a row's overflow pages just to skip it.
  // Phase 2 merges the two key lists, slices the requested window, and fetches
  // content for exactly those rows.
  //
  // Prod 2026-09-26: the first version materialized both tables (2.6 GB for
  // one session) before slicing and OOM'd the host. The next one bounded the
  // rows but still read the content of every row up to `offset + limit`: an
  // agent paging its own 12k-row transcript every few seconds cost 40-60 MB
  // of reads per call (strace, 2026-09-27). Content is now read once, for
  // the ≤ `limit` rows that are actually returned.
  const query = { sinceSeq, kind: kindFilter, includeSystem, reverse, fetch: offset + limit };
  const inDb = fs.existsSync(inPath) ? new Database(inPath, { readonly: true }) : null;
  const outDb = fs.existsSync(outPath) ? new Database(outPath, { readonly: true }) : null;
  try {
    const keys: Array<{ seq: number; direction: 'in' | 'out' }> = [];
    if (inDb) for (const seq of readKeys(inDb, 'messages_in', query)) keys.push({ seq, direction: 'in' });
    if (outDb) for (const seq of readKeys(outDb, 'messages_out', query)) keys.push({ seq, direction: 'out' });

    // Ascending by seq is the default (chronological transcript). `reverse` sorts
    // newest-first so `--limit N --reverse` returns the most recent N rows — the
    // only way to fetch the last outbound (a plain `--limit 1` returns the OLDEST
    // row, then slices from offset 0).
    keys.sort((a, b) => (reverse ? b.seq - a.seq : a.seq - b.seq));
    const window = keys.slice(offset, offset + limit);

    const rows = new Map<string, RawRow>();
    const inSeqs = window.filter((k) => k.direction === 'in').map((k) => k.seq);
    const outSeqs = window.filter((k) => k.direction === 'out').map((k) => k.seq);
    if (inDb && inSeqs.length) for (const r of readRowsBySeq(inDb, 'messages_in', inSeqs)) rows.set(`in:${r.seq}`, r);
    if (outDb && outSeqs.length)
      for (const r of readRowsBySeq(outDb, 'messages_out', outSeqs)) rows.set(`out:${r.seq}`, r);

    const result: TranscriptRow[] = [];
    for (const k of window) {
      const row = rows.get(`${k.direction}:${k.seq}`);
      if (row) result.push(project(row, k.direction, full));
    }
    return result;
  } finally {
    inDb?.close();
    outDb?.close();
  }
}

function clampLimit(raw: unknown): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

interface RowQuery {
  sinceSeq: number;
  kind?: string;
  includeSystem: boolean;
  reverse: boolean;
  /** Rows to fetch from this table: offset + limit of the merged request. */
  fetch: number;
}

/** Phase 1: the seq keys of the first `fetch` matching rows, in the requested direction. `content` is never selected. */
export function keyQuerySql(table: 'messages_in' | 'messages_out', q: RowQuery): { sql: string; params: unknown[] } {
  const where: string[] = ['seq > ?'];
  const params: unknown[] = [q.sinceSeq];
  if (q.kind) {
    where.push('kind = ?');
    params.push(q.kind);
  }
  if (!q.includeSystem) where.push("kind <> 'system'");
  params.push(q.fetch);
  return {
    sql: `SELECT seq FROM ${table} WHERE ${where.join(' AND ')} ORDER BY seq ${q.reverse ? 'DESC' : 'ASC'} LIMIT ?`,
    params,
  };
}

function readKeys(db: Database.Database, table: 'messages_in' | 'messages_out', q: RowQuery): number[] {
  const { sql, params } = keyQuerySql(table, q);
  return (db.prepare(sql).all(...params) as Array<{ seq: number }>).map((r) => r.seq);
}

/** Phase 2: content for exactly the selected rows (≤ MAX_LIMIT per table). */
function readRowsBySeq(db: Database.Database, table: 'messages_in' | 'messages_out', seqs: number[]): RawRow[] {
  const out: RawRow[] = [];
  // SQLite's default variable limit is generous (≥ 999); chunk anyway so a
  // raised MAX_LIMIT can never turn into a "too many SQL variables" surprise.
  for (let i = 0; i < seqs.length; i += 500) {
    const chunk = seqs.slice(i, i + 500);
    const sql = `SELECT seq, kind, timestamp,
         CASE WHEN length(content) > ${MAX_CONTENT_BYTES} THEN NULL ELSE content END AS content,
         length(content) AS content_len
       FROM ${table} WHERE seq IN (${chunk.map(() => '?').join(',')})`;
    out.push(...(db.prepare(sql).all(...chunk) as RawRow[]));
  }
  return out;
}

function project(row: RawRow, direction: 'in' | 'out', full: boolean): TranscriptRow {
  if (row.content === null) {
    return {
      seq: row.seq,
      direction,
      kind: row.kind,
      timestamp: row.timestamp,
      text: `[content too large to display: ${row.content_len} bytes]`,
      truncated: true as const,
    };
  }
  const { text, sender } = extract(row.content);
  const truncated = !full && text.length > TRUNCATE_CHARS;
  return {
    seq: row.seq,
    direction,
    kind: row.kind,
    timestamp: row.timestamp,
    ...(sender ? { sender } : {}),
    text: truncated ? text.slice(0, TRUNCATE_CHARS) + '…' : text,
    ...(truncated ? { truncated: true as const } : {}),
  };
}

function extract(content: string): { text: string; sender?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { text: content };
  }

  if (!parsed || typeof parsed !== 'object') return { text: String(content) };
  const c = parsed as Record<string, unknown>;

  // chat-sdk inbound message: { _type: "chat:Message", text, threadId, from?: { ... } }
  if (typeof c.text === 'string') {
    const sender = readSender(c);
    return { text: c.text, ...(sender ? { sender } : {}) };
  }

  // Outbound chat: { text: "..." } already covered above.

  // System frames: cli_request / cli_response / action wrappers.
  if (typeof c.action === 'string') {
    const cmd = typeof c.command === 'string' ? `: ${c.command}` : '';
    return { text: `[system: ${c.action}${cmd}]` };
  }
  if (typeof c.type === 'string') {
    return { text: `[system: ${c.type}]` };
  }

  return { text: content };
}

function readSender(c: Record<string, unknown>): string | undefined {
  const from = c.from;
  if (from && typeof from === 'object') {
    const f = from as Record<string, unknown>;
    if (typeof f.displayName === 'string' && f.displayName) return f.displayName;
    if (typeof f.name === 'string' && f.name) return f.name;
    if (typeof f.id === 'string' && f.id) return f.id;
  }
  if (typeof c.threadId === 'string') return c.threadId;
  return undefined;
}
