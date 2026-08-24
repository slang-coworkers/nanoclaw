import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initTestDb, closeDb } from './connection.js';
import { runMigrations } from './migrations/index.js';
import { recordGhThreadOrigin, getGhThreadOrigin } from './gh-thread-origin.js';

beforeEach(() => {
  const db = initTestDb();
  runMigrations(db);
});

afterEach(() => {
  closeDb();
});

describe('recordGhThreadOrigin / getGhThreadOrigin', () => {
  it('records an issue origin and reads it back', () => {
    recordGhThreadOrigin({
      threadId: 'gh-issue-shader-slang/slang-11487',
      repo: 'shader-slang/slang',
      number: 11487,
      kind: 'issue',
      author: 'reporter-login',
    });

    const row = getGhThreadOrigin('gh-issue-shader-slang/slang-11487');
    expect(row).toMatchObject({
      thread_id: 'gh-issue-shader-slang/slang-11487',
      repo: 'shader-slang/slang',
      number: 11487,
      kind: 'issue',
      author: 'reporter-login',
    });
    expect(typeof row?.created_at).toBe('string');
  });

  it('records a PR origin under the gh-pr- key, independent of any issue on the same repo/number', () => {
    recordGhThreadOrigin({
      threadId: 'gh-pr-shader-slang/slang-11487',
      repo: 'shader-slang/slang',
      number: 11487,
      kind: 'pr',
      author: 'contributor-login',
    });

    expect(getGhThreadOrigin('gh-pr-shader-slang/slang-11487')).toMatchObject({
      kind: 'pr',
      author: 'contributor-login',
    });
    expect(getGhThreadOrigin('gh-issue-shader-slang/slang-11487')).toBeUndefined();
  });

  it('is first-observed-wins: a second record for the same thread_id does not overwrite the first', () => {
    recordGhThreadOrigin({
      threadId: 'gh-issue-shader-slang/slang-1',
      repo: 'shader-slang/slang',
      number: 1,
      kind: 'issue',
      author: 'first-observer',
    });
    recordGhThreadOrigin({
      threadId: 'gh-issue-shader-slang/slang-1',
      repo: 'shader-slang/slang',
      number: 1,
      kind: 'issue',
      author: 'second-observer',
    });

    expect(getGhThreadOrigin('gh-issue-shader-slang/slang-1')?.author).toBe('first-observer');
  });

  it('returns undefined for a thread_id never recorded', () => {
    expect(getGhThreadOrigin('gh-issue-shader-slang/slang-999999')).toBeUndefined();
  });

  it('no-ops (never throws) when required fields are missing', () => {
    expect(() =>
      recordGhThreadOrigin({ threadId: '', repo: 'shader-slang/slang', number: 1, kind: 'issue', author: 'x' }),
    ).not.toThrow();
    expect(() =>
      recordGhThreadOrigin({ threadId: 'gh-issue-a-1', repo: 'a', number: 1, kind: 'issue', author: '' }),
    ).not.toThrow();
    expect(getGhThreadOrigin('gh-issue-a-1')).toBeUndefined();
  });
});
