import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, initTestDb } from './connection.js';
import { runMigrations } from './migrations/index.js';
import {
  acceptWebhookDelivery,
  completeWebhookDelivery,
  countWebhookInbox,
  failWebhookDelivery,
  getWebhookDelivery,
  listRetryableWebhookDeliveries,
  pruneWebhookInbox,
  retryDelayMs,
  WEBHOOK_INBOX_MAX_ATTEMPTS,
} from './webhook-inbox.js';

// Write-ahead inbox for GitHub deliveries. Pins the lifecycle rules the drain
// relies on: attempts are counted when processing STARTS (so a host-killing
// payload is bounded), a redelivery re-processes instead of short-circuiting,
// and only failed-with-elapsed-backoff or abandoned-pending rows are replayed.

const T0 = '2026-09-27T12:00:00.000Z';
const plus = (ms: number): string => new Date(Date.parse(T0) + ms).toISOString();

beforeEach(async () => {
  await runMigrations(await initTestDb());
});

afterEach(async () => {
  await closeDb();
});

describe('webhook_inbox lifecycle', () => {
  it('accept inserts a pending row with attempts=1; a redelivery bumps attempts and stays pending', async () => {
    const first = await acceptWebhookDelivery({
      deliveryId: 'g1',
      eventType: 'issues',
      trust: 'github',
      rawBody: '{}',
      nowIso: T0,
    });
    expect(first).toEqual({ state: 'new', attempts: 1 });
    expect(await getWebhookDelivery('g1')).toMatchObject({
      status: 'pending',
      attempts: 1,
      started_at: T0,
      received_at: T0,
    });

    const again = await acceptWebhookDelivery({
      deliveryId: 'g1',
      eventType: 'issues',
      trust: 'github',
      rawBody: '{}',
      nowIso: plus(1000),
    });
    expect(again).toEqual({ state: 'retry', attempts: 2 });
    // received_at is the first observation; started_at moves with each attempt.
    expect(await getWebhookDelivery('g1')).toMatchObject({
      status: 'pending',
      attempts: 2,
      received_at: T0,
      started_at: plus(1000),
    });
  });

  it('complete records the response and clears the retry schedule', async () => {
    await acceptWebhookDelivery({
      deliveryId: 'g2',
      eventType: 'issue_comment',
      trust: 'github',
      rawBody: '{}',
      nowIso: T0,
    });
    await completeWebhookDelivery('g2', { status: 200, body: { ok: true, outcome: 'local' } }, plus(50));
    const row = await getWebhookDelivery('g2');
    expect(row).toMatchObject({
      status: 'done',
      http_status: 200,
      processed_at: plus(50),
      next_attempt_at: null,
      last_error: null,
    });
    expect(JSON.parse(row!.outcome_json!)).toEqual({ ok: true, outcome: 'local' });
  });

  it('fail schedules the next attempt on a widening ladder and parks after the budget', async () => {
    await acceptWebhookDelivery({
      deliveryId: 'g3',
      eventType: 'pull_request',
      trust: 'github',
      rawBody: '{}',
      nowIso: T0,
    });
    const f1 = await failWebhookDelivery('g3', 'boom', T0);
    expect(f1).toEqual({ attempts: 1, nextAttemptAt: plus(retryDelayMs(1)), parked: false });
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(5 * 60_000);
    expect(retryDelayMs(99)).toBe(6 * 60 * 60_000);

    // Burn the remaining attempts.
    let last = f1;
    for (let i = 2; i <= WEBHOOK_INBOX_MAX_ATTEMPTS; i++) {
      await acceptWebhookDelivery({
        deliveryId: 'g3',
        eventType: 'pull_request',
        trust: 'github',
        rawBody: '{}',
        nowIso: T0,
      });
      last = await failWebhookDelivery('g3', `boom ${i}`, T0);
    }
    expect(last).toEqual({ attempts: WEBHOOK_INBOX_MAX_ATTEMPTS, nextAttemptAt: null, parked: true });
    const row = await getWebhookDelivery('g3');
    expect(row).toMatchObject({
      status: 'failed',
      next_attempt_at: null,
      last_error: `boom ${WEBHOOK_INBOX_MAX_ATTEMPTS}`,
    });
    // A parked row is never offered to the drain again.
    expect(await listRetryableWebhookDeliveries(plus(365 * 24 * 3600_000))).toEqual([]);
    expect(await countWebhookInbox()).toEqual({ pending: 0, done: 0, failed: 1, parked: 1 });
  });

  it('list returns failed rows whose backoff elapsed and pending rows abandoned by a dead host — nothing else', async () => {
    // failed, backoff elapsed → replay
    await acceptWebhookDelivery({ deliveryId: 'due', eventType: 'issues', trust: 'github', rawBody: '{}', nowIso: T0 });
    await failWebhookDelivery('due', 'x', T0); // next at T0+60s
    // failed, backoff NOT elapsed → wait
    await acceptWebhookDelivery({
      deliveryId: 'soon',
      eventType: 'issues',
      trust: 'github',
      rawBody: '{}',
      nowIso: plus(50_000),
    });
    await failWebhookDelivery('soon', 'x', plus(50_000)); // next at T0+110s
    // pending, started long ago (host died) → replay
    await acceptWebhookDelivery({
      deliveryId: 'abandoned',
      eventType: 'issues',
      trust: 'peer',
      rawBody: '{}',
      nowIso: T0,
    });
    // pending, started just now (in flight) → leave alone
    await acceptWebhookDelivery({
      deliveryId: 'inflight',
      eventType: 'issues',
      trust: 'github',
      rawBody: '{}',
      nowIso: plus(89_000),
    });
    // done → never
    await acceptWebhookDelivery({
      deliveryId: 'done',
      eventType: 'issues',
      trust: 'github',
      rawBody: '{}',
      nowIso: T0,
    });
    await completeWebhookDelivery('done', { status: 200, body: {} }, T0);

    const now = plus(90_000);
    const rows = await listRetryableWebhookDeliveries(now, { staleAfterMs: 60_000 });
    expect(rows.map((r) => r.delivery_id).sort()).toEqual(['abandoned', 'due']);
    expect(rows.find((r) => r.delivery_id === 'abandoned')?.trust).toBe('peer');
  });

  it('prune drops old done rows and much older failed rows only', async () => {
    const day = 24 * 3600_000;
    await acceptWebhookDelivery({
      deliveryId: 'old-done',
      eventType: 'issues',
      trust: 'github',
      rawBody: '{}',
      nowIso: plus(-20 * day),
    });
    await completeWebhookDelivery('old-done', { status: 200, body: {} }, plus(-20 * day));
    await acceptWebhookDelivery({
      deliveryId: 'new-done',
      eventType: 'issues',
      trust: 'github',
      rawBody: '{}',
      nowIso: plus(-2 * day),
    });
    await completeWebhookDelivery('new-done', { status: 200, body: {} }, plus(-2 * day));
    await acceptWebhookDelivery({
      deliveryId: 'old-failed',
      eventType: 'issues',
      trust: 'github',
      rawBody: '{}',
      nowIso: plus(-20 * day),
    });
    await failWebhookDelivery('old-failed', 'x', plus(-20 * day));
    await acceptWebhookDelivery({
      deliveryId: 'ancient-failed',
      eventType: 'issues',
      trust: 'github',
      rawBody: '{}',
      nowIso: plus(-70 * day),
    });
    await failWebhookDelivery('ancient-failed', 'x', plus(-70 * day));

    const removed = await pruneWebhookInbox(plus(-14 * day), plus(-56 * day));
    expect(removed).toBe(2);
    expect((await getWebhookDelivery('old-done')) ?? null).toBeNull();
    expect(await getWebhookDelivery('new-done')).toBeTruthy();
    expect(await getWebhookDelivery('old-failed')).toBeTruthy();
    expect((await getWebhookDelivery('ancient-failed')) ?? null).toBeNull();
  });
});
