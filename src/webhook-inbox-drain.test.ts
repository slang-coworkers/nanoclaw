import { afterEach, describe, expect, it, vi } from 'vitest';

const row = {
  delivery_id: 'd-1',
  event_type: 'issues',
  trust: 'github',
  raw_body: '{}',
  status: 'failed',
  last_error: null,
};
vi.mock('./db/webhook-inbox.js', () => ({
  listRetryableWebhookDeliveries: vi.fn(async () => [row]),
  acceptWebhookDelivery: vi.fn(async () => ({ attempts: 2 })),
  completeWebhookDelivery: vi.fn(async () => undefined),
  failWebhookDelivery: vi.fn(async () => undefined),
  pruneWebhookInbox: vi.fn(async () => 0),
}));

import { completeWebhookDelivery } from './db/webhook-inbox.js';
import { startWebhookInboxDrain, stopWebhookInboxDrain } from './webhook-inbox-drain.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('stopWebhookInboxDrain', () => {
  // Shutdown closes the DB after this step; a replay still routing must land
  // (and schedule its input-gate decision) before then.
  it('waits for a replay that is still in flight', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const process_ = vi.fn(
      () =>
        new Promise<{ status: number; body: Record<string, unknown> }>(
          (r) => (release = () => r({ status: 200, body: { ok: true } })),
        ),
    );
    startWebhookInboxDrain(process_);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(process_).toHaveBeenCalledTimes(1);

    let stopped = false;
    const stop = Promise.resolve(stopWebhookInboxDrain()).then(() => (stopped = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);

    release();
    await stop;
    expect(completeWebhookDelivery).toHaveBeenCalledTimes(1);
  });
});
