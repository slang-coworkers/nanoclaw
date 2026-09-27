import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// End-to-end: the real HTTP server + the real in-memory central DB, with only
// the routing functions (webhook-github.js) mocked. Pins the write-ahead
// contract of the webhook inbox:
//   • every verified delivery is on file before routing runs, and marked done
//     with the exact response GitHub received;
//   • a routing throw becomes a 500 + a failed row with a retry schedule
//     (before this the async server callback simply rejected);
//   • the drain re-runs failed / abandoned rows through the same processor and
//     the replay lands the event exactly like a fresh delivery would;
//   • a GitHub redelivery re-processes (no short-circuit) — downstream dedup
//     is what makes it idempotent, exactly as before the inbox existed;
//   • an unsigned request is never recorded.

vi.mock('./config.js', () => ({
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GITHUB_WEBHOOK_PORT: 0,
  GITHUB_WEBHOOK_BOT_MENTION: '@bot',
  GITHUB_WEBHOOK_OWNER_ALLOWLIST: [],
  GITHUB_WEBHOOK_OWNER_DENYLIST: [],
  INSTANCE_FORWARD_TARGETS: {},
  INSTANCE_SLUG: 'prod',
  ROUTE_ISSUES_TO: '',
  ROUTE_READY_PRS_TO: '',
  INTERNAL_REGISTER_SECRET: 'trust-secret',
  APPROVER_CI_GATE: false,
  CI_GATE_REQUIRED_SUITE: '',
  CI_GATE_REQUIRED_CHECK_RUN: {},
  CENTRAL_DB_PATH: ':memory:',
}));

vi.mock('./webhook-github.js', () => ({
  deliverGitHubMention: vi.fn(),
  deliverGitHubIssueOpened: vi.fn(),
  deliverGitHubPrReviewable: vi.fn(),
  deliverGitHubPrEvent: vi.fn(),
  releaseParkedReviewable: vi.fn(),
}));

vi.mock('./modules/pr-mapping/register-endpoint.js', () => ({ handleRegisterPr: vi.fn() }));
vi.mock('./modules/pr-mapping/store.js', () => ({ prMappingExists: vi.fn(() => false) }));
vi.mock('./modules/pending-reviewable/ci-check.js', () => ({ requiredCheckRunGreen: vi.fn(() => true) }));
vi.mock('./modules/pending-reviewable/store.js', () => ({ deleteParked: vi.fn(), findParkedByHead: vi.fn() }));
vi.mock('./env.js', () => ({ readEnvFile: () => ({}) }));

import crypto from 'crypto';

import { closeDb, initTestDb } from './db/connection.js';
import { runMigrations } from './db/migrations/index.js';
import { getWebhookDelivery, WEBHOOK_INBOX_MAX_ATTEMPTS } from './db/webhook-inbox.js';
import { processGitHubDelivery, startGitHubWebhookServer } from './github-webhook-server.js';
import { drainWebhookInbox } from './webhook-inbox-drain.js';
import { deliverGitHubIssueOpened } from './webhook-github.js';

const issueOpenedMock = vi.mocked(deliverGitHubIssueOpened);

function sign(body: string, secret = 'test-secret'): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

const ISSUE_OPENED = {
  action: 'opened',
  repository: { full_name: 'shader-slang/slang' },
  issue: {
    number: 42,
    title: 'Crash',
    body: 'repro',
    html_url: 'https://github.com/shader-slang/slang/issues/42',
    user: { login: 'alice' },
    labels: [],
  },
};

describe('github webhook inbox (write-ahead + drain)', () => {
  let handle: ReturnType<typeof startGitHubWebhookServer>;
  let baseUrl: string;
  const realFetch = globalThis.fetch;

  async function post(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const body = JSON.stringify(payload);
    const res = await realFetch(`${baseUrl}/webhook/github`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-github-event': 'issues', ...headers },
      body,
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  function signedHeaders(delivery: string, payload: unknown = ISSUE_OPENED): Record<string, string> {
    return { 'x-github-delivery': delivery, 'x-hub-signature-256': sign(JSON.stringify(payload)) };
  }

  beforeEach(async () => {
    await runMigrations(await initTestDb());
    issueOpenedMock.mockReset().mockResolvedValue('local');
    handle = startGitHubWebhookServer();
    await new Promise<void>((resolve) => {
      if (handle.server.listening) return resolve();
      handle.server.once('listening', () => resolve());
    });
    const addr = handle.server.address();
    baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  });

  afterEach(async () => {
    await handle.stop();
    await closeDb();
  });

  it('records a verified delivery before routing and marks it done with the response that was sent', async () => {
    const { status, json } = await post(ISSUE_OPENED, signedHeaders('d-1'));
    expect(status).toBe(200);
    expect(json).toEqual({ ok: true, outcome: 'local' });
    const row = await getWebhookDelivery('d-1');
    expect(row).toMatchObject({ status: 'done', attempts: 1, event_type: 'issues', trust: 'github', http_status: 200 });
    expect(JSON.parse(row!.outcome_json!)).toEqual({ ok: true, outcome: 'local' });
    expect(row!.raw_body).toBe(JSON.stringify(ISSUE_OPENED));
    expect(issueOpenedMock).toHaveBeenCalledTimes(1);
    expect(issueOpenedMock.mock.calls[0][0]).toMatchObject({
      repo: 'shader-slang/slang',
      issueNumber: 42,
      deliveryId: 'd-1',
    });
  });

  it('never records an unsigned request', async () => {
    const { status } = await post(ISSUE_OPENED, {
      'x-github-delivery': 'd-unsigned',
      'x-hub-signature-256': 'sha256=nope',
    });
    expect(status).toBe(401);
    expect((await getWebhookDelivery('d-unsigned')) ?? null).toBeNull();
    expect(issueOpenedMock).not.toHaveBeenCalled();
  });

  it('records a skip decision too (skipped events are done rows, not retries)', async () => {
    const payload = { ...ISSUE_OPENED, action: 'edited' };
    const { status, json } = await post(payload, signedHeaders('d-skip', payload));
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: true, skipped: true });
    expect(await getWebhookDelivery('d-skip')).toMatchObject({ status: 'done', http_status: 200 });
  });

  it('turns a routing throw into a 500 + a failed row with a retry schedule, then the drain replays it', async () => {
    issueOpenedMock.mockRejectedValueOnce(new Error('inbound.db locked'));
    const { status, json } = await post(ISSUE_OPENED, signedHeaders('d-2'));
    expect(status).toBe(500);
    expect(json).toMatchObject({ ok: false, error: 'processing failed', delivery: 'd-2', will_retry: true });
    const failed = await getWebhookDelivery('d-2');
    expect(failed).toMatchObject({ status: 'failed', attempts: 1 });
    expect(failed!.last_error).toContain('inbound.db locked');
    expect(failed!.next_attempt_at).not.toBeNull();

    // Backoff not elapsed → the drain leaves it alone.
    const early = await drainWebhookInbox(processGitHubDelivery, { nowIso: new Date().toISOString(), prune: false });
    expect(early.replayed).toBe(0);

    // Backoff elapsed → replayed through the same processor, lands like a fresh delivery.
    const later = new Date(Date.parse(failed!.next_attempt_at!) + 1000).toISOString();
    const r = await drainWebhookInbox(processGitHubDelivery, { nowIso: later, prune: false });
    expect(r).toMatchObject({ replayed: 1, done: 1, failed: 0, parked: 0 });
    expect(issueOpenedMock).toHaveBeenCalledTimes(2);
    expect(issueOpenedMock.mock.calls[1][0]).toMatchObject({
      repo: 'shader-slang/slang',
      issueNumber: 42,
      deliveryId: 'd-2',
    });
    const done = await getWebhookDelivery('d-2');
    expect(done).toMatchObject({
      status: 'done',
      attempts: 2,
      http_status: 200,
      last_error: null,
      next_attempt_at: null,
    });
    expect(JSON.parse(done!.outcome_json!)).toEqual({ ok: true, outcome: 'local' });
  });

  it('replays a pending row abandoned by a dead host, and parks a delivery that keeps failing', async () => {
    // Simulate "host died mid-processing": a pending row whose attempt started long ago.
    const { acceptWebhookDelivery } = await import('./db/webhook-inbox.js');
    const longAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    await acceptWebhookDelivery({
      deliveryId: 'd-dead',
      eventType: 'issues',
      trust: 'github',
      rawBody: JSON.stringify(ISSUE_OPENED),
      nowIso: longAgo,
    });

    issueOpenedMock.mockRejectedValue(new Error('still broken'));
    let now = Date.now();
    let parked = false;
    for (let i = 0; i < WEBHOOK_INBOX_MAX_ATTEMPTS + 2 && !parked; i++) {
      const r = await drainWebhookInbox(processGitHubDelivery, { nowIso: new Date(now).toISOString(), prune: false });
      if (r.parked) parked = true;
      now += 7 * 60 * 60_000; // past every rung of the backoff ladder
    }
    expect(parked).toBe(true);
    const row = await getWebhookDelivery('d-dead');
    expect(row).toMatchObject({ status: 'failed', attempts: WEBHOOK_INBOX_MAX_ATTEMPTS, next_attempt_at: null });
    // The abandoned attempt counted as attempt 1; the drain used the remaining budget and stopped.
    expect(issueOpenedMock).toHaveBeenCalledTimes(WEBHOOK_INBOX_MAX_ATTEMPTS - 1);
    const after = await drainWebhookInbox(processGitHubDelivery, {
      nowIso: new Date(now + 24 * 3600_000).toISOString(),
      prune: false,
    });
    expect(after.replayed).toBe(0);
  });

  it('a GitHub redelivery of a completed GUID re-processes (downstream dedup owns idempotency) and bumps attempts', async () => {
    await post(ISSUE_OPENED, signedHeaders('d-3'));
    const { status, json } = await post(ISSUE_OPENED, signedHeaders('d-3'));
    expect(status).toBe(200);
    expect(json).toEqual({ ok: true, outcome: 'local' });
    expect(issueOpenedMock).toHaveBeenCalledTimes(2);
    expect(await getWebhookDelivery('d-3')).toMatchObject({ status: 'done', attempts: 2 });
  });

  it('a trusted peer forward is recorded with trust=peer and replays as a peer forward', async () => {
    const body = JSON.stringify(ISSUE_OPENED);
    const res = await realFetch(`${baseUrl}/webhook/github`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'issues',
        'x-github-delivery': 'd-peer',
        'x-webhook-trust': 'pre-validated',
        'x-internal-signature-256': sign(body, 'trust-secret'),
      },
      body,
    });
    expect(res.status).toBe(200);
    expect(await getWebhookDelivery('d-peer')).toMatchObject({ status: 'done', trust: 'peer' });
  });

  it('synthesizes a stable id when the delivery header is absent', async () => {
    const body = JSON.stringify(ISSUE_OPENED);
    const res = await realFetch(`${baseUrl}/webhook/github`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-github-event': 'issues', 'x-hub-signature-256': sign(body) },
      body,
    });
    expect(res.status).toBe(200);
    const expected = `nodelivery-${crypto.createHash('sha256').update(body).digest('hex').slice(0, 24)}`;
    expect(await getWebhookDelivery(expected)).toMatchObject({ status: 'done' });
  });
});
