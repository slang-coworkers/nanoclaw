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

function issueCommentBody(commentBody: string, opts?: { isPr?: boolean }): string {
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

function commonMocks(): void {
  vi.doMock('./modules/pr-mapping/register-endpoint.js', () => ({ handleRegisterPr: vi.fn() }));
  vi.doMock('./modules/pr-mapping/register-client.js', () => ({
    WEBHOOK_TRUST_HEADER: 'x-webhook-trust',
    WEBHOOK_TRUST_VALUE: 'pre-validated',
    TRUST_SIGNATURE_HEADER: 'x-internal-signature-256',
    verifyTrustedSignature: () => true,
  }));
  vi.doMock('./log.js', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
}

async function startServer(config: Record<string, unknown>): Promise<{
  port: number;
  close: () => Promise<void>;
  deliverGitHubMention: ReturnType<typeof vi.fn>;
  deliverGitHubIssueOpened: ReturnType<typeof vi.fn>;
}> {
  vi.doMock('./config.js', () => ({
    GITHUB_WEBHOOK_SECRET: SECRET,
    GITHUB_WEBHOOK_PORT: 0,
    GITHUB_WEBHOOK_BOT_MENTION: BOT_MENTION,
    INSTANCE_FORWARD_TARGETS: {},
    INSTANCE_SLUG: 'prod',
    INTERNAL_REGISTER_SECRET: '',
    ROUTE_ISSUES_TO: '',
    ...config,
  }));
  const deliverGitHubMention = vi.fn(() => 'forwarded');
  const deliverGitHubIssueOpened = vi.fn(() => 'local');
  vi.doMock('./webhook-github.js', () => ({ deliverGitHubMention, deliverGitHubIssueOpened }));
  commonMocks();

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
  return { port, close: () => handle.stop(), deliverGitHubMention, deliverGitHubIssueOpened };
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

  it('does NOT exempt PR comments from the mention gate even when ROUTE_ISSUES_TO is set', async () => {
    const srv = await startServer({ ROUTE_ISSUES_TO: 'lego', INSTANCE_FORWARD_TARGETS: { lego: 'http://x/y' } });
    try {
      const body = issueCommentBody('LGTM, no bot tag here', { isPr: true });
      const res = await postWebhook(srv.port, body, {
        'content-type': 'application/json',
        'x-github-event': 'issue_comment',
        'x-github-delivery': 'd4',
        'x-hub-signature-256': sign(body),
      });
      // PR comment ownership is governed by pr_session_mappings, not
      // ROUTE_ISSUES_TO — a non-@mention PR comment stays gated.
      expect(srv.deliverGitHubMention).not.toHaveBeenCalled();
      expect(res.json).toMatchObject({ skipped: true, reason: 'bot not mentioned' });
    } finally {
      srv.close();
    }
  });
});
