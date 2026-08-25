import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config.js', () => ({
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GITHUB_WEBHOOK_PORT: 0,
  GITHUB_WEBHOOK_BOT_MENTION: '@bot',
  INSTANCE_FORWARD_TARGETS: { lego: 'http://127.0.0.1:1/webhook' },
  INSTANCE_SLUG: 'prod',
  ROUTE_ISSUES_TO: 'lego',
  INTERNAL_REGISTER_SECRET: 'trust-secret',
}));

vi.mock('./webhook-github.js', () => ({
  deliverGitHubMention: vi.fn(),
  deliverGitHubIssueOpened: vi.fn(),
  deliverGitHubPrReviewable: vi.fn(),
}));

vi.mock('./modules/pr-mapping/register-endpoint.js', () => ({
  handleRegisterPr: vi.fn(),
}));

vi.mock('./modules/pr-mapping/store.js', () => ({
  prMappingExists: vi.fn(() => false),
}));

vi.mock('./db/connection.js', () => ({
  getDb: () => ({}),
}));

// postEyesReaction re-reads GH_TOKEN from .env at call time (the cron-rotated
// value), falling back to process.env. Mock readEnvFile so tests control the
// file token without touching the real repo .env.
const readEnvFileMock = vi.fn((_keys: string[]) => ({}) as Record<string, string>);
vi.mock('./env.js', () => ({
  readEnvFile: (keys: string[]) => readEnvFileMock(keys),
}));

import { postEyesReaction, startGitHubWebhookServer } from './github-webhook-server.js';
import { deliverGitHubMention, deliverGitHubPrReviewable } from './webhook-github.js';
import { prMappingExists } from './modules/pr-mapping/store.js';

describe('postEyesReaction', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    readEnvFileMock.mockReturnValue({}); // default: no file token → fall back to process.env
    process.env.GH_TOKEN = 'fake-token';
  });

  afterEach(() => {
    delete process.env.GH_TOKEN;
    vi.restoreAllMocks();
  });

  it('does nothing when repo is missing (defensive)', async () => {
    await postEyesReaction('', 'issue_comment', 123);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when commentId is 0 (defensive)', async () => {
    await postEyesReaction('org/repo', 'issue_comment', 0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips with warn when GH_TOKEN is unset (no fetch — no 401 spam)', async () => {
    delete process.env.GH_TOKEN;
    await postEyesReaction('org/repo', 'issue_comment', 12345);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs eyes to /issues/comments/{id}/reactions for issue_comment', async () => {
    await postEyesReaction('org/repo', 'issue_comment', 12345);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/org/repo/issues/comments/12345/reactions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('token fake-token');
    expect(JSON.parse(init.body)).toEqual({ content: 'eyes' });
  });

  it('uses the .env (cron-rotated) token over a stale process.env.GH_TOKEN', async () => {
    // Simulates the real failure mode: process.env holds the boot-frozen
    // expired token; .env was refreshed by cron with the current one.
    process.env.GH_TOKEN = 'stale-boot-token';
    readEnvFileMock.mockReturnValue({ GH_TOKEN: 'fresh-cron-token' });
    await postEyesReaction('org/repo', 'issue_comment', 12345);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('token fresh-cron-token');
  });

  it('falls back to process.env.GH_TOKEN when .env has none', async () => {
    readEnvFileMock.mockReturnValue({});
    process.env.GH_TOKEN = 'env-fallback-token';
    await postEyesReaction('org/repo', 'issue_comment', 12345);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('token env-fallback-token');
  });

  it('POSTs eyes to /pulls/comments/{id}/reactions for pull_request_review_comment', async () => {
    await postEyesReaction('org/repo', 'pull_request_review_comment', 99);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.github.com/repos/org/repo/pulls/comments/99/reactions');
  });

  it('treats unknown event types as issue_comment-shaped', async () => {
    await postEyesReaction('org/repo', 'pull_request', 7);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.github.com/repos/org/repo/issues/comments/7/reactions');
  });

  it('does not throw on fetch network failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));
    await expect(postEyesReaction('org/repo', 'issue_comment', 1)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not warn on 422 already-reacted (idempotent on retry)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422 });
    const { log } = await import('./log.js');
    const warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => undefined);
    await postEyesReaction('org/repo', 'issue_comment', 1);
    const nonOkWarns = warnSpy.mock.calls.filter((c) => c[0] === 'github-webhook: eyes reaction non-OK');
    expect(nonOkWarns).toHaveLength(0);
  });

  it('warns on other non-OK responses (e.g. 401, 403, 5xx)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    const { log } = await import('./log.js');
    const warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => undefined);
    await postEyesReaction('org/repo', 'issue_comment', 1);
    const nonOkWarns = warnSpy.mock.calls.filter((c) => c[0] === 'github-webhook: eyes reaction non-OK');
    expect(nonOkWarns).toHaveLength(1);
  });
});

describe('webhook handler: 👀 ack + own-bot gate', () => {
  let handle: ReturnType<typeof startGitHubWebhookServer>;
  let baseUrl: string;
  let fetchMock: ReturnType<typeof vi.fn>;
  const deliverMock = vi.mocked(deliverGitHubMention);
  const readyMock = vi.mocked(deliverGitHubPrReviewable);
  const prMappingMock = vi.mocked(prMappingExists);

  // POST a signed pull_request webhook (no comment) and return the parsed JSON.
  async function postPullRequest(payload: unknown): Promise<Record<string, unknown>> {
    const body = JSON.stringify(payload);
    const res = await undiciFetch(`${baseUrl}/webhook/github`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'pull_request',
        'x-github-delivery': 'test-delivery',
        'x-hub-signature-256': sign(body),
      },
      body,
    });
    return (await res.json()) as Record<string, unknown>;
  }

  // Sign a body with the test secret (mirrors GitHub's X-Hub-Signature-256).
  function sign(body: string): string {
    const crypto = require('crypto');
    return 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(body).digest('hex');
  }

  // POST a signed comment webhook and return the parsed JSON response. The
  // eyes-reaction is fire-and-forget (a floating promise inside the handler),
  // so after the response we yield a macrotask to let it run before asserting
  // on the reaction fetch.
  // The real undici fetch, captured before any mocking — used to drive the
  // loopback POST to our own server. postEyesReaction's outbound github.com
  // call goes through the mocked globalThis.fetch instead.
  const undiciFetch = globalThis.fetch;

  async function postComment(event: string, payload: unknown): Promise<Record<string, unknown>> {
    const body = JSON.stringify(payload);
    const res = await undiciFetch(`${baseUrl}/webhook/github`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': event,
        'x-github-delivery': 'test-delivery',
        'x-hub-signature-256': sign(body),
      },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    await new Promise((r) => setImmediate(r));
    return json;
  }

  beforeEach(async () => {
    // Only postEyesReaction touches globalThis.fetch (always api.github.com);
    // stub it so no real outbound call is made. The loopback POST uses the
    // captured undiciFetch directly, so it is unaffected by this mock.
    fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 201 } as Response));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    readEnvFileMock.mockReturnValue({});
    process.env.GH_TOKEN = 'fake-token';
    deliverMock.mockReset().mockResolvedValue('forwarded');
    readyMock.mockReset().mockResolvedValue('forwarded');
    prMappingMock.mockReset().mockResolvedValue(false);

    handle = startGitHubWebhookServer();
    // listen() is async — wait for the OS to assign the ephemeral port (config
    // mock sets GITHUB_WEBHOOK_PORT=0) before deriving baseUrl.
    await new Promise<void>((resolve) => {
      if (handle.server.listening) return resolve();
      handle.server.once('listening', () => resolve());
    });
    const addr = handle.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await handle.stop();
    delete process.env.GH_TOKEN;
    vi.restoreAllMocks();
  });

  // Every globalThis.fetch call is a postEyesReaction github.com call — the
  // loopback POST goes through the captured undiciFetch, not the mock.
  function reactionCalls() {
    return fetchMock.mock.calls;
  }

  it('drops the bot’s own comment outright — no delivery, no 👀', async () => {
    const json = await postComment('issue_comment', {
      action: 'created',
      repository: { full_name: 'org/repo' },
      issue: { number: 42 },
      comment: { id: 555, body: 'Reviewer-approved draft PR #11422', user: { login: 'nv-slang-bot[bot]' } },
    });
    expect(json).toMatchObject({ skipped: true, reason: 'own-bot comment' });
    expect(deliverMock).not.toHaveBeenCalled();
    expect(reactionCalls()).toHaveLength(0);
  });

  it('reacts 👀 on a human comment that @-mentions the bot', async () => {
    const json = await postComment('issue_comment', {
      action: 'created',
      repository: { full_name: 'org/repo' },
      issue: { number: 42 },
      comment: { id: 556, body: 'hey @bot please look', user: { login: 'a-human' } },
    });
    expect(json).toMatchObject({ outcome: 'forwarded' });
    expect(deliverMock).toHaveBeenCalledTimes(1);
    const calls = reactionCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('https://api.github.com/repos/org/repo/issues/comments/556/reactions');
  });

  it('forwards a dev-routed follow-up that does NOT mention the bot, but does NOT react', async () => {
    // INSTANCE_SLUG=prod and ROUTE_ISSUES_TO (mocked below) ≠ prod ⇒ willDevRouteToPeer.
    // The comment is forwarded for chain context, but earns no 👀 because the
    // human wasn’t addressing the bot. This is the #11410 human-comment case.
    const json = await postComment('issue_comment', {
      action: 'created',
      repository: { full_name: 'org/repo' },
      issue: { number: 11410 },
      comment: { id: 557, body: '@someone-else Is this related to your work?', user: { login: 'a-human' } },
    });
    expect(json).toMatchObject({ outcome: 'forwarded' });
    expect(deliverMock).toHaveBeenCalledTimes(1);
    expect(reactionCalls()).toHaveLength(0);
  });

  it('reacts 👀 on a review comment on a PR we own, without an @-mention', async () => {
    prMappingMock.mockResolvedValue(true); // isOwnedPr
    const json = await postComment('pull_request_review_comment', {
      action: 'created',
      repository: { full_name: 'org/repo' },
      pull_request: { number: 900 },
      comment: { id: 558, body: 'can you tweak this line?', user: { login: 'a-reviewer' } },
    });
    expect(json).toMatchObject({ outcome: 'forwarded' });
    const calls = reactionCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('https://api.github.com/repos/org/repo/pulls/comments/558/reactions');
  });

  it('routes ready_for_review to deliverGitHubPrReviewable (before the non-closed skip)', async () => {
    const json = await postPullRequest({
      action: 'ready_for_review',
      repository: { full_name: 'org/repo' },
      pull_request: {
        number: 321,
        html_url: 'https://github.com/org/repo/pull/321',
        title: 'My feature',
        draft: false,
        user: { login: 'a-human' },
      },
    });
    // Must NOT be skipped as an unhandled pull_request action.
    expect(json).toMatchObject({ outcome: 'forwarded' });
    expect(json.skipped).toBeUndefined();
    expect(readyMock).toHaveBeenCalledTimes(1);
    expect(readyMock.mock.calls[0][0]).toMatchObject({
      repo: 'org/repo',
      prNumber: 321,
      prUrl: 'https://github.com/org/repo/pull/321',
      title: 'My feature',
      author: 'a-human',
      reason: 'ready_for_review',
      eventType: 'pull_request',
      deliveryId: 'test-delivery',
    });
  });

  it('routes opened + non-draft PR as reviewable', async () => {
    const json = await postPullRequest({
      action: 'opened',
      repository: { full_name: 'org/repo' },
      pull_request: { number: 322, draft: false, title: 'Direct PR', user: { login: 'a-human' } },
    });
    expect(json).toMatchObject({ outcome: 'forwarded' });
    expect(readyMock).toHaveBeenCalledTimes(1);
    expect(readyMock.mock.calls[0][0]).toMatchObject({ prNumber: 322, reason: 'opened' });
  });

  it('routes synchronize on a non-draft PR as reviewable (all sources, no bot filter)', async () => {
    const json = await postPullRequest({
      action: 'synchronize',
      repository: { full_name: 'org/repo' },
      pull_request: { number: 323, draft: false, user: { login: 'nv-slang-bot[bot]' } },
      sender: { login: 'nv-slang-bot[bot]' },
    });
    expect(json).toMatchObject({ outcome: 'forwarded' });
    expect(readyMock).toHaveBeenCalledTimes(1);
    expect(readyMock.mock.calls[0][0]).toMatchObject({ prNumber: 323, reason: 'synchronize' });
  });

  it('does NOT route opened/synchronize while the PR is still a draft', async () => {
    const openedDraft = await postPullRequest({
      action: 'opened',
      repository: { full_name: 'org/repo' },
      pull_request: { number: 324, draft: true },
    });
    expect(openedDraft).toMatchObject({ skipped: true, reason: 'pull_request action opened' });
    const syncDraft = await postPullRequest({
      action: 'synchronize',
      repository: { full_name: 'org/repo' },
      pull_request: { number: 324, draft: true },
    });
    expect(syncDraft).toMatchObject({ skipped: true, reason: 'pull_request action synchronize' });
    expect(readyMock).not.toHaveBeenCalled();
  });

  it('400s a malformed reviewable event (missing pr number)', async () => {
    const json = await postPullRequest({
      action: 'ready_for_review',
      repository: { full_name: 'org/repo' },
      pull_request: { title: 'no number' },
    });
    expect(json).toMatchObject({ error: 'malformed payload' });
    expect(readyMock).not.toHaveBeenCalled();
  });

  it('still skips non-reviewable pull_request actions (e.g. edited)', async () => {
    const json = await postPullRequest({
      action: 'edited',
      repository: { full_name: 'org/repo' },
      pull_request: { number: 321, draft: false },
    });
    expect(json).toMatchObject({ skipped: true, reason: 'pull_request action edited' });
    expect(readyMock).not.toHaveBeenCalled();
  });

  it('delivers a peer-forwarded reviewable event via trust headers (no GitHub signature)', async () => {
    // A forward from the canonical router carries X-Webhook-Trust=pre-validated
    // and X-Internal-Signature-256, no X-Hub-Signature-256. The body is signed
    // with INTERNAL_REGISTER_SECRET ('trust-secret' in the config mock). We assert
    // the ready handler is still reached (event flows past the trust gate and the
    // pull_request branch runs before the mention gate).
    const body = JSON.stringify({
      action: 'ready_for_review',
      repository: { full_name: 'org/repo' },
      pull_request: {
        number: 654,
        html_url: 'https://github.com/org/repo/pull/654',
        title: 'Forwarded PR',
        draft: false,
        user: { login: 'a-human' },
      },
    });
    const crypto = require('crypto');
    const trustSig = 'sha256=' + crypto.createHmac('sha256', 'trust-secret').update(body).digest('hex');
    const res = await undiciFetch(`${baseUrl}/webhook/github`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'pull_request',
        'x-github-delivery': 'forwarded-delivery',
        'x-webhook-trust': 'pre-validated',
        'x-internal-signature-256': trustSig,
      },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ outcome: 'forwarded' });
    expect(readyMock).toHaveBeenCalledTimes(1);
    expect(readyMock.mock.calls[0][0]).toMatchObject({ repo: 'org/repo', prNumber: 654 });
  });
});
