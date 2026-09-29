/**
 * Read/write helpers for the `webhook_inbox` table — the write-ahead record of
 * every verified GitHub webhook delivery. Schema + rationale:
 * src/db/migrations/945-webhook-inbox.ts.
 *
 * Lifecycle of a row:
 *
 *   accept   → status 'pending', attempts += 1, started_at = now
 *   complete → status 'done',    http_status + outcome_json recorded
 *   fail     → status 'failed',  next_attempt_at = now + backoff(attempts),
 *              or NULL once attempts reached WEBHOOK_INBOX_MAX_ATTEMPTS (parked)
 *
 * The drain (src/webhook-inbox-drain.ts) calls `listRetryableWebhookDeliveries`
 * and re-runs each row through `accept` → process → `complete` | `fail`.
 *
 * Every function here is fail-soft at the call site: the webhook server wraps
 * them so a missing table (pre-migration) or a DB hiccup never turns a valid
 * GitHub delivery into a 500. Durability is best-effort on top of a path that
 * already worked without it.
 */
import { getDb } from './connection.js';

export type WebhookTrust = 'github' | 'peer';
export type WebhookInboxStatus = 'pending' | 'done' | 'failed';

export interface WebhookInboxRow {
  delivery_id: string;
  event_type: string;
  trust: WebhookTrust;
  raw_body: string;
  received_at: string;
  status: WebhookInboxStatus;
  attempts: number;
  started_at: string | null;
  next_attempt_at: string | null;
  http_status: number | null;
  outcome_json: string | null;
  last_error: string | null;
  processed_at: string | null;
}

/** The HTTP response a delivery produced — what `complete` records and a replay reports. */
export interface WebhookOutcome {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Processing attempts before a delivery is parked. Six attempts span roughly
 * a day (see `retryDelayMs`), long enough to ride out a config fix or an
 * upstream outage, short enough that a host-killing payload cannot crash-loop
 * the process indefinitely: each attempt is counted BEFORE processing starts.
 */
export const WEBHOOK_INBOX_MAX_ATTEMPTS = 6;

/** Backoff after the n-th failed attempt (n ≥ 1): 1 min, 5 min, 15 min, 1 h, 6 h, 6 h … */
export function retryDelayMs(attempts: number): number {
  const ladder = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
  return ladder[Math.min(Math.max(attempts, 1), ladder.length) - 1];
}

export interface AcceptWebhookInput {
  deliveryId: string;
  eventType: string;
  trust: WebhookTrust;
  rawBody: string;
  nowIso?: string;
}

/**
 * Record that processing of a delivery is starting. A new GUID inserts a
 * `pending` row with attempts = 1; a GUID already on file (GitHub redelivery,
 * peer retry, or the drain re-running a failed row) flips the row back to
 * `pending` and bumps attempts. The caller processes either way — downstream
 * routing is idempotent — so redelivery semantics are exactly what they were
 * before the inbox existed.
 */
export async function acceptWebhookDelivery(
  input: AcceptWebhookInput,
): Promise<{ state: 'new' | 'retry'; attempts: number }> {
  const now = input.nowIso ?? new Date().toISOString();
  const db = getDb();
  const inserted = await db.run(
    `INSERT INTO webhook_inbox (delivery_id, event_type, trust, raw_body, received_at, status, attempts, started_at)
     SELECT ?, ?, ?, ?, ?, 'pending', 1, ?
      WHERE NOT EXISTS (SELECT 1 FROM webhook_inbox WHERE delivery_id = ?)`,
    input.deliveryId,
    input.eventType,
    input.trust,
    input.rawBody,
    now,
    now,
    input.deliveryId,
  );
  if (inserted.changes > 0) return { state: 'new', attempts: 1 };
  await db.run(
    `UPDATE webhook_inbox
        SET status = 'pending', attempts = attempts + 1, started_at = ?, next_attempt_at = NULL
      WHERE delivery_id = ?`,
    now,
    input.deliveryId,
  );
  const row = await db.get<{ attempts: number }>(
    'SELECT attempts FROM webhook_inbox WHERE delivery_id = ?',
    input.deliveryId,
  );
  return { state: 'retry', attempts: row?.attempts ?? 0 };
}

/** Mark a delivery processed and record the response it produced. */
export async function completeWebhookDelivery(
  deliveryId: string,
  outcome: WebhookOutcome,
  nowIso?: string,
): Promise<void> {
  await getDb().run(
    `UPDATE webhook_inbox
        SET status = 'done', http_status = ?, outcome_json = ?, processed_at = ?, next_attempt_at = NULL, last_error = NULL
      WHERE delivery_id = ?`,
    outcome.status,
    JSON.stringify(outcome.body),
    nowIso ?? new Date().toISOString(),
    deliveryId,
  );
}

/**
 * Mark the current attempt failed. Schedules the next attempt from the
 * attempt count already stamped by `accept`, or parks the row (NULL
 * `next_attempt_at`) once the budget is spent.
 */
export async function failWebhookDelivery(
  deliveryId: string,
  error: string,
  nowIso?: string,
): Promise<{ attempts: number; nextAttemptAt: string | null; parked: boolean }> {
  const db = getDb();
  const row = await db.get<{ attempts: number }>(
    'SELECT attempts FROM webhook_inbox WHERE delivery_id = ?',
    deliveryId,
  );
  const attempts = row?.attempts ?? WEBHOOK_INBOX_MAX_ATTEMPTS;
  const now = nowIso ?? new Date().toISOString();
  const parked = attempts >= WEBHOOK_INBOX_MAX_ATTEMPTS;
  const nextAttemptAt = parked ? null : new Date(Date.parse(now) + retryDelayMs(attempts)).toISOString();
  await db.run(
    `UPDATE webhook_inbox
        SET status = 'failed', next_attempt_at = ?, last_error = ?, processed_at = ?
      WHERE delivery_id = ?`,
    nextAttemptAt,
    error.slice(0, 2000),
    now,
    deliveryId,
  );
  return { attempts, nextAttemptAt, parked };
}

export interface ListRetryableOptions {
  /** Rows to hand back per drain pass. */
  limit?: number;
  /**
   * A `pending` row whose attempt started longer ago than this is treated as
   * abandoned (the host died mid-processing). Two minutes is far above any
   * legitimate processing time and far below the drain's own cadence.
   */
  staleAfterMs?: number;
}

/**
 * Deliveries the drain should re-run now: `failed` rows whose backoff has
 * elapsed, and `pending` rows abandoned by a dead host. Rows that spent their
 * attempt budget never come back — they are parked for an operator.
 */
export async function listRetryableWebhookDeliveries(
  nowIso: string,
  opts: ListRetryableOptions = {},
): Promise<WebhookInboxRow[]> {
  const limit = opts.limit ?? 50;
  const staleBefore = new Date(Date.parse(nowIso) - (opts.staleAfterMs ?? 120_000)).toISOString();
  return getDb().all<WebhookInboxRow>(
    `SELECT * FROM webhook_inbox
      WHERE attempts < ?
        AND ((status = 'failed' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?)
          OR (status = 'pending' AND started_at IS NOT NULL AND started_at <= ?))
      ORDER BY received_at ASC
      LIMIT ?`,
    WEBHOOK_INBOX_MAX_ATTEMPTS,
    nowIso,
    staleBefore,
    limit,
  );
}

/**
 * Drop `done` rows processed before `doneCutoffIso` and parked/failed rows
 * older than `failedCutoffIso`. Returns the number of rows removed.
 */
export async function pruneWebhookInbox(doneCutoffIso: string, failedCutoffIso: string): Promise<number> {
  const db = getDb();
  const done = await db.run(`DELETE FROM webhook_inbox WHERE status = 'done' AND processed_at < ?`, doneCutoffIso);
  const failed = await db.run(`DELETE FROM webhook_inbox WHERE status = 'failed' AND received_at < ?`, failedCutoffIso);
  return done.changes + failed.changes;
}

/** One row by GUID (operator/ncl reads and tests). */
export async function getWebhookDelivery(deliveryId: string): Promise<WebhookInboxRow | undefined> {
  return getDb().get<WebhookInboxRow>('SELECT * FROM webhook_inbox WHERE delivery_id = ?', deliveryId);
}

/** Status counts for the whole inbox — cheap health signal for logs and metrics. */
export async function countWebhookInbox(): Promise<Record<WebhookInboxStatus, number> & { parked: number }> {
  const rows = await getDb().all<{ status: WebhookInboxStatus; parked: number; n: number }>(
    `SELECT status,
            CASE WHEN status = 'failed' AND next_attempt_at IS NULL THEN 1 ELSE 0 END AS parked,
            COUNT(*) AS n
       FROM webhook_inbox
      GROUP BY status, parked`,
  );
  const out = { pending: 0, done: 0, failed: 0, parked: 0 };
  for (const r of rows) {
    out[r.status] += r.n;
    if (r.parked) out.parked += r.n;
  }
  return out;
}
