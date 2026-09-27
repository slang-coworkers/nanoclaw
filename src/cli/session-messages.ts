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

  // Every filter, the sort direction and the row budget are pushed into SQL.
  // The merged result needs the first `offset + limit` rows of each table (in
  // the requested direction) and nothing more, so the read is bounded by the
  // request, not by the size of the session. Prod 2026-09-26: the previous
  // version materialized both tables (2.6 GB for one session) before slicing,
  // and took the host down with a heap OOM on every restart.
  const query = { sinceSeq, kind: kindFilter, includeSystem, reverse, fetch: offset + limit };
  const inbound = fs.existsSync(inPath) ? readRows(inPath, 'messages_in', query) : [];
  const outbound = fs.existsSync(outPath) ? readRows(outPath, 'messages_out', query) : [];

  const merged: TranscriptRow[] = [];
  for (const r of inbound) merged.push(project(r, 'in', full));
  for (const r of outbound) merged.push(project(r, 'out', full));

  // Ascending by seq is the default (chronological transcript). `reverse` sorts
  // newest-first so `--limit N --reverse` returns the most recent N rows — the
  // only way to fetch the last outbound (a plain `--limit 1` returns the OLDEST
  // row, then slices from offset 0).
  merged.sort((a, b) => (reverse ? b.seq - a.seq : a.seq - b.seq));

  return merged.slice(offset, offset + limit);
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

function readRows(dbPath: string, table: 'messages_in' | 'messages_out', q: RowQuery): RawRow[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    const where: string[] = ['seq > ?'];
    const params: unknown[] = [q.sinceSeq];
    if (q.kind) {
      where.push('kind = ?');
      params.push(q.kind);
    }
    if (!q.includeSystem) where.push("kind <> 'system'");
    params.push(q.fetch);
    const sql = `SELECT seq, kind, timestamp,
         CASE WHEN length(content) > ${MAX_CONTENT_BYTES} THEN NULL ELSE content END AS content,
         length(content) AS content_len
       FROM ${table} WHERE ${where.join(' AND ')}
       ORDER BY seq ${q.reverse ? 'DESC' : 'ASC'} LIMIT ?`;
    return db.prepare(sql).all(...params) as RawRow[];
  } finally {
    db.close();
  }
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
