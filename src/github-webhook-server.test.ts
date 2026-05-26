import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config.js', () => ({
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GITHUB_WEBHOOK_PORT: 0,
  GITHUB_WEBHOOK_BOT_MENTION: '@bot',
}));

vi.mock('./webhook-github.js', () => ({
  deliverGitHubMention: vi.fn(),
}));

import { postEyesReaction } from './github-webhook-server.js';

describe('postEyesReaction', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT;
    vi.restoreAllMocks();
  });

  it('does nothing when env opt-in is unset (default off)', async () => {
    delete process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT;
    await postEyesReaction('org/repo', 'issue_comment', 123);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when env opt-in is empty string', async () => {
    process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT = '';
    await postEyesReaction('org/repo', 'issue_comment', 123);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when env is "true" (only "1" enables — keeps the gate strict)', async () => {
    process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT = 'true';
    await postEyesReaction('org/repo', 'issue_comment', 123);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when repo is missing (defensive — should never happen post-validation)', async () => {
    process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT = '1';
    await postEyesReaction('', 'issue_comment', 123);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when commentId is 0 (defensive)', async () => {
    process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT = '1';
    await postEyesReaction('org/repo', 'issue_comment', 0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs eyes to /issues/comments/{id}/reactions for issue_comment events', async () => {
    process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT = '1';
    await postEyesReaction('org/repo', 'issue_comment', 12345);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/org/repo/issues/comments/12345/reactions');
    expect(init.method).toBe('POST');
    expect(init.headers.Accept).toBe('application/vnd.github+json');
    expect(JSON.parse(init.body)).toEqual({ content: 'eyes' });
  });

  it('POSTs eyes to /pulls/comments/{id}/reactions for pull_request_review_comment events', async () => {
    process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT = '1';
    await postEyesReaction('org/repo', 'pull_request_review_comment', 99);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/org/repo/pulls/comments/99/reactions');
  });

  it('treats unknown event types as issue_comment-shaped (sane default)', async () => {
    process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT = '1';
    await postEyesReaction('org/repo', 'pull_request', 7);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/org/repo/issues/comments/7/reactions',
    );
  });

  it('does not throw on fetch network failure', async () => {
    process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT = '1';
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));
    await expect(postEyesReaction('org/repo', 'issue_comment', 1)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw on non-OK response (e.g. 422 already-reacted)', async () => {
    process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT = '1';
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422 });
    await expect(postEyesReaction('org/repo', 'issue_comment', 1)).resolves.toBeUndefined();
  });
});
