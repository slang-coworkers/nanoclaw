import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable lists shared with the config mock: the server reads them per
// request, so each test can set the policy without re-importing the module.
const lists = vi.hoisted(() => ({ allow: [] as string[], deny: [] as string[] }));

vi.mock('./config.js', () => ({
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GITHUB_WEBHOOK_PORT: 0,
  GITHUB_WEBHOOK_BOT_MENTION: '@bot',
  GITHUB_WEBHOOK_OWNER_ALLOWLIST: lists.allow,
  GITHUB_WEBHOOK_OWNER_DENYLIST: lists.deny,
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

vi.mock('./env.js', () => ({
  readEnvFile: () => ({}),
}));

import crypto from 'crypto';

import { ownerFilterVerdict, startGitHubWebhookServer } from './github-webhook-server.js';
import { deliverGitHubMention } from './webhook-github.js';

function setLists(allow: string[], deny: string[]): void {
  lists.allow.splice(0, lists.allow.length, ...allow);
  lists.deny.splice(0, lists.deny.length, ...deny);
}

describe('ownerFilterVerdict (pure policy)', () => {
  it('empty lists accept every owner, including a missing repository', () => {
    expect(ownerFilterVerdict('shader-slang/slang', [], [])).toBe('allowed');
    expect(ownerFilterVerdict('someone-else/repo', [], [])).toBe('allowed');
    expect(ownerFilterVerdict('', [], [])).toBe('allowed');
  });

  it('allowlist admits only listed owners, case-insensitively', () => {
    const allow = ['shader-slang'];
    expect(ownerFilterVerdict('shader-slang/slang', allow, [])).toBe('allowed');
    expect(ownerFilterVerdict('Shader-Slang/slangpy', allow, [])).toBe('allowed');
    expect(ownerFilterVerdict('slang-coworkers/nanoclaw', allow, [])).toBe('not allowlisted');
    expect(ownerFilterVerdict('shader-slang-fork/slang', allow, [])).toBe('not allowlisted');
  });

  it('an allowlisted install fails closed on a payload with no usable full_name', () => {
    expect(ownerFilterVerdict('', ['shader-slang'], [])).toBe('not allowlisted');
    expect(ownerFilterVerdict('no-slash', ['shader-slang'], [])).toBe('not allowlisted');
  });

  it('denylist always wins, even over an allowlist entry', () => {
    expect(ownerFilterVerdict('slang-coworkers/nanoclaw', [], ['slang-coworkers'])).toBe('denied');
    expect(ownerFilterVerdict('slang-coworkers/nanoclaw', ['slang-coworkers'], ['slang-coworkers'])).toBe('denied');
    expect(ownerFilterVerdict('shader-slang/slang', ['shader-slang'], ['slang-coworkers'])).toBe('allowed');
  });
});

describe('github webhook server — owner filter', () => {
  let handle: ReturnType<typeof startGitHubWebhookServer>;
  let baseUrl: string;
  const deliverMock = vi.mocked(deliverGitHubMention);
  const undiciFetch = globalThis.fetch;

  function sign(secret: string, body: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  function commentPayload(fullName: string): unknown {
    return {
      action: 'created',
      repository: { full_name: fullName },
      issue: { number: 7, pull_request: { url: 'x' } },
      comment: { id: 11, body: 'hey @bot please look', user: { login: 'someone' } },
      sender: { login: 'someone' },
    };
  }

  async function post(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const body = JSON.stringify(payload);
    const res = await undiciFetch(`${baseUrl}/webhook/github`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'issue_comment',
        'x-github-delivery': `d-${Math.random().toString(36).slice(2)}`,
        ...headers,
      },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    await new Promise((r) => setImmediate(r));
    return { status: res.status, json };
  }

  beforeEach(async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 201 } as Response)) as unknown as typeof fetch;
    process.env.GH_TOKEN = 'fake-token';
    deliverMock.mockReset().mockResolvedValue('forwarded');
    setLists([], []);
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
    globalThis.fetch = undiciFetch;
    await new Promise<void>((resolve) => handle.server.close(() => resolve()));
  });

  it('no lists configured: a foreign-owner delivery is still routed (default unchanged)', async () => {
    const payload = commentPayload('someone-else/repo');
    const { status } = await post(payload, { 'x-hub-signature-256': sign('test-secret', JSON.stringify(payload)) });
    expect(status).toBe(200);
    expect(deliverMock).toHaveBeenCalledTimes(1);
  });

  it('allowlist=shader-slang: a shader-slang delivery is routed', async () => {
    setLists(['shader-slang'], ['slang-coworkers']);
    const payload = commentPayload('shader-slang/slang');
    const { status } = await post(payload, { 'x-hub-signature-256': sign('test-secret', JSON.stringify(payload)) });
    expect(status).toBe(200);
    expect(deliverMock).toHaveBeenCalledTimes(1);
  });

  it('allowlist=shader-slang: a foreign-owner delivery is acknowledged 202 and never routed', async () => {
    setLists(['shader-slang'], ['slang-coworkers']);
    const payload = commentPayload('some-other-org/repo');
    const { status, json } = await post(payload, {
      'x-hub-signature-256': sign('test-secret', JSON.stringify(payload)),
    });
    expect(status).toBe(202);
    expect(json).toMatchObject({ ok: true, dropped: true, reason: 'owner not allowlisted' });
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it('denylist=slang-coworkers: the coworkers org is dropped with reason "owner denied"', async () => {
    setLists(['shader-slang'], ['slang-coworkers']);
    const payload = commentPayload('slang-coworkers/nanoclaw');
    const { status, json } = await post(payload, {
      'x-hub-signature-256': sign('test-secret', JSON.stringify(payload)),
    });
    expect(status).toBe(202);
    expect(json).toMatchObject({ dropped: true, reason: 'owner denied' });
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it('the filter runs after signature verification: an unsigned foreign delivery is still a 401', async () => {
    setLists(['shader-slang'], []);
    const payload = commentPayload('some-other-org/repo');
    const { status } = await post(payload, { 'x-hub-signature-256': 'sha256=deadbeef' });
    expect(status).toBe(401);
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it('peer-forwarded deliveries are filtered too (a mis-forward for a denied owner is dropped)', async () => {
    setLists(['shader-slang'], ['slang-coworkers']);
    const payload = commentPayload('slang-coworkers/nanoclaw');
    const body = JSON.stringify(payload);
    const { status, json } = await post(payload, {
      'x-webhook-trust': 'pre-validated',
      'x-internal-signature-256': sign('trust-secret', body),
    });
    expect(status).toBe(202);
    expect(json).toMatchObject({ dropped: true, reason: 'owner denied' });
    expect(deliverMock).not.toHaveBeenCalled();
  });
});
