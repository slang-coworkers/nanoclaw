/**
 * Inbound message operations (container side).
 *
 * Reads from inbound.db (host-owned, opened read-only).
 * Writes processing status to processing_ack in outbound.db (container-owned).
 *
 * The container never writes to inbound.db — all status tracking goes through
 * processing_ack. The host reads processing_ack to sync message lifecycle.
 */
import { getConfig } from '../config.js';
import { openInboundDb, getOutboundDb } from './connection.js';

// Cache whether inbound.db has the on_wake column (added in v2.0.48).
// The container opens inbound.db read-only, so it can't ALTER —
// gracefully degrade when running against an older session DB.
let _hasOnWake: boolean | null = null;
function hasOnWakeColumn(db: ReturnType<typeof openInboundDb>): boolean {
  if (_hasOnWake !== null) return _hasOnWake;
  const cols = new Set(
    (db.prepare("PRAGMA table_info('messages_in')").all() as Array<{ name: string }>).map((c) => c.name),
  );
  _hasOnWake = cols.has('on_wake');
  return _hasOnWake;
}

export interface MessageInRow {
  id: string;
  seq: number | null;
  kind: string;
  timestamp: string;
  status: string;
  process_after: string | null;
  recurrence: string | null;
  tries: number;
  /** 1 = wake-eligible (default); 0 = accumulated context only */
  trigger: number;
  platform_id: string | null;
  channel_type: string | null;
  thread_id: string | null;
  content: string;
}

// Cap on how many messages reach the agent in one prompt. Read from
// container.json; falls back to 10.
function getMaxMessagesPerPrompt(): number {
  try {
    return getConfig().maxMessagesPerPrompt;
  } catch {
    // Config not loaded yet (e.g. test harness) — use default
    return 10;
  }
}

/**
 * Fetch pending messages that are due for processing.
 * Reads from inbound.db (read-only), filters against processing_ack in outbound.db
 * to skip messages already picked up by this or a previous container run.
 *
 * Returns the most recent `maxMessagesPerPrompt` pending rows in
 * chronological order, regardless of their `trigger` flag: accumulated
 * context (trigger=0) rides along with the wake-eligible rows so the agent
 * sees the prior context it missed. Host's countDueMessages gates waking on
 * trigger=1 separately (see src/db/session-db.ts).
 */
export function getPendingMessages(isFirstPoll = false): MessageInRow[] {
  const inbound = openInboundDb();
  const outbound = getOutboundDb();

  try {
    const onWakeFilter = hasOnWakeColumn(inbound) ? 'AND (on_wake = 0 OR ?1 = 1)' : '';
    // Exclude SIDECAR correlation rows at the SQL layer. `cli_response` and
    // `question_response` system rows are private handshakes: the `ncl` CLI and
    // `ask_user_question` MCP tool read them by their own `content LIKE
    // requestId` query and mark them done via processing_ack — they are never
    // agent-turn input. (Other system rows, e.g. action=register_group /
    // create_agent results, ARE surfaced to the agent as <system_response> and
    // must NOT be filtered — hence we key on the sidecar `type`, not a blanket
    // kind='system'.) These sidecar rows carry `process_after = NULL` (always
    // "due"), and a timed-out ncl pollResponse leaves one `pending` forever
    // with no reaper. Counted by the `ORDER BY seq DESC LIMIT N` window below,
    // they pile up at high seq and starve lower-seq scheduled tasks
    // (kind='task'), which then never fire — and since handleRecurrence only
    // advances a series on completion, the whole recurrence freezes (observed
    // 2026-07-09: the daily learnings-wiki synth stalled behind 83 orphaned
    // cli_response rows; re-arming process_after can't help because starvation
    // is on seq/position, not time). Filtering at SQL (not in JS after LIMIT)
    // makes the window count only pollable rows, so no volume of orphaned
    // correlation rows can starve a task. IFNULL(...,'') is load-bearing:
    // json_extract returns NULL for rows without a `type` key, and SQLite's
    // `NULL NOT IN (...)` is NULL (not true), which WHERE treats as false and
    // would wrongly drop every non-sidecar row (chat, task, action-system).
    const pending = inbound
      .prepare(
        `SELECT * FROM messages_in
         WHERE status = 'pending'
           AND IFNULL(json_extract(content, '$.type'), '') NOT IN ('cli_response', 'question_response')
           AND (process_after IS NULL OR datetime(process_after) <= datetime('now'))
           ${onWakeFilter}
         ORDER BY seq DESC
         LIMIT ?2`,
      )
      .all(isFirstPoll ? 1 : 0, getMaxMessagesPerPrompt()) as MessageInRow[];

    if (pending.length === 0) return [];

    // Filter out messages already acknowledged in outbound.db
    const ackedIds = new Set(
      (outbound.prepare('SELECT message_id FROM processing_ack').all() as Array<{ message_id: string }>).map(
        (r) => r.message_id,
      ),
    );

    // Reverse: we fetched DESC to take the most recent N, but the agent
    // should see them in chronological order (oldest first).
    return pending.filter((m) => !ackedIds.has(m.id)).reverse();
  } finally {
    inbound.close();
  }
}

/** Mark messages as processing — writes to processing_ack in outbound.db. */
export function markProcessing(ids: string[]): void {
  if (ids.length === 0) return;
  const db = getOutboundDb();
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO processing_ack (message_id, status, status_changed) VALUES (?, 'processing', ?)",
  );
  db.transaction(() => {
    for (const id of ids) stmt.run(id, new Date().toISOString());
  })();
}

/** Mark messages as completed — updates processing_ack in outbound.db. */
export function markCompleted(ids: string[]): void {
  if (ids.length === 0) return;
  const db = getOutboundDb();
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO processing_ack (message_id, status, status_changed) VALUES (?, 'completed', ?)",
  );
  db.transaction(() => {
    for (const id of ids) stmt.run(id, new Date().toISOString());
  })();
}

/**
 * Ack task messages whose pre-task script gated the run. The reason decides
 * the ack: `gated` (wakeAgent=false) is the monitor working as designed → a
 * plain `completed`; `error` (broken script) → `script-skip:error`, which the
 * host's ack sync records as a FAILED run so recurrence can read the trailing
 * failed streak off the occurrence rows and back the series off.
 */
export function markScriptSkipped(skips: Array<{ id: string; reason: string }>): void {
  if (skips.length === 0) return;
  const db = getOutboundDb();
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO processing_ack (message_id, status, status_changed) VALUES (?, ?, ?)',
  );
  db.transaction(() => {
    for (const s of skips) stmt.run(s.id, s.reason === 'error' ? 'script-skip:error' : 'completed', new Date().toISOString());
  })();
}

/**
 * Mark trigger messages as a transient a2a bounce — the turn errored on a
 * transient/unknown provider fault (auth outage, gateway 5xx, …) and produced
 * no delivered output, so the handoff was NOT actioned. We write a distinct
 * processing_ack status instead of 'completed' so:
 *   - the host's syncProcessingAcks (which only maps completed/failed/
 *     script-skip:error) leaves the trigger `messages_in` row PENDING, and
 *   - the host redrive sweep (redriveBouncedA2a) can find these rows by status
 *     and re-arm them with an outage-scale backoff, or dead-letter on exhaustion.
 * `status` is 'bounced-transient' (long retry budget) or 'bounced-unknown'
 * (short budget → fast dead-letter). Container startup deliberately does NOT
 * clear these (only 'processing'), so the host stays the sole re-arm authority.
 */
export function markBounced(ids: string[], status: 'bounced-transient' | 'bounced-unknown'): void {
  if (ids.length === 0) return;
  const db = getOutboundDb();
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO processing_ack (message_id, status, status_changed) VALUES ($id, $status, $ts)',
  );
  db.transaction(() => {
    for (const id of ids) stmt.run({ $id: id, $status: status, $ts: new Date().toISOString() });
  })();
}

/** Mark a single message as failed — writes to processing_ack in outbound.db. */
export function markFailed(id: string): void {
  getOutboundDb()
    .prepare(
      "INSERT OR REPLACE INTO processing_ack (message_id, status, status_changed) VALUES (?, 'failed', ?)",
    )
    .run(id, new Date().toISOString());
}

/** Get a message by ID (read from inbound.db). */
export function getMessageIn(id: string): MessageInRow | undefined {
  const inbound = openInboundDb();
  try {
    return inbound.prepare('SELECT * FROM messages_in WHERE id = ?').get(id) as MessageInRow | undefined;
  } finally {
    inbound.close();
  }
}

/** Get a message by seq (the integer id surfaced to the agent in formatted
 *  messages, e.g. `<message id="120">`). Used by the `in_reply_to` arg on
 *  send_message/send_file so the agent can name an exact inbound row when
 *  the batch contains several. */
export function getMessageInBySeq(seq: number): MessageInRow | undefined {
  if (!Number.isInteger(seq) || seq <= 0) return undefined;
  const inbound = openInboundDb();
  try {
    return inbound.prepare('SELECT * FROM messages_in WHERE seq = ?').get(seq) as MessageInRow | undefined;
  } finally {
    inbound.close();
  }
}

/**
 * True if this session has ever received an inbound row from the given
 * (channel_type, platform_id, thread_id) tuple — i.e. the peer has talked
 * to us on this thread before. Pairs with `hasOutboundToThread` for the
 * a2a runtime guard: a write to a peer-owned thread without explicit
 * in_reply_to indicates the agent is dropping context.
 */
export function hasInboundFromThread(
  channelType: string,
  platformId: string,
  threadId: string,
): boolean {
  const inbound = openInboundDb();
  try {
    const result = inbound
      .prepare(
        `SELECT COUNT(*) AS n FROM messages_in
          WHERE channel_type = ? AND platform_id = ? AND thread_id = ?`,
      )
      .get(channelType, platformId, threadId) as { n: number } | undefined;
    return (result?.n ?? 0) > 0;
  } finally {
    inbound.close();
  }
}

/**
 * Inbound rows on the given (channel_type, platform_id, thread_id) tuple
 * that have NOT yet been responded to (no outbound row has
 * `in_reply_to = inbound.id`). Returned newest-first.
 *
 * Used to auto-default `in_reply_to` when the agent calls send_message on a
 * peer-originated thread without specifying which inbound it's answering.
 * The "unresponded" filter prevents re-linking to inbounds the agent has
 * already replied to — those are no longer the active conversation.
 *
 * Implementation: 1-query inbound fetch + 1 prepared "is this responded"
 * stmt reused across the small candidate set. Avoids loading every
 * responded id into JS while staying compatible with the per-DB test-mode
 * connections (ATTACH doesn't work across `:memory:` DBs).
 */
export function getUnrespondedInboundsFromThread(
  channelType: string,
  platformId: string,
  threadId: string,
): MessageInRow[] {
  const inbound = openInboundDb();
  try {
    const inboundRows = inbound
      .prepare(
        `SELECT * FROM messages_in
          WHERE channel_type = ? AND platform_id = ? AND thread_id = ?
          ORDER BY seq DESC`,
      )
      .all(channelType, platformId, threadId) as MessageInRow[];
    if (inboundRows.length === 0) return [];
    const isResponded = getOutboundDb()
      .prepare('SELECT 1 AS r FROM messages_out WHERE in_reply_to = ? LIMIT 1');
    return inboundRows.filter((r) => !isResponded.get(r.id));
  } finally {
    inbound.close();
  }
}

/**
 * Find a pending response to a question (by questionId in content).
 * Reads from inbound.db, checks processing_ack to skip already-handled responses.
 */
export function findQuestionResponse(questionId: string): MessageInRow | undefined {
  const inbound = openInboundDb();
  const outbound = getOutboundDb();

  try {
    const response = inbound
      .prepare("SELECT * FROM messages_in WHERE status = 'pending' AND content LIKE ?")
      .get(`%"questionId":"${questionId}"%`) as MessageInRow | undefined;

    if (!response) return undefined;

    // Check it hasn't been acked already
    const acked = outbound.prepare('SELECT 1 FROM processing_ack WHERE message_id = ?').get(response.id);
    if (acked) return undefined;

    return response;
  } finally {
    inbound.close();
  }
}
