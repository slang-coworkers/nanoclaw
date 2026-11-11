import { describe, expect, it } from 'vitest';

import { gateRequestFromPayload } from './request.js';

const BOT = '@nv-slang-bot';
const repository = { full_name: 'shader-slang/slang' };
const alice = { login: 'alice', id: 101, type: 'User' };

function req(eventType: string, payload: Record<string, unknown>) {
  return gateRequestFromPayload(eventType, { repository, ...payload }, 'd-1', BOT);
}

describe('gateRequestFromPayload', () => {
  it('issue opened: the author asks, and it does not start work', () => {
    const r = req('issues', {
      action: 'opened',
      issue: { number: 7, user: alice, author_association: 'none' },
    });
    expect(r).toMatchObject({ event: 'issue_opened', repo: 'shader-slang/slang', number: 7, startsWork: false });
    expect(r.actor).toEqual({ login: 'alice', id: 101, type: 'User', association: 'NONE' });
  });

  it('issue labeled: the labeler (sender) asks, with no association', () => {
    const r = req('issues', {
      action: 'labeled',
      issue: { number: 7, user: alice, author_association: 'NONE' },
      sender: { login: 'maint', id: 202, type: 'User' },
    });
    expect(r.event).toBe('issue_labeled');
    expect(r.actor).toEqual({ login: 'maint', id: 202, type: 'User', association: null });
    expect(r.startsWork).toBe(false);
  });

  it('PR reviewable: the PR author asks, and it does not start work', () => {
    const r = req('pull_request', {
      action: 'ready_for_review',
      pull_request: { number: 9, user: alice, author_association: 'CONTRIBUTOR' },
    });
    expect(r).toMatchObject({ event: 'pr_reviewable', number: 9, startsWork: false });
    expect(r.actor?.association).toBe('CONTRIBUTOR');
  });

  it('PR closed is a system event with no actor', () => {
    const r = req('pull_request', { action: 'closed', pull_request: { number: 9, user: alice } });
    expect(r).toMatchObject({ event: 'pr_closed', actor: null, startsWork: false });
  });

  it.each([
    ['Hey @nv-slang-bot please fix', true],
    ['Hey @nv-slang-bot-x please fix', false],
    ['no mention here', false],
  ])('comment %j starts work: %s', (body, starts) => {
    const r = req('issue_comment', {
      action: 'created',
      issue: { number: 7 },
      comment: { body, user: alice, author_association: 'MEMBER' },
    });
    expect(r).toMatchObject({ event: 'comment', number: 7, startsWork: starts });
    expect(r.actor?.association).toBe('MEMBER');
  });

  it('review: the reviewer asks; a mention in the body starts work', () => {
    const r = req('pull_request_review', {
      action: 'submitted',
      pull_request: { number: 9 },
      review: { body: '@nv-slang-bot take this', user: alice, author_association: 'OWNER' },
    });
    expect(r).toMatchObject({ event: 'review', number: 9, startsWork: true });
  });

  it('check_suite is a system event carrying the PR number', () => {
    const r = req('check_suite', { action: 'completed', check_suite: { pull_requests: [{ number: 12 }] } });
    expect(r).toMatchObject({ event: 'check_suite', number: 12, actor: null });
  });

  it('review_thread is a system event', () => {
    const r = req('pull_request_review_thread', { action: 'resolved', pull_request: { number: 9 }, sender: alice });
    expect(r).toMatchObject({ event: 'review_thread', actor: null });
  });

  it('a user without a numeric id keeps the login and a null id', () => {
    const r = req('issue_comment', {
      action: 'created',
      issue: { number: 7 },
      comment: { body: '@nv-slang-bot', user: { login: 'bob' } },
    });
    expect(r.actor).toEqual({ login: 'bob', id: null, type: 'User', association: null });
  });
});
