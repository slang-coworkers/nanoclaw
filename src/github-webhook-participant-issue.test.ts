import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors the prod config where ROUTE_ISSUES_TO is unset, so issue comments do
// NOT dev-route to a peer (willDevRouteToPeer=false) and the isParticipantIssue
// exemption is the only thing that can let a non-@-mention issue follow-up
// through. (The sibling github-webhook-server.test.ts sets ROUTE_ISSUES_TO=lego,
// which short-circuits to the dev-route path before isParticipantIssue.)
vi.mock('./config.js', () => ({
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GITHUB_WEBHOOK_PORT: 0,
  GITHUB_WEBHOOK_BOT_MENTION: '@bot',
  INSTANCE_FORWARD_TARGETS: {},
  INSTANCE_SLUG: 'prod',
  ROUTE_ISSUES_TO: '',
  INTERNAL_REGISTER_SECRET: '',
}));

vi.mock('./webhook-github.js', () => ({
  deliverGitHubMention: vi.fn(),
  deliverGitHubIssueOpened: vi.fn(),
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

vi.mock('./db/sessions.js', () => ({
  issueSessionExists: vi.fn(() => false),
}));

vi.mock('./env.js', () => ({
  readEnvFile: () => ({}) as Record<string, string>,
}));

import { startGitHubWebhookServer } from './github-webhook-server.js';
import { deliverGitHubMention } from './webhook-github.js';
import { issueSessionExists } from './db/sessions.js';

describe('webhook handler: isParticipantIssue exemption (ROUTE_ISSUES_TO unset)', () => {
  let handle: ReturnType<typeof startGitHubWebhookServer>;
  let baseUrl: string;
  let fetchMock: ReturnType<typeof vi.fn>;
  const deliverMock = vi.mocked(deliverGitHubMention);
  const issueSessionMock = vi.mocked(issueSessionExists);

  function sign(body: string): string {
    const crypto = require('crypto');
    return 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(body).digest('hex');
  }

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
    fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 201 } as Response));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.GH_TOKEN = 'fake-token';
    deliverMock.mockReset().mockResolvedValue('local');
    issueSessionMock.mockReset().mockResolvedValue(false);

    handle = startGitHubWebhookServer();
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

  function reactionCalls() {
    return fetchMock.mock.calls;
  }

  it('drops a non-mentioning issue follow-up when no active chain session exists', async () => {
    issueSessionMock.mockResolvedValue(false);
    const json = await postComment('issue_comment', {
      action: 'created',
      repository: { full_name: 'shader-slang/slang' },
      issue: { number: 99999 }, // no pull_request key ⇒ plain issue
      comment: { id: 700, body: 'just a passerby comment', user: { login: 'a-human' } },
    });
    expect(json).toMatchObject({ skipped: true, reason: 'bot not mentioned' });
    expect(deliverMock).not.toHaveBeenCalled();
    expect(reactionCalls()).toHaveLength(0);
  });

  it('processes + reacts 👀 on a non-mentioning issue follow-up when we own the chain', async () => {
    issueSessionMock.mockResolvedValue(true); // isParticipantIssue
    const json = await postComment('issue_comment', {
      action: 'created',
      repository: { full_name: 'shader-slang/slang' },
      issue: { number: 11505 },
      comment: { id: 701, body: 'Good catch, Change 1 should actually remove...', user: { login: 'maxime-modulopi' } },
    });
    expect(json).toMatchObject({ outcome: 'local' });
    expect(deliverMock).toHaveBeenCalledTimes(1);
    expect(issueSessionMock).toHaveBeenCalledWith('shader-slang/slang', 11505);
    const calls = reactionCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('https://api.github.com/repos/shader-slang/slang/issues/comments/701/reactions');
  });

  it('does NOT consult the chain lookup for PR comments (PRs use pr_session_mappings)', async () => {
    issueSessionMock.mockResolvedValue(true);
    await postComment('issue_comment', {
      action: 'created',
      repository: { full_name: 'shader-slang/slang' },
      issue: { number: 900, pull_request: { url: 'x' } }, // PR-backed issue_comment
      comment: { id: 702, body: 'no mention here', user: { login: 'a-human' } },
    });
    // isPr ⇒ isParticipantIssue must not be evaluated; with no PR mapping the
    // comment is gated out.
    expect(issueSessionMock).not.toHaveBeenCalled();
    expect(deliverMock).not.toHaveBeenCalled();
  });
});
