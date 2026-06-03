import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config.js', () => ({
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GITHUB_WEBHOOK_PORT: 0,
  GITHUB_WEBHOOK_BOT_MENTION: '@bot',
  INSTANCE_FORWARD_TARGETS: {},
  INSTANCE_SLUG: 'prod',
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

// postEyesReaction re-reads GH_TOKEN from .env at call time (the cron-rotated
// value), falling back to process.env. Mock readEnvFile so tests control the
// file token without touching the real repo .env.
const readEnvFileMock = vi.fn((_keys: string[]) => ({}) as Record<string, string>);
vi.mock('./env.js', () => ({
  readEnvFile: (keys: string[]) => readEnvFileMock(keys),
}));

import { postEyesReaction } from './github-webhook-server.js';

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
