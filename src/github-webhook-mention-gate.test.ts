import crypto from 'crypto';
import http from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Regression coverage for the issue-comment mention gate in
// startGitHubWebhookServer. The bug (pre-fix): a follow-up comment on a plain
// issue whose OPEN we dev-route to a peer was dropped here with
// "bot not mentioned" before deliverGitHubMention (which performs the forward)
// was ever called — so ROUTE_ISSUES_TO never saw issue comments, only opens.
//
// These tests drive the real HTTP handler with a GitHub-signed request and
// assert whether deliverGitHubMention is reached, isolating the gate decision.

const SECRET = 'test-secret';
const BOT_MENTION = '@nv-slang-bot';

function sign(body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

function issueCommentBody(commentBody: string, opts?: { isPr?: boolean; commenter?: string }): string {
  const issue: Record<string, unknown> = { number: 11372 };
  if (opts?.isPr) issue.pull_request = { url: 'https://api.github.com/...' };
  return JSON.stringify({
    action: 'created',
    repository: { full_name: 'shader-slang/slang' },
    issue,
    comment: {
      id: 4591326399,
      body: commentBody,
      html_url: 'https://github.com/shader-slang/slang/issues/11372#issuecomment-4591326399',
      user: { login: opts?.commenter ?? 'andersjel' },
    },
  });
}

// pull_request_review_comment payloads carry `pull_request` (not `issue`) and
// enter the same gate via the eventType === 'pull_request_review_comment'
// branch. isPr is true.
function reviewCommentBody(commentBody: string): string {
  return JSON.stringify({
    action: 'created',
    repository: { full_name: 'shader-slang/slang' },
    pull_request: { number: 11372 },
    comment: {
      id: 4591326400,
      body: commentBody,
      html_url: 'https://github.com/shader-slang/slang/pull/11372#discussion_r4591326400',
      user: { login: 'andersjel' },
    },
  });
}

async function postWebhook(
  port: number,
  body: string,
  headers: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/webhook/github', method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c.toString()));
      res.on('end', () => {
        let json: Record<string, unknown> = {};
        try {
          json = JSON.parse(data);
        } catch {
          /* non-JSON body */
        }
        resolve({ status: res.statusCode ?? 0, json });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function commonMocks(opts?: { prMappingExists?: boolean }): void {
  vi.doMock('./modules/pr-mapping/register-endpoint.js', () => ({ handleRegisterPr: vi.fn() }));
  vi.doMock('./modules/pr-mapping/register-client.js', () => ({
    WEBHOOK_TRUST_HEADER: 'x-webhook-trust',
    WEBHOOK_TRUST_VALUE: 'pre-validated',
    TRUST_SIGNATURE_HEADER: 'x-internal-signature-256',
    verifyTrustedSignature: () => true,
  }));
  // The gate calls getDb() then prMappingExists(db, repo, pr). Mock both so
  // the test never touches an uninitialized central DB. prMappingExists
  // returns the configured ownership signal.
  vi.doMock('./db/connection.js', () => ({ getDb: () => ({}) }));
  vi.doMock('./modules/pr-mapping/store.js', () => ({
    prMappingExists: vi.fn(() => Boolean(opts?.prMappingExists)),
  }));
  vi.doMock('./log.js', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
}

async function startServer(
  config: Record<string, unknown>,
  opts?: { prMappingExists?: boolean },
): Promise<{
  port: number;
  close: () => Promise<void>;
  deliverGitHubMention: ReturnType<typeof vi.fn>;
  deliverGitHubIssueOpened: ReturnType<typeof vi.fn>;
  deliverGitHubPrEvent: ReturnType<typeof vi.fn>;
}> {
  vi.doMock('./config.js', () => ({
    GITHUB_WEBHOOK_SECRET: SECRET,
    GITHUB_WEBHOOK_PORT: 0,
    GITHUB_WEBHOOK_BOT_MENTION: BOT_MENTION,
    INSTANCE_FORWARD_TARGETS: {},
    INSTANCE_SLUG: 'prod',
    INTERNAL_REGISTER_SECRET: '',
    ROUTE_ISSUES_TO: '',
    APPROVER_CI_GATE: false,
    CI_GATE_REQUIRED_SUITE: '',
    ...config,
  }));
  const deliverGitHubMention = vi.fn(() => 'forwarded');
  const deliverGitHubIssueOpened = vi.fn(() => 'local');
  const deliverGitHubPrEvent = vi.fn(() => 'local');
  vi.doMock('./webhook-github.js', () => ({
    deliverGitHubMention,
    deliverGitHubIssueOpened,
    deliverGitHubPrEvent,
  }));
  commonMocks(opts);

  const { startGitHubWebhookServer } = await import('./github-webhook-server.js');
  const handle = startGitHubWebhookServer();
  // listen() on GITHUB_WEBHOOK_PORT=0 binds an ephemeral port asynchronously —
  // wait for the bind before reading address().
  await new Promise<void>((resolve) => {
    if (handle.server.listening) return resolve();
    handle.server.once('listening', () => resolve());
  });
  const addr = handle.server.address();
  const port = addr && typeof addr === 'object' ? addr.port : 0;
  return { port, close: () => handle.stop(), deliverGitHubMention, deliverGitHubIssueOpened, deliverGitHubPrEvent };
}

describe('issue_comment mention gate — ROUTE_ISSUES_TO exemption', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('forwards a non-@mention issue comment when ROUTE_ISSUES_TO is set (the bug)', async () => {
    const srv = await startServer({ ROUTE_ISSUES_TO: 'lego', INSTANCE_FORWARD_TARGETS: { lego: 'http://x/y' } });
    try {
      const body = issueCommentBody('Thanks, that makes sense — but what about the ABI case?');
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'issue_comment',
        'x-github-delivery': 'd1',
        'x-hub-signature-256': sign(body),
      });
      // Must reach deliverGitHubMention (which performs the actual forward),
      // NOT be short-circuited with "bot not mentioned".
      expect(srv.deliverGitHubMention).toHaveBeenCalledTimes(1);
      expect(srv.deliverGitHubMention.mock.calls[0][0]).toMatchObject({ isPr: false, issueNumber: 11372 });
      expect(res.json.skipped).toBeUndefined();
    } finally {
      srv.close();
    }
  });

  it('drops a non-@mention issue comment when ROUTE_ISSUES_TO is unset (default behavior preserved)', async () => {
    const srv = await startServer({ ROUTE_ISSUES_TO: '' });
    try {
      const body = issueCommentBody('Thanks, that makes sense.');
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'issue_comment',
        'x-github-delivery': 'd2',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubMention).not.toHaveBeenCalled();
      expect(res.json).toMatchObject({ skipped: true, reason: 'bot not mentioned' });
    } finally {
      srv.close();
    }
  });

  it('still delivers an @mention issue comment when ROUTE_ISSUES_TO is unset', async () => {
    const srv = await startServer({ ROUTE_ISSUES_TO: '' });
    try {
      const body = issueCommentBody(`Hey ${BOT_MENTION} please take a look`);
      await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'issue_comment',
        'x-github-delivery': 'd3',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubMention).toHaveBeenCalledTimes(1);
    } finally {
      srv.close();
    }
  });

  // The own-bot guard must drop the bot's own comments before the mention gate
  // and the 👀-reaction path — under BOTH identities. The App posts as
  // `nv-slang-bot[bot]`; cross-fork work posts under the `nv-slang-bot` user
  // PAT (no `[bot]` suffix). Either slipping through means the host self-reacts
  // 👀 on the bot's own reply and may re-forward it as if it were feedback.
  for (const botIdentity of ['nv-slang-bot[bot]', 'nv-slang-bot']) {
    it(`drops the bot's own issue comment (identity: ${botIdentity}) — no forward, no self-react`, async () => {
      // ROUTE_ISSUES_TO set so the comment would otherwise be forwarded (and
      // earn a 👀) — the own-bot guard must short-circuit before that.
      const srv = await startServer({ ROUTE_ISSUES_TO: 'lego', INSTANCE_FORWARD_TARGETS: { lego: 'http://x/y' } });
      try {
        const body = issueCommentBody('Posting the triage 5-bullet…', { commenter: botIdentity });
        const res = await postWebhook(srv.port, body, {
          'content-type': 'application/json',
          'x-github-event': 'issue_comment',
          'x-github-delivery': `own-${botIdentity}`,
          'x-hub-signature-256': sign(body),
        });
        expect(srv.deliverGitHubMention).not.toHaveBeenCalled();
        expect(res.json).toMatchObject({ skipped: true, reason: 'own-bot comment' });
      } finally {
        srv.close();
      }
    });
  }

  it('ROUTE_ISSUES_TO does not exempt PR comments (that path is !isPr only)', async () => {
    // PR comment, no mention, no mapping → stays gated even with ROUTE_ISSUES_TO.
    const srv = await startServer(
      { ROUTE_ISSUES_TO: 'lego', INSTANCE_FORWARD_TARGETS: { lego: 'http://x/y' } },
      { prMappingExists: false },
    );
    try {
      const body = issueCommentBody('LGTM, no bot tag here', { isPr: true });
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'issue_comment',
        'x-github-delivery': 'd4',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubMention).not.toHaveBeenCalled();
      expect(res.json).toMatchObject({ skipped: true, reason: 'bot not mentioned' });
    } finally {
      srv.close();
    }
  });

  it('processes a non-@mention PR comment when the PR is in pr_session_mappings (ours)', async () => {
    const srv = await startServer({ ROUTE_ISSUES_TO: '' }, { prMappingExists: true });
    try {
      const body = issueCommentBody('Please rebase and re-run CI', { isPr: true });
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'issue_comment',
        'x-github-delivery': 'd5',
        'x-hub-signature-256': sign(body),
      });
      // Mapping is the ownership signal — gate must let it reach deliverGitHubMention.
      expect(srv.deliverGitHubMention).toHaveBeenCalledTimes(1);
      expect(srv.deliverGitHubMention.mock.calls[0][0]).toMatchObject({ isPr: true, issueNumber: 11372 });
      expect(res.json.skipped).toBeUndefined();
    } finally {
      srv.close();
    }
  });

  it('drops a non-@mention PR comment when the PR is NOT mapped (no-noise guard)', async () => {
    const srv = await startServer({ ROUTE_ISSUES_TO: '' }, { prMappingExists: false });
    try {
      const body = issueCommentBody('drive-by comment on an unrelated public PR', { isPr: true });
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'issue_comment',
        'x-github-delivery': 'd6',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubMention).not.toHaveBeenCalled();
      expect(res.json).toMatchObject({ skipped: true, reason: 'bot not mentioned' });
    } finally {
      srv.close();
    }
  });

  it('processes a non-@mention pull_request_review_comment on a mapped PR', async () => {
    const srv = await startServer({ ROUTE_ISSUES_TO: '' }, { prMappingExists: true });
    try {
      const body = reviewCommentBody('nit: rename this variable');
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'pull_request_review_comment',
        'x-github-delivery': 'd7',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubMention).toHaveBeenCalledTimes(1);
      expect(srv.deliverGitHubMention.mock.calls[0][0]).toMatchObject({ isPr: true, issueNumber: 11372 });
      expect(res.json.skipped).toBeUndefined();
    } finally {
      srv.close();
    }
  });
});

// ── PR activity events: review verdict, review thread, CI failure ──
// These route to the owning fixer session via deliverGitHubPrEvent (no mention
// gate, no orchestrator fallback). The mapping IS the ownership signal; the
// delivery decision lives in deliverGitHubPrEvent (unit-tested separately) —
// here we assert the SERVER's accept/filter/dispatch logic only.

function reviewBody(opts: { state: string; body?: string; reviewer?: string; action?: string }): string {
  return JSON.stringify({
    action: opts.action ?? 'submitted',
    repository: { full_name: 'shader-slang/slang' },
    pull_request: { number: 11372 },
    review: {
      id: 555001,
      state: opts.state,
      body: opts.body ?? '',
      html_url: 'https://github.com/shader-slang/slang/pull/11372#pullrequestreview-555001',
      user: { login: opts.reviewer ?? 'andersjel' },
    },
  });
}

function reviewThreadBody(opts: { action: string; sender?: string }): string {
  return JSON.stringify({
    action: opts.action,
    repository: { full_name: 'shader-slang/slang' },
    pull_request: { number: 11372 },
    sender: { login: opts.sender ?? 'andersjel' },
    thread: { comments: [{ id: 777002, path: 'source/foo.cpp' }] },
  });
}

function checkSuiteBody(opts: { action?: string; conclusion: string; withPr?: boolean }): string {
  return JSON.stringify({
    action: opts.action ?? 'completed',
    repository: { full_name: 'shader-slang/slang' },
    check_suite: {
      id: 888003,
      conclusion: opts.conclusion,
      head_sha: 'abc123',
      url: 'https://api.github.com/repos/shader-slang/slang/check-suites/888003',
      pull_requests: opts.withPr === false ? [] : [{ number: 11372 }],
    },
  });
}

describe('PR review / CI events → fixer routing', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('routes a changes_requested review to deliverGitHubPrEvent', async () => {
    const srv = await startServer({});
    try {
      const body = reviewBody({ state: 'changes_requested', body: 'Please fix the ABI handling.' });
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'pull_request_review',
        'x-github-delivery': 'r1',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubPrEvent).toHaveBeenCalledTimes(1);
      expect(srv.deliverGitHubPrEvent.mock.calls[0][0]).toMatchObject({
        prNumber: 11372,
        event: 'github.pr_review',
        rowId: 'gh-review-555001',
      });
      expect(res.json.skipped).toBeUndefined();
    } finally {
      srv.close();
    }
  });

  it('routes an approved review even with empty body', async () => {
    const srv = await startServer({});
    try {
      const body = reviewBody({ state: 'approved', body: '' });
      await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'pull_request_review',
        'x-github-delivery': 'r2',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubPrEvent).toHaveBeenCalledTimes(1);
      expect(srv.deliverGitHubPrEvent.mock.calls[0][0]).toMatchObject({ event: 'github.pr_review' });
    } finally {
      srv.close();
    }
  });

  it('skips an empty "commented" review (inline-only wrapper — no double-wake)', async () => {
    const srv = await startServer({});
    try {
      const body = reviewBody({ state: 'commented', body: '' });
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'pull_request_review',
        'x-github-delivery': 'r3',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubPrEvent).not.toHaveBeenCalled();
      expect(res.json).toMatchObject({ skipped: true });
    } finally {
      srv.close();
    }
  });

  it('skips our own bot review (echo, not feedback)', async () => {
    const srv = await startServer({});
    try {
      const body = reviewBody({ state: 'approved', reviewer: 'nv-slang-bot[bot]' });
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'pull_request_review',
        'x-github-delivery': 'r4',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubPrEvent).not.toHaveBeenCalled();
      expect(res.json).toMatchObject({ skipped: true, reason: 'own-bot review' });
    } finally {
      srv.close();
    }
  });

  it('skips our own bot review posted under the user PAT identity (no [bot] suffix)', async () => {
    // Cross-fork PRs are opened/commented under the `nv-slang-bot` user PAT,
    // whose review author login lacks the `[bot]` suffix. The own-bot guard
    // must recognize this identity too, or the host treats the bot's own
    // review as feedback (and self-reacts).
    const srv = await startServer({});
    try {
      const body = reviewBody({ state: 'approved', reviewer: 'nv-slang-bot' });
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'pull_request_review',
        'x-github-delivery': 'r4b',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubPrEvent).not.toHaveBeenCalled();
      expect(res.json).toMatchObject({ skipped: true, reason: 'own-bot review' });
    } finally {
      srv.close();
    }
  });

  it('routes a resolved review thread', async () => {
    const srv = await startServer({});
    try {
      const body = reviewThreadBody({ action: 'resolved' });
      await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'pull_request_review_thread',
        'x-github-delivery': 't1',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubPrEvent).toHaveBeenCalledTimes(1);
      expect(srv.deliverGitHubPrEvent.mock.calls[0][0]).toMatchObject({
        event: 'github.pr_review_thread',
        rowId: 'gh-revthread-777002-resolved',
      });
    } finally {
      srv.close();
    }
  });

  it('routes a failed check_suite to deliverGitHubPrEvent', async () => {
    const srv = await startServer({});
    try {
      const body = checkSuiteBody({ conclusion: 'failure' });
      await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'check_suite',
        'x-github-delivery': 'c1',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubPrEvent).toHaveBeenCalledTimes(1);
      expect(srv.deliverGitHubPrEvent.mock.calls[0][0]).toMatchObject({
        event: 'github.ci_failed',
        rowId: 'gh-checks-888003',
      });
    } finally {
      srv.close();
    }
  });

  it('skips a successful check_suite (only failures are work)', async () => {
    const srv = await startServer({});
    try {
      const body = checkSuiteBody({ conclusion: 'success' });
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'check_suite',
        'x-github-delivery': 'c2',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubPrEvent).not.toHaveBeenCalled();
      expect(res.json).toMatchObject({ skipped: true });
    } finally {
      srv.close();
    }
  });

  it('skips a failed check_suite with no associated PR', async () => {
    const srv = await startServer({});
    try {
      const body = checkSuiteBody({ conclusion: 'failure', withPr: false });
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'check_suite',
        'x-github-delivery': 'c3',
        'x-hub-signature-256': sign(body),
      });
      expect(srv.deliverGitHubPrEvent).not.toHaveBeenCalled();
      expect(res.json).toMatchObject({ skipped: true, reason: 'check_suite has no associated PR' });
    } finally {
      srv.close();
    }
  });
});
