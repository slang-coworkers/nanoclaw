import type { Migration } from './index.js';

/**
 * `webhook_inbox` — write-ahead record of every verified GitHub webhook
 * delivery this host accepted, keyed by GitHub's delivery GUID.
 *
 * Why: before this table a delivery lived only in the request handler's stack.
 * If the host died between GitHub's POST and the write into a session's
 * inbound.db (prod 2026-09-25/26: heap OOM on a poison `sessions messages`
 * request, then a tripwire crash-loop), the event was gone — GitHub does not
 * retry on its own, its delivery log is kept for ~3 days, and the only
 * recovery was an operator hand-replaying 110 deliveries from the App's
 * delivery API. A handler that threw was worse: the async server callback
 * rejected, GitHub saw a timeout, and the process could die on the unhandled
 * rejection.
 *
 * Now the raw body is persisted before any routing runs; the row is marked
 * `done` with the response we sent, or `failed` with a retry schedule. The
 * inbox drain (`src/webhook-inbox-drain.ts`) re-runs `failed` rows whose
 * `next_attempt_at` has passed and `pending` rows whose attempt started long
 * ago (the host died mid-processing), up to a bounded number of attempts, so a
 * delivery that kills the host is retried on a widening schedule and then
 * parked — never replayed forever (#1733's fail-once lesson).
 *
 * Processing is idempotent downstream (each routed event has a stable
 * `messages_in` row id), so a replay of a partially-processed delivery is
 * harmless.
 */
export const migration945: Migration = {
  version: 945,
  name: 'webhook-inbox',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_inbox (
        delivery_id     TEXT PRIMARY KEY,
        event_type      TEXT NOT NULL,
        trust           TEXT NOT NULL,
        raw_body        TEXT NOT NULL,
        received_at     TEXT NOT NULL,
        status          TEXT NOT NULL,
        attempts        INTEGER NOT NULL DEFAULT 0,
        started_at      TEXT,
        next_attempt_at TEXT,
        http_status     INTEGER,
        outcome_json    TEXT,
        last_error      TEXT,
        processed_at    TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_inbox_status ON webhook_inbox(status, next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_webhook_inbox_processed ON webhook_inbox(processed_at);
    `);
  },
};
