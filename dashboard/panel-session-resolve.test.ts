/**
 * Which NanoClaw session the coworker detail panel follows
 * (dashboard/public/app.js — resolvePanelSession, sessionKindPrefix).
 *
 * Eval copies and other task-only coworkers never have a main session: every
 * `ncl tasks create` run is its own session on the `system:tasks:<series>`
 * thread. The panel used to resolve only the main session (thread_id null) or
 * the open thread, so those coworkers showed "No active session resolved" while
 * a dozen task sessions ran. These tests pin the precedence chain that makes
 * task sessions resolvable, and the Task label.
 *
 * app.js is a browser script with no module exports, so the functions are
 * extracted from source and evaluated — the shipped code, not a copy.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(HERE, 'public', 'app.js'), 'utf-8');

function extract(name: string): string {
  const start = APP.indexOf(`function ${name}(`);
  expect(start, `${name} must exist in app.js`).toBeGreaterThan(-1);
  // The parameter list may itself hold braces (destructured options), so the
  // body starts at the first brace after the matching ')' of the parameters.
  let paren = 0;
  let bodyStart = -1;
  for (let j = APP.indexOf('(', start); j < APP.length; j++) {
    if (APP[j] === '(') paren++;
    else if (APP[j] === ')') {
      paren--;
      if (paren === 0) {
        bodyStart = APP.indexOf('{', j);
        break;
      }
    }
  }
  expect(bodyStart, `${name} must have a body`).toBeGreaterThan(-1);
  let depth = 0;
  let end = -1;
  for (let j = bodyStart; j < APP.length; j++) {
    if (APP[j] === '{') depth++;
    else if (APP[j] === '}') {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  expect(end, `${name} must be brace-balanced`).toBeGreaterThan(-1);
  return APP.slice(start, end);
}

type Sess = {
  nanoclaw_session_id: string;
  thread_id: string | null;
  container_status?: string;
  last_active?: string | null;
  hidden_at?: string | null;
};
type Opts = {
  threadId?: string | null;
  sessionDirectId?: string | null;
  threadFallbackId?: string | null;
  pickedId?: string | null;
};

const resolvePanelSession = new Function(`${extract('resolvePanelSession')}; return resolvePanelSession;`)() as (
  sessions: Sess[],
  opts?: Opts,
) => Sess | null;
const sessionKindPrefix = new Function(`${extract('sessionKindPrefix')}; return sessionKindPrefix;`)() as (
  s: Partial<Sess> | null,
) => string;

const main: Sess = {
  nanoclaw_session_id: 'sess-main',
  thread_id: null,
  container_status: 'stopped',
  last_active: '2026-11-04T10:00:00Z',
};
const chatThread: Sess = {
  nanoclaw_session_id: 'sess-thread',
  thread_id: 'msg-42',
  container_status: 'running',
  last_active: '2026-11-04T11:00:00Z',
};
const taskOld: Sess = {
  nanoclaw_session_id: 'sess-task-old',
  thread_id: 'system:tasks:eval-review-a',
  container_status: 'running',
  last_active: '2026-11-04T09:00:00Z',
};
const taskNew: Sess = {
  nanoclaw_session_id: 'sess-task-new',
  thread_id: 'system:tasks:eval-review-b',
  container_status: 'running',
  last_active: '2026-11-04T12:00:00Z',
};
const taskDone: Sess = {
  nanoclaw_session_id: 'sess-task-done',
  thread_id: 'system:tasks:eval-review-c',
  container_status: 'stopped',
  last_active: '2026-11-04T12:30:00Z',
};
const hiddenTask: Sess = {
  ...taskNew,
  nanoclaw_session_id: 'sess-task-hidden',
  hidden_at: '2026-11-04T12:45:00Z',
  last_active: '2026-11-04T13:00:00Z',
};

describe('resolvePanelSession', () => {
  it('keeps the main session first when the folder has one and no thread is open', () => {
    expect(resolvePanelSession([taskNew, main, chatThread])?.nanoclaw_session_id).toBe('sess-main');
  });

  it('falls back to the most recently active running task session when there is no main session', () => {
    expect(resolvePanelSession([taskOld, taskDone, taskNew])?.nanoclaw_session_id).toBe('sess-task-new');
  });

  it('falls back to the most recently active session when nothing runs', () => {
    const stopped = { ...taskOld, container_status: 'stopped' };
    expect(resolvePanelSession([stopped, taskDone])?.nanoclaw_session_id).toBe('sess-task-done');
  });

  it('never falls back to a hidden session', () => {
    expect(resolvePanelSession([hiddenTask, taskOld])?.nanoclaw_session_id).toBe('sess-task-old');
    expect(resolvePanelSession([hiddenTask])).toBeNull();
  });

  it('honors the session picked in the panel over the main session', () => {
    expect(resolvePanelSession([main, taskOld, taskNew], { pickedId: 'sess-task-old' })?.nanoclaw_session_id).toBe(
      'sess-task-old',
    );
  });

  it('ignores a picked id that no longer exists', () => {
    expect(resolvePanelSession([main, taskNew], { pickedId: 'sess-gone' })?.nanoclaw_session_id).toBe('sess-main');
  });

  it('resolves an open thread by thread_id and nothing else', () => {
    expect(resolvePanelSession([main, chatThread], { threadId: 'msg-42' })?.nanoclaw_session_id).toBe('sess-thread');
    expect(resolvePanelSession([main, taskNew], { threadId: 'msg-404' })).toBeNull();
  });

  it('resolves a session-direct view by session id, then by its originating thread', () => {
    expect(resolvePanelSession([main, taskNew], { sessionDirectId: 'sess-task-new' })?.nanoclaw_session_id).toBe(
      'sess-task-new',
    );
    expect(
      resolvePanelSession([main, taskNew], {
        sessionDirectId: 'sess-gone',
        threadFallbackId: 'system:tasks:eval-review-b',
      })?.nanoclaw_session_id,
    ).toBe('sess-task-new');
    expect(resolvePanelSession([main], { sessionDirectId: 'sess-gone' })).toBeNull();
  });

  it('returns null for an empty folder', () => {
    expect(resolvePanelSession([])).toBeNull();
    expect(resolvePanelSession(undefined as unknown as Sess[])).toBeNull();
  });
});

describe('sessionKindPrefix', () => {
  it('labels main, thread and task sessions', () => {
    expect(sessionKindPrefix(main)).toBe('Session');
    expect(sessionKindPrefix(chatThread)).toBe('Thread');
    expect(sessionKindPrefix(taskNew)).toBe('Task');
    expect(sessionKindPrefix({ thread_id: 'system:tasks' })).toBe('Task');
    expect(sessionKindPrefix(null)).toBe('Session');
  });
});
