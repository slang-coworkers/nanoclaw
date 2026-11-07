// Unit tests for src/issue-opt-out.ts: the pure classifiers (newcomer labels, stop
// mentions, who may stop), the per-group list writer and the opt-out flow with its
// collaborators mocked.
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config.js', () => ({
  GITHUB_WEBHOOK_BOT_MENTION: '@nv-slang-bot',
  ISSUE_NEWCOMER_LABELS: ['goodfirstbug', 'helpwanted', 'no-bot'],
  ISSUE_STOP_PHRASES: ['stop', 'stand down', "don't work on this", 'do not work on this', 'no bot'],
}));

const killContainer = vi.fn();
vi.mock('./container-runner.js', () => ({ killContainer: (...a: unknown[]) => killContainer(...a) }));

const groups: { folder: string }[] = [];
vi.mock('./db/agent-groups.js', () => ({ getAllAgentGroups: async () => groups }));

const dbAll = vi.fn(async (_sql: string, ..._args: unknown[]) => [] as unknown[]);
vi.mock('./db/connection.js', () => ({ getDb: () => ({ all: dbAll }) }));

const rows = { record: vi.fn(async () => true), release: vi.fn(async () => true), active: [] as unknown[] };
vi.mock('./db/issue-opt-outs.js', () => ({
  recordIssueOptOut: (...a: unknown[]) => rows.record(...(a as [])),
  releaseIssueOptOut: (...a: unknown[]) => rows.release(...(a as [])),
  getIssueOptOut: async () => undefined,
  listActiveIssueOptOuts: async () => rows.active,
  setIssueOptOutSessionsStopped: async () => undefined,
}));

const updateSession = vi.fn(async () => undefined);
vi.mock('./db/sessions.js', () => ({ updateSession: (...a: unknown[]) => updateSession(...(a as [])) }));
vi.mock('./env.js', () => ({ readEnvFile: () => ({}) }));

let tmp: string;
vi.mock('./group-folder.js', () => ({ resolveGroupFolderPath: (folder: string) => path.join(tmp, folder) }));

import {
  isNewcomerLabel,
  isStopMention,
  mayStopIssue,
  newcomerLabelsOf,
  optOutIssue,
  stopPhrasePattern,
  writeIssueOptOutLists,
  ISSUE_OPT_OUT_LIST_FILE,
} from './issue-opt-out.js';

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-opt-out-'));
  groups.length = 0;
  rows.active = [];
  rows.record.mockClear();
  killContainer.mockClear();
  updateSession.mockClear();
  dbAll.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('newcomer labels', () => {
  it('matches the configured labels case-insensitively and nothing else', () => {
    expect(isNewcomerLabel('GoodFirstBug')).toBe(true);
    expect(isNewcomerLabel(' no-bot ')).toBe(true);
    expect(isNewcomerLabel('bug')).toBe(false);
    expect(newcomerLabelsOf(['bug', 'HelpWanted', 'no-bot'])).toEqual(['helpwanted', 'no-bot']);
  });
});

describe('stop mentions', () => {
  it('needs both the mention and a stop phrase', () => {
    expect(isStopMention('@nv-slang-bot please stop, I am on it')).toBe(true);
    expect(isStopMention("@nv-slang-bot don't work on this")).toBe(true);
    expect(isStopMention('@NV-Slang-Bot stand   down')).toBe(true);
    expect(isStopMention('@nv-slang-bot can you look at the repro?')).toBe(false);
    expect(isStopMention('please stop pinging me')).toBe(false);
    expect(isStopMention('')).toBe(false);
  });

  it('matches whole phrases only', () => {
    expect(isStopMention('@nv-slang-bot the stopwatch test fails')).toBe(false);
    expect(isStopMention('@nv-slang-bot unstoppable')).toBe(false);
    expect(stopPhrasePattern(['leave it']).test('please leave it.')).toBe(true);
  });

  it('lets the author and repository people stop, nobody else', () => {
    expect(mayStopIssue({ commenter: 'ann', issueAuthor: 'ann', authorAssociation: 'NONE' })).toBe(true);
    expect(mayStopIssue({ commenter: 'bob', issueAuthor: 'ann', authorAssociation: 'COLLABORATOR' })).toBe(true);
    expect(mayStopIssue({ commenter: 'bob', issueAuthor: 'ann', authorAssociation: 'member' })).toBe(true);
    expect(mayStopIssue({ commenter: 'bob', issueAuthor: 'ann', authorAssociation: 'CONTRIBUTOR' })).toBe(false);
    expect(mayStopIssue({ commenter: '', issueAuthor: '', authorAssociation: 'OWNER' })).toBe(false);
  });
});

describe('writeIssueOptOutLists', () => {
  it('writes the list into every group folder that exists, grouped by repository', async () => {
    groups.push({ folder: 'orchestrator' }, { folder: 'slang-fixer' }, { folder: 'missing' });
    fs.mkdirSync(path.join(tmp, 'orchestrator'));
    fs.mkdirSync(path.join(tmp, 'slang-fixer'));
    rows.active = [
      { repo: 'shader-slang/slang', issue_number: 11, label: 'no-bot' },
      { repo: 'shader-slang/slang', issue_number: 12, label: 'goodfirstbug' },
      { repo: 'shader-slang/slangpy', issue_number: 3, label: 'helpwanted' },
    ];
    const written = await writeIssueOptOutLists();
    expect(written.sort()).toEqual(['orchestrator', 'slang-fixer']);
    const doc = JSON.parse(fs.readFileSync(path.join(tmp, 'slang-fixer', ISSUE_OPT_OUT_LIST_FILE), 'utf-8'));
    expect(doc.issues['shader-slang/slang']).toEqual([
      { number: 11, label: 'no-bot' },
      { number: 12, label: 'goodfirstbug' },
    ]);
    expect(doc.issues['shader-slang/slangpy']).toEqual([{ number: 3, label: 'helpwanted' }]);
    expect(fs.readdirSync(path.join(tmp, 'slang-fixer'))).toEqual([ISSUE_OPT_OUT_LIST_FILE]);
  });

  it('writes an empty list rather than no file when nothing is opted out', async () => {
    groups.push({ folder: 'orchestrator' });
    fs.mkdirSync(path.join(tmp, 'orchestrator'));
    await writeIssueOptOutLists();
    const doc = JSON.parse(fs.readFileSync(path.join(tmp, 'orchestrator', ISSUE_OPT_OUT_LIST_FILE), 'utf-8'));
    expect(doc.issues).toEqual({});
  });
});

describe('optOutIssue', () => {
  it('records, stops every active session on the thread, and rewrites the lists', async () => {
    groups.push({ folder: 'orchestrator' });
    fs.mkdirSync(path.join(tmp, 'orchestrator'));
    dbAll.mockResolvedValue([{ id: 'sess-1' }, { id: 'sess-2' }]);
    const res = await optOutIssue({
      repo: 'shader-slang/slang',
      issueNumber: 11,
      label: 'HelpWanted',
      actor: 'maintainer',
      source: 'labeled',
    });
    expect(res).toEqual({ fresh: true, sessionsStopped: 2, listsWritten: 1 });
    expect(rows.record).toHaveBeenCalledWith(
      expect.objectContaining({ repo: 'shader-slang/slang', issueNumber: 11, label: 'helpwanted', source: 'labeled' }),
    );
    expect(dbAll.mock.calls[0][1]).toBe('gh-issue-shader-slang/slang-11');
    expect(killContainer).toHaveBeenCalledTimes(2);
    expect(updateSession).toHaveBeenCalledWith('sess-1', { status: 'closed', container_status: 'stopped' });
  });

  it('is a no-op when the issue is already opted out (the label echo of a stop mention)', async () => {
    rows.record.mockResolvedValueOnce(false);
    const res = await optOutIssue({
      repo: 'shader-slang/slang',
      issueNumber: 11,
      label: 'no-bot',
      actor: 'nv-slang-bot[bot]',
      source: 'labeled',
    });
    expect(res).toEqual({ fresh: false, sessionsStopped: 0, listsWritten: 0 });
    expect(killContainer).not.toHaveBeenCalled();
  });
});
