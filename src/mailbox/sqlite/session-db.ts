/**
 * SQL operations on per-session inbound/outbound DBs.
 *
 * These are NOT the central app DB — they're the cross-mount SQLite files
 * shared between host and container. Callers own the connection lifecycle
 * (open-write-close per op). See session-manager.ts header for invariants.
 */
import Database from 'better-sqlite3';

import { createInboundRecord } from '../model.js';
import type { InboundWrite } from '../model.js';
import { INBOUND_SCHEMA, OUTBOUND_SCHEMA } from './schema.js';

/**
 * The session-DB handle type, published BY the SQLite driver.
 *
 * Host code that legitimately needs a raw handle (the a2a bounce sweep,
 * runaway detection) imports this rather than `better-sqlite3` directly, so
 * the dependency points at the driver seam instead of reaching past it. If a
 * non-SQLite mailbox is ever composed, those call sites are the ones this
 * alias makes findable.
 */
export type SessionDbHandle = Database.Database;

/** Apply the inbound or outbound schema to a DB file. Idempotent. */
export function ensureSchema(dbPath: string, schema: 'inbound' | 'outbound'): void {
  const db = new Database(dbPath);
  db.pragma('journal_mode = DELETE');
  db.exec(schema === 'inbound' ? INBOUND_SCHEMA : OUTBOUND_SCHEMA);
  db.close();
}

/** Open the inbound DB for a session (host reads/writes). */
export function openInboundDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = DELETE');
  db.pragma('busy_timeout = 5000');
  return db;
}

/** Open the outbound DB for a session (host reads only). */
export function openOutboundDb(dbPath: string): Database.Database {
  const db = new Database(dbPath, { readonly: true });
  db.pragma('busy_timeout = 5000');
  return db;
}

/** Open the outbound DB for a session with write access (host direct-write path). */
export function openOutboundDbWritable(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = DELETE');
  db.pragma('busy_timeout = 5000');
  return db;
}

/** Alias: open outbound DB read-write. Only safe to call when no container is running. */
export const openOutboundDbRw = openOutboundDbWritable;

export function upsertSessionRouting(
  db: Database.Database,
  routing: { channel_type: string | null; platform_id: string | null; thread_id: string | null },
): void {
  db.prepare(
    `INSERT INTO session_routing (id, channel_type, platform_id, thread_id)
     VALUES (1, @channel_type, @platform_id, @thread_id)
     ON CONFLICT(id) DO UPDATE SET
       channel_type = excluded.channel_type,
       platform_id  = excluded.platform_id,
       thread_id    = excluded.thread_id`,
  ).run(routing);
}

export interface DestinationRow {
  name: string;
  display_name: string | null;
  type: 'channel' | 'agent';
  channel_type: string | null;
  platform_id: string | null;
  agent_group_id: string | null;
}

export function replaceDestinations(db: Database.Database, entries: DestinationRow[]): void {
  const tx = db.transaction((rows: DestinationRow[]) => {
    db.prepare('DELETE FROM destinations').run();
    const stmt = db.prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES (@name, @display_name, @type, @channel_type, @platform_id, @agent_group_id)`,
    );
    for (const row of rows) stmt.run(row);
  });
  tx(entries);
}

// ---------------------------------------------------------------------------
// messages_in
// ---------------------------------------------------------------------------

/**
 * Next even seq number for host-owned inbound.db.
 *
 * Exported so the scheduling module's task helpers can maintain the
 * host-writes-even-seq invariant without duplicating the logic. Not part of
 * the general public API — used only by this SQLite driver.
 */
export function nextEvenSeq(db: Database.Database): number {
  const maxSeq = (db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM messages_in').get() as { m: number }).m;
  return maxSeq < 2 ? 2 : maxSeq + 2 - (maxSeq % 2);
}

// Stored-timestamp shape contract for messages_in: always an ISO-8601 UTC
// string. Historically some callers slipped `Date.now()` in as a number,
// which SQLite stored as REAL and printed back as "<ms>.0" — unparseable by
// Date.parse and able to bisect downstream sorts via NaN poisoning. We guard
// at the insert site so the corruption can't re-enter the DB.
function toIsoTimestamp(raw: unknown, field: string): string {
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) return new Date(n).toISOString();
    }
    const parsed = Date.parse(s);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    throw new Error(`insertMessage: unparseable ${field} "${raw}"`);
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return new Date(raw).toISOString();
  }
  if (raw instanceof Date) return raw.toISOString();
  throw new Error(`insertMessage: invalid ${field} type ${typeof raw}`);
}

export function insertMessage(db: Database.Database, message: InboundWrite, sequence = nextEvenSeq(db)): void {
  // Normalize BEFORE createInboundRecord: upstream's parseIsoTimestamp rejects
  // anything that isn't already an exact ISO string, whereas toIsoTimestamp
  // heals the numeric/Date shapes that historically reached this write path
  // (see c2e5b14b). Coercing first keeps the guard and satisfies the parser.
  const record = createInboundRecord(
    {
      ...message,
      timestamp: toIsoTimestamp(message.timestamp, 'timestamp'),
      processAfter: message.processAfter == null ? null : toIsoTimestamp(message.processAfter, 'processAfter'),
    },
    sequence,
  );
  db.prepare(
    `INSERT INTO messages_in (id, seq, kind, timestamp, status, platform_id, channel_type, thread_id, content, process_after, recurrence, series_id, trigger, source_session_id, on_wake)
     VALUES (@id, @sequence, @kind, @timestamp, @status, @platformId, @channelType, @threadId, @content, @processAfter, @recurrence, @seriesId, @trigger, @sourceSessionId, @onWake)`,
  ).run({
    ...record,
    trigger: record.trigger ? 1 : 0,
    onWake: record.onWake ? 1 : 0,
  });
}

export function countDueMessages(db: Database.Database): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM messages_in
       WHERE status = 'pending'
         AND trigger = 1
         AND (process_after IS NULL OR SUBSTR(REPLACE(REPLACE(process_after, 'T', ' '), 'Z', ''), 1, 19) <= datetime('now'))`,
      )
      .get() as { count: number }
  ).count;
}

export function markMessageFailed(db: Database.Database, messageId: string): void {
  db.prepare("UPDATE messages_in SET status = 'failed' WHERE id = ?").run(messageId);
}

export function retryWithBackoff(db: Database.Database, messageId: string, backoffSec: number): void {
  // Compute the future timestamp in JS to avoid string-interpolating backoffSec
  // into SQL (SQL injection risk if the caller ever passes untrusted input).
  const futureMs = Date.now() + Math.max(0, Math.floor(backoffSec)) * 1000;
  const processAfter = new Date(futureMs).toISOString();
  db.prepare(`UPDATE messages_in SET tries = tries + 1, process_after = ? WHERE id = ?`).run(processAfter, messageId);
}

export function getMessageForRetry(
  db: Database.Database,
  messageId: string,
  status: string,
): { id: string; tries: number; processAfter: string | null } | undefined {
  return db
    .prepare('SELECT id, tries, process_after as processAfter FROM messages_in WHERE id = ? AND status = ?')
    .get(messageId, status) as { id: string; tries: number; processAfter: string | null } | undefined;
}

export function syncProcessingAcks(inDb: Database.Database, outDb: Database.Database): void {
  const completed = outDb
    .prepare(
      "SELECT message_id, status FROM processing_ack WHERE status IN ('completed', 'failed', 'script-skip:error')",
    )
    .all() as Array<{ message_id: string; status: string }>;

  if (completed.length === 0) return;

  // `script-skip:error` (pre-task script crashed) lands as a FAILED run —
  // semantically true, and it lets recurrence derive the trailing failed
  // streak from the occurrence rows themselves (no stored counter).
  const completeStmt = inDb.prepare(
    "UPDATE messages_in SET status = 'completed' WHERE id = ? AND status NOT IN ('completed', 'failed')",
  );
  const failStmt = inDb.prepare(
    "UPDATE messages_in SET status = 'failed' WHERE id = ? AND status NOT IN ('completed', 'failed')",
  );
  inDb.transaction(() => {
    for (const { message_id, status } of completed) {
      (status === 'script-skip:error' ? failStmt : completeStmt).run(message_id);
    }
  })();
}

export interface ProcessingClaim {
  message_id: string;
  status_changed: string;
}

/** Return processing_ack rows still in 'processing' with their claim timestamps. */
export function getProcessingClaims(outDb: Database.Database): ProcessingClaim[] {
  return outDb
    .prepare("SELECT message_id, status_changed FROM processing_ack WHERE status = 'processing'")
    .all() as ProcessingClaim[];
}

/**
 * Delete orphan 'processing' rows from processing_ack (host-side cleanup by path).
 * Only call when the container is NOT running — avoids concurrent writes.
 */
export function clearOrphanProcessingAcks(outDbPath: string): void {
  const db = openOutboundDbWritable(outDbPath);
  try {
    db.prepare("DELETE FROM processing_ack WHERE status = 'processing'").run();
  } finally {
    db.close();
  }
}

/**
 * Delete orphan 'processing' rows on an already-open DB handle. Called by the
 * host after killing a container so the leftover claim doesn't trip claim-stuck
 * on the next sweep tick (which would kill the freshly respawned container
 * before its agent-runner can run its own startup cleanup).
 *
 * Safe because the host only writes to outbound.db when no container is
 * running (we just killed it). Returns the number of rows deleted.
 */
export function deleteOrphanProcessingClaims(outDb: Database.Database): number {
  return outDb.prepare("DELETE FROM processing_ack WHERE status = 'processing'").run().changes;
}

export interface BouncedClaim {
  message_id: string;
  status: 'bounced-transient' | 'bounced-unknown';
}

/**
 * Return processing_ack rows the container marked as a transient a2a bounce
 * (markBounced in the agent-runner). These are handoffs whose recipient turn
 * errored on a transient/unknown provider fault and delivered nothing — the
 * trigger `messages_in` row is still `pending` (syncProcessingAcks ignores these
 * statuses). The host redrive sweep re-arms them; see redriveBouncedA2a.
 */
export function getBouncedClaims(outDb: Database.Database): BouncedClaim[] {
  return outDb
    .prepare("SELECT message_id, status FROM processing_ack WHERE status IN ('bounced-transient', 'bounced-unknown')")
    .all() as BouncedClaim[];
}

/**
 * Delete SPECIFIC bounced-claim rows by id on an already-open writable handle.
 * Only the ids passed are removed — never a blanket clear — so an unrelated
 * bounce that arrived concurrently is left for the next sweep. Only call when
 * the container is NOT running (single-writer). Returns rows deleted.
 */
export function deleteBouncedClaims(outDb: Database.Database, ids: string[]): number {
  if (ids.length === 0) return 0;
  const stmt = outDb.prepare('DELETE FROM processing_ack WHERE message_id = ?');
  let n = 0;
  const tx = outDb.transaction((list: string[]) => {
    for (const id of list) n += stmt.run(id).changes;
  });
  tx(ids);
  return n;
}

/**
 * Fetch the fields needed to redrive/dead-letter a bounced a2a trigger: its
 * retry counter, backoff gate, the a2a edge type, and the lineage back to the
 * delegating session (source_session_id). Returns undefined if the row is no
 * longer pending (already re-armed, completed, or failed).
 */
export function getBouncedTriggerRow(
  db: Database.Database,
  messageId: string,
):
  | {
      id: string;
      tries: number;
      processAfter: string | null;
      channelType: string | null;
      sourceSessionId: string | null;
      threadId: string | null;
      platformId: string | null;
    }
  | undefined {
  return db
    .prepare(
      `SELECT id, tries, process_after AS processAfter, channel_type AS channelType,
              source_session_id AS sourceSessionId, thread_id AS threadId, platform_id AS platformId
         FROM messages_in WHERE id = ? AND status = 'pending'`,
    )
    .get(messageId) as
    | {
        id: string;
        tries: number;
        processAfter: string | null;
        channelType: string | null;
        sourceSessionId: string | null;
        threadId: string | null;
        platformId: string | null;
      }
    | undefined;
}

export interface ContainerState {
  current_tool: string | null;
  tool_declared_timeout_ms: number | null;
  tool_started_at: string | null;
  updated_at: string;
}

/**
 * Read the container's current tool-in-flight state, if any. Returns null
 * when either the table doesn't exist yet (older session DB) or no tool is
 * active. Host sweep reads this to widen stuck-detection tolerance while
 * Bash is running with a long declared timeout.
 */
export function getContainerState(outDb: Database.Database): ContainerState | null {
  try {
    const row = outDb
      .prepare(
        `SELECT current_tool, tool_declared_timeout_ms, tool_started_at, updated_at
           FROM container_state WHERE id = 1`,
      )
      .get() as ContainerState | undefined;
    return row ?? null;
  } catch {
    // Table not present on older session DBs — treat as "no tool in flight".
    return null;
  }
}

// ---------------------------------------------------------------------------
// messages_out (read-only from host)
// ---------------------------------------------------------------------------

export interface OutboundMessage {
  id: string;
  seq: number | null;
  in_reply_to: string | null;
  timestamp: string;
  deliver_after: string | null;
  recurrence: string | null;
  kind: string;
  platform_id: string | null;
  channel_type: string | null;
  thread_id: string | null;
  content: string;
}

export function getDueOutboundMessages(db: Database.Database): OutboundMessage[] {
  return db
    .prepare(
      `SELECT * FROM messages_out
       WHERE (deliver_after IS NULL OR datetime(deliver_after) <= datetime('now'))
       ORDER BY timestamp ASC`,
    )
    .all() as OutboundMessage[];
}

// ---------------------------------------------------------------------------
// delivered
// ---------------------------------------------------------------------------

export function getDeliveredIds(db: Database.Database): Set<string> {
  return new Set(
    (db.prepare('SELECT message_out_id FROM delivered').all() as Array<{ message_out_id: string }>).map(
      (r) => r.message_out_id,
    ),
  );
}

export function markDelivered(db: Database.Database, messageOutId: string, platformMessageId: string | null): void {
  db.prepare(
    "INSERT OR IGNORE INTO delivered (message_out_id, platform_message_id, status, delivered_at) VALUES (?, ?, 'delivered', ?)",
  ).run(messageOutId, platformMessageId ?? null, new Date().toISOString());
}

export function markDeliveryFailed(db: Database.Database, messageOutId: string): void {
  db.prepare(
    "INSERT OR IGNORE INTO delivered (message_out_id, platform_message_id, status, delivered_at) VALUES (?, NULL, 'failed', ?)",
  ).run(messageOutId, new Date().toISOString());
}

/** Ensure the delivered table has columns added after initial schema. */
export function migrateDeliveredTable(db: Database.Database): void {
  const cols = new Set(
    (db.prepare("PRAGMA table_info('delivered')").all() as Array<{ name: string }>).map((c) => c.name),
  );
  if (!cols.has('platform_message_id')) {
    db.prepare('ALTER TABLE delivered ADD COLUMN platform_message_id TEXT').run();
  }
  if (!cols.has('status')) {
    db.prepare("ALTER TABLE delivered ADD COLUMN status TEXT NOT NULL DEFAULT 'delivered'").run();
  }
}

// LEGACY-COMPAT(v1-tasks): adds columns added to messages_in after the initial
// v2 schema to pre-existing session DBs — this lazy, on-open migration IS the
// upgrade path for old installs (there is no central migration for session
// DBs). No-op on fresh installs where the columns are in the baseline schema.
// Backfills existing rows so invariants hold (series_id = id).
export function migrateMessagesInTable(db: Database.Database): void {
  const cols = new Set(
    (db.prepare("PRAGMA table_info('messages_in')").all() as Array<{ name: string }>).map((c) => c.name),
  );
  if (!cols.has('series_id')) {
    db.prepare('ALTER TABLE messages_in ADD COLUMN series_id TEXT').run();
    db.prepare('UPDATE messages_in SET series_id = id WHERE series_id IS NULL').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_in_series ON messages_in(series_id)').run();
  }
  if (!cols.has('trigger')) {
    // All pre-existing rows got written with the old "every inbound wakes
    // the agent" semantics, so backfill 1 and default 1 for new inserts.
    db.prepare('ALTER TABLE messages_in ADD COLUMN trigger INTEGER NOT NULL DEFAULT 1').run();
  }
  if (!cols.has('source_session_id')) {
    // For agent-to-agent return-path routing. NULL on existing rows is fine —
    // their replies fall back to the legacy "newest active session" lookup.
    db.prepare('ALTER TABLE messages_in ADD COLUMN source_session_id TEXT').run();
  }
  if (!cols.has('on_wake')) {
    // 1 = only deliver on the container's first poll (fresh start).
    // All existing rows are normal messages, so default 0.
    db.prepare('ALTER TABLE messages_in ADD COLUMN on_wake INTEGER NOT NULL DEFAULT 0').run();
  }
}

/**
 * Look up an inbound row's source_session_id by its message id. Returns null
 * if the row doesn't exist or the column is NULL (channel inbound or
 * pre-migration a2a inbound). Used by a2a routing to route replies back to
 * the originating session.
 */
export function getInboundSourceSessionId(db: Database.Database, messageId: string): string | null {
  const row = db.prepare('SELECT source_session_id FROM messages_in WHERE id = ?').get(messageId) as
    | { source_session_id: string | null }
    | undefined;
  return row?.source_session_id ?? null;
}

/**
 * Find the source_session_id of the most recent a2a inbound row from a
 * specific peer (by agent group id). Used as a peer-affinity fallback in
 * a2a routing when an outbound reply has no `in_reply_to` (e.g. the
 * container's send_message MCP tool path didn't thread the batch's
 * in_reply_to through).
 *
 * Heuristic: "the last time this peer talked to me on this thread, which
 * session was it?" When `threadId` is provided, the lookup filters to
 * inbound rows on that exact thread — this is the multi-thread case
 * (e.g. a parent dispatches to one peer agent group on two distinct
 * threads; replying without a thread filter would route to whichever
 * thread happened to be most-recent overall, even if the sender
 * explicitly addressed a different one). When `threadId` is null/omitted
 * (single-thread peer relationship, or unthreaded a2a), the lookup falls
 * back to most-recent regardless of thread — preserving the original
 * single-thread behavior.
 *
 * Returns null when no prior a2a inbound from that peer (on the matching
 * thread, when filtered) carries a non-null source_session_id (typical
 * for pre-migration installs and brand-new dispatches).
 */
export function getMostRecentPeerSourceSessionId(
  db: Database.Database,
  peerAgentGroupId: string,
  threadId?: string | null,
): string | null {
  if (threadId) {
    const row = db
      .prepare(
        `SELECT source_session_id FROM messages_in
          WHERE channel_type = 'agent'
            AND platform_id = ?
            AND thread_id = ?
            AND source_session_id IS NOT NULL
          ORDER BY seq DESC
          LIMIT 1`,
      )
      .get(peerAgentGroupId, threadId) as { source_session_id: string | null } | undefined;
    return row?.source_session_id ?? null;
  }
  const row = db
    .prepare(
      `SELECT source_session_id FROM messages_in
        WHERE channel_type = 'agent'
          AND platform_id = ?
          AND source_session_id IS NOT NULL
        ORDER BY seq DESC
        LIMIT 1`,
    )
    .get(peerAgentGroupId) as { source_session_id: string | null } | undefined;
  return row?.source_session_id ?? null;
}
