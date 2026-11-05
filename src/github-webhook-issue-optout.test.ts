// The webhook server's R6 switches: a newcomer label opts an issue out, removing the
// last one releases it and delivers the issue again, a stop mention by the author or
// a collaborator opts it out (and labels it), and comments on an opted-out issue are
// not delivered. The opt-out module itself is mocked; its own tests cover it.
import crypto from 'crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config.js', () => ({
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GITHUB_WEBHOOK_PORT: 0,
  GITHUB_WEBHOOK_BOT_MENTION: '@bot',
  GITHUB_WEBHOOK_OWNER_ALLOWLIST: [],
  GITHUB_WEBHOOK_OWNER_DENYLIST: [],
  INSTANCE_FORWARD_TARGETS: {},
  INSTANCE_SLUG: 'prod',
  ROUTE_ISSUES_TO: '',
  INTERNAL_REGISTER_SECRET: 'trust-secret',
}));

vi.mock('./webhook-github.js', () => ({
  deliverGitHubMention: vi.fn(),
  deliverGitHubIssueOpened: vi.fn(),
  deliverGitHubPrReviewable: vi.fn(),
}));
vi.mock('./modules/pr-mapping/register-endpoint.js', () => ({ handleRegisterPr: vi.fn() }));
vi.mock('./modules/pr-mapping/store.js', () => ({ prMappingExists: vi.fn(() => false) }));
vi.mock('./db/connection.js', () => ({ getDb: () => ({}) }));
vi.mock('./db/sessions.js', () => ({ issueSessionExists: vi.fn(async () => false) }));
vi.mock('./env.js', () => ({ readEnvFile: () => ({}) }));

const NEWCOMER = ['goodfirstbug', 'helpwanted', 'no-bot'];
const optOut = {
  addIssueLabel: vi.fn(async () => true),
  isIssueOptedOut: vi.fn(async () => false),
  optOutIssue: vi.fn(async () => ({ fresh: true, sessionsStopped: 1, listsWritten: 3 })),
  releaseIssueOptOut: vi.fn(async () => true),
};
vi.mock('./issue-opt-out.js', () => ({
  STOP_MENTION_LABEL: 'no-bot',
  isNewcomerLabel: (n: string) => NEWCOMER.includes(n.trim().toLowerCase()),
  newcomerLabelsOf: (ls: string[]) => ls.map((l) => l.toLowerCase()).filter((l) => NEWCOMER.includes(l)),
  isStopMention: (body: string) => body.toLowerCase().includes('@bot') && /\bstop\b/i.test(body),
  mayStopIssue: (a: { commenter: string; issueAuthor: string; authorAssociation: string }) =>
    a.commenter === a.issueAuthor || ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(a.authorAssociation),
  addIssueLabel: (...a: unknown[]) => optOut.addIssueLabel(...(a as [])),
  isIssueOptedOut: (...a: unknown[]) => optOut.isIssueOptedOut(...(a as [])),
  optOutIssue: (...a: unknown[]) => optOut.optOutIssue(...(a as [])),
  releaseIssueOptOut: (...a: unknown[]) => optOut.releaseIssueOptOut(...(a as [])),
}));

import { startGitHubWebhookServer } from './github-webhook-server.js';
import { deliverGitHubIssueOpened, deliverGitHubMention } from './webhook-github.js';

const issueMock = vi.mocked(deliverGitHubIssueOpened);
const mentionMock = vi.mocked(deliverGitHubMention);
const undiciFetch = globalThis.fetch;

describe('webhook handler: issue opt-out (R6)', () => {
  let handle: ReturnType<typeof startGitHubWebhookServer>;
  let baseUrl: string;

  function sign(body: string): string {
    return 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(body).digest('hex');
  }

  async function post(event: string, payload: unknown): Promise<Record<string, unknown>> {
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

  const issue = (over: Record<string, unknown> = {}) => ({
    number: 4321,
    title: 'Wrong result',
    body: 'Repro',
    html_url: 'https://github.com/org/repo/issues/4321',
    user: { login: 'reporter' },
    labels: [] as { name: string }[],
    ...over,
  });

  beforeEach(async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 201 } as Response)) as unknown as typeof fetch;
    issueMock.mockReset().mockResolvedValue('local');
    mentionMock.mockReset().mockResolvedValue('local');
    for (const fn of Object.values(optOut)) fn.mockClear();
    optOut.isIssueOptedOut.mockResolvedValue(false);
    optOut.releaseIssueOptOut.mockResolvedValue(true);
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
    globalThis.fetch = undiciFetch;
    vi.restoreAllMocks();
  });

  it('delivers a plain new issue and records nothing', async () => {
    const json = await post('issues', { action: 'opened', repository: { full_name: 'org/repo' }, issue: issue() });
    expect(json).toMatchObject({ ok: true, outcome: 'local' });
    expect(issueMock).toHaveBeenCalledTimes(1);
    expect(optOut.optOutIssue).not.toHaveBeenCalled();
  });

  it('records the opt-out of an issue opened with a newcomer label, and still hands the delivery to the classifier', async () => {
    issueMock.mockResolvedValue('skipped');
    const json = await post('issues', {
      action: 'opened',
      repository: { full_name: 'org/repo' },
      sender: { login: 'reporter' },
      issue: issue({ labels: [{ name: 'bug' }, { name: 'GoodFirstBug' }] }),
    });
    expect(json).toMatchObject({ ok: true, outcome: 'skipped' });
    expect(optOut.optOutIssue).toHaveBeenCalledWith(
      expect.objectContaining({ repo: 'org/repo', issueNumber: 4321, label: 'goodfirstbug', source: 'opened' }),
    );
  });

  it('a newcomer label added later opts the issue out; any other label is ignored', async () => {
    const json = await post('issues', {
      action: 'labeled',
      repository: { full_name: 'org/repo' },
      sender: { login: 'maintainer' },
      label: { name: 'HelpWanted' },
      issue: issue({ labels: [{ name: 'HelpWanted' }] }),
    });
    expect(json).toMatchObject({ ok: true, outcome: 'opted-out', sessionsStopped: 1 });
    expect(optOut.optOutIssue).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'HelpWanted', actor: 'maintainer', source: 'labeled' }),
    );
    expect(issueMock).not.toHaveBeenCalled();

    const other = await post('issues', {
      action: 'labeled',
      repository: { full_name: 'org/repo' },
      label: { name: 'bug' },
      issue: issue({ labels: [{ name: 'bug' }] }),
    });
    expect(other).toMatchObject({ skipped: true, reason: 'label is not an opt-out' });
  });

  it('removing the last newcomer label releases the opt-out and delivers the issue again as a redelivery', async () => {
    const json = await post('issues', {
      action: 'unlabeled',
      repository: { full_name: 'org/repo' },
      sender: { login: 'maintainer' },
      label: { name: 'no-bot' },
      issue: issue({ labels: [{ name: 'bug' }] }),
    });
    expect(json).toMatchObject({ ok: true, outcome: 'local', released: true });
    expect(optOut.releaseIssueOptOut).toHaveBeenCalledWith('org/repo', 4321, 'maintainer');
    expect(issueMock).toHaveBeenCalledWith(expect.objectContaining({ issueNumber: 4321, redelivery: true }));
  });

  it('removing one newcomer label while another remains changes nothing', async () => {
    const json = await post('issues', {
      action: 'unlabeled',
      repository: { full_name: 'org/repo' },
      label: { name: 'no-bot' },
      issue: issue({ labels: [{ name: 'GoodFirstBug' }] }),
    });
    expect(json).toMatchObject({ skipped: true, reason: 'another opt-out label remains' });
    expect(optOut.releaseIssueOptOut).not.toHaveBeenCalled();
    expect(issueMock).not.toHaveBeenCalled();
  });

  it('a stop mention by the author labels the issue no-bot and opts it out; the comment is not delivered', async () => {
    const json = await post('issue_comment', {
      action: 'created',
      repository: { full_name: 'org/repo' },
      issue: issue(),
      comment: {
        id: 9,
        body: '@bot stop, I will do this myself',
        user: { login: 'reporter' },
        author_association: 'NONE',
      },
    });
    expect(json).toMatchObject({ skipped: true, reason: 'stop mention', labeled: true, sessionsStopped: 1 });
    expect(optOut.addIssueLabel).toHaveBeenCalledWith('org/repo', 4321, 'no-bot');
    expect(optOut.optOutIssue).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'no-bot', actor: 'reporter', source: 'stop-mention' }),
    );
    expect(mentionMock).not.toHaveBeenCalled();
  });

  it('a stop mention by an outsider is an ordinary mention', async () => {
    const json = await post('issue_comment', {
      action: 'created',
      repository: { full_name: 'org/repo' },
      issue: issue(),
      comment: { id: 10, body: '@bot stop', user: { login: 'passer-by' }, author_association: 'CONTRIBUTOR' },
    });
    expect(json).not.toMatchObject({ reason: 'stop mention' });
    expect(optOut.optOutIssue).not.toHaveBeenCalled();
    expect(mentionMock).toHaveBeenCalledTimes(1);
  });

  it('no comment on an opted-out issue is delivered, mention or not', async () => {
    optOut.isIssueOptedOut.mockResolvedValue(true);
    const json = await post('issue_comment', {
      action: 'created',
      repository: { full_name: 'org/repo' },
      issue: issue(),
      comment: { id: 11, body: '@bot please have a look', user: { login: 'someone' }, author_association: 'NONE' },
    });
    expect(json).toMatchObject({ skipped: true, reason: 'issue opted out' });
    expect(mentionMock).not.toHaveBeenCalled();
  });

  it('leaves PR comments alone', async () => {
    const json = await post('issue_comment', {
      action: 'created',
      repository: { full_name: 'org/repo' },
      issue: issue({ pull_request: { url: 'x' } }),
      comment: { id: 12, body: '@bot stop', user: { login: 'reporter' }, author_association: 'OWNER' },
    });
    expect(json).not.toMatchObject({ reason: 'stop mention' });
    expect(optOut.optOutIssue).not.toHaveBeenCalled();
  });
});
