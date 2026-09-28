/**
 * Webhook inbox drain — re-runs GitHub deliveries the request path did not
 * finish (see src/db/migrations/945-webhook-inbox.ts for the model).
 *
 * Runs on a timer inside the host: first pass shortly after startup (a crashed
 * host's abandoned `pending` rows are the whole point), then once a minute.
 * Each pass is a handful of indexed SQL statements when there is nothing to
 * do; when there is, each row goes through the same `processGitHubDelivery`
 * the live handler uses, so a replayed delivery is routed exactly like a fresh
 * one. Retention pruning rides along only when a retention is configured.
 *
 * A pass never overlaps itself and never throws out of the timer.
 */
import {
  acceptWebhookDelivery,
  completeWebhookDelivery,
  failWebhookDelivery,
  listRetryableWebhookDeliveries,
  pruneWebhookInbox,
  type WebhookInboxRow,
  type WebhookOutcome,
} from './db/webhook-inbox.js';
import { log } from './log.js';

export interface WebhookInboxProcessor {
  (input: { eventType: string; rawBody: string; deliveryId: string; isPeerForward: boolean }): Promise<WebhookOutcome>;
}

export interface DrainResult {
  replayed: number;
  done: number;
  failed: number;
  parked: number;
  pruned: number;
}

/**
 * Days a processed delivery stays on file. 0 (the default) = keep forever:
 * nothing is pruned by age unless an operator sets
 * NANOCLAW_WEBHOOK_INBOX_RETENTION_DAYS (operator decision 2026-09-28).
 */
export const WEBHOOK_INBOX_RETENTION_DAYS = (() => {
  const raw = Number(process.env.NANOCLAW_WEBHOOK_INBOX_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
})();

const FIRST_PASS_DELAY_MS = 20_000;
const PASS_INTERVAL_MS = 60_000;
const PRUNE_INTERVAL_MS = 6 * 60 * 60_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let lastPruneAt = 0;

/**
 * One drain pass. Exported for tests and for an operator-triggered run; the
 * timer calls it with defaults.
 */
export async function drainWebhookInbox(
  process_: WebhookInboxProcessor,
  opts: { nowIso?: string; limit?: number; prune?: boolean } = {},
): Promise<DrainResult> {
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const result: DrainResult = { replayed: 0, done: 0, failed: 0, parked: 0, pruned: 0 };

  let rows: WebhookInboxRow[];
  try {
    rows = await listRetryableWebhookDeliveries(nowIso, { limit: opts.limit });
  } catch (err) {
    // Pre-migration table or DB hiccup — nothing to drain this pass.
    log.debug('webhook-inbox: list failed (skipping pass)', {
      err: err instanceof Error ? err.message : String(err),
    });
    return result;
  }

  for (const row of rows) {
    result.replayed += 1;
    const accepted = await acceptWebhookDelivery({
      deliveryId: row.delivery_id,
      eventType: row.event_type,
      trust: row.trust,
      rawBody: row.raw_body,
      nowIso,
    });
    log.info('webhook-inbox: replaying delivery', {
      delivery: row.delivery_id,
      event: row.event_type,
      attempt: accepted.attempts,
      previous: row.status,
      lastError: row.last_error ?? undefined,
    });
    try {
      const outcome = await process_({
        eventType: row.event_type,
        rawBody: row.raw_body,
        deliveryId: row.delivery_id,
        isPeerForward: row.trust === 'peer',
      });
      await completeWebhookDelivery(row.delivery_id, outcome, nowIso);
      result.done += 1;
      log.info('webhook-inbox: replay completed', {
        delivery: row.delivery_id,
        status: outcome.status,
        body: outcome.body,
      });
    } catch (err) {
      const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
      const failure = await failWebhookDelivery(row.delivery_id, msg, nowIso);
      result.failed += 1;
      if (failure.parked) {
        result.parked += 1;
        log.error('webhook-inbox: delivery parked after exhausting attempts — operator replay needed', {
          delivery: row.delivery_id,
          event: row.event_type,
          attempts: failure.attempts,
          error: msg.split('\n')[0],
        });
      } else {
        log.warn('webhook-inbox: replay failed — scheduled again', {
          delivery: row.delivery_id,
          attempts: failure.attempts,
          nextAttemptAt: failure.nextAttemptAt,
          error: msg.split('\n')[0],
        });
      }
    }
  }

  const shouldPrune =
    WEBHOOK_INBOX_RETENTION_DAYS > 0 && (opts.prune ?? Date.parse(nowIso) - lastPruneAt >= PRUNE_INTERVAL_MS);
  if (shouldPrune) {
    lastPruneAt = Date.parse(nowIso);
    try {
      const day = 24 * 60 * 60_000;
      const doneCutoff = new Date(Date.parse(nowIso) - WEBHOOK_INBOX_RETENTION_DAYS * day).toISOString();
      const failedCutoff = new Date(Date.parse(nowIso) - 4 * WEBHOOK_INBOX_RETENTION_DAYS * day).toISOString();
      result.pruned = await pruneWebhookInbox(doneCutoff, failedCutoff);
      if (result.pruned > 0)
        log.info('webhook-inbox: pruned', { rows: result.pruned, retentionDays: WEBHOOK_INBOX_RETENTION_DAYS });
    } catch (err) {
      log.warn('webhook-inbox: prune failed', { err: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}

export function startWebhookInboxDrain(process_: WebhookInboxProcessor): void {
  if (timer) return;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const r = await drainWebhookInbox(process_);
      if (r.replayed > 0) log.info('webhook-inbox: drain pass', { ...r });
    } catch (err) {
      log.warn('webhook-inbox: drain pass threw', { err: err instanceof Error ? err.message : String(err) });
    } finally {
      running = false;
      if (timer) timer = setTimeout(() => void tick(), PASS_INTERVAL_MS);
    }
  };
  timer = setTimeout(() => void tick(), FIRST_PASS_DELAY_MS);
}

export function stopWebhookInboxDrain(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}
