// Unit tests for src/issue-stand-down.ts: the thread parser, the note, the pure
// decision, and one sweep over mocked sessions and a mocked GitHub.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config.js', () => ({
  GITHUB_WEBHOOK_BOT_MENTION: '@nv-slang-bot',
  ISSUE_STAND_DOWN_ENABLED: true,
  ISSUE_STAND_DOWN_HOURS: 24,
}));

const dbAll = vi.fn(async (_sql: string, ..._args: unknown[]) => [] as unknown[]);
vi.mock('./db/connection.js', () => ({ getDb: () => ({ all: dbAll }) }));

const store = { standDowns: new Map<string, unknown>(), optOuts: new Set<string>() };
vi.mock('./db/issue-opt-outs.js', () => ({
  getIssueOptOut: async (repo: string, n: number) => (store.optOuts.has(`${repo}#${n}`) ? { repo } : undefined),
  getIssueStandDown: async (repo: string, n: number) => store.standDowns.get(`${repo}#${n}`),
  recordIssueStandDown: async (a: { repo: string; issueNumber: number; kind: string; commentId?: number }) => {
    store.standDowns.set(`${a.repo}#${a.issueNumber}`, a);
  },
}));
vi.mock('./issue-opt-out.js', () => ({ hostGitHubToken: () => 'tok' }));

import {
  botLogins,
  decideStandDown,
  parseIssueThread,
  standDownNote,
  sweepIssueStandDowns,
  STAND_DOWN_MARKER,
} from './issue-stand-down.js';

const NOW = new Date('2026-11-05T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

beforeEach(() => {
  dbAll.mockReset().mockResolvedValue([]);
  store.standDowns.clear();
  store.optOuts.clear();
});

describe('parseIssueThread / botLogins / standDownNote', () => {
  it('reads repo and number from the canonical thread id only', () => {
    expect(parseIssueThread('gh-issue-shader-slang/slang-14258')).toEqual({
      repo: 'shader-slang/slang',
      number: 14258,
    });
    expect(parseIssueThread('gh-pr-shader-slang/slang-1')).toBeNull();
    expect(parseIssueThread('14258')).toBeNull();
    expect(parseIssueThread(null)).toBeNull();
  });

  it('knows the bot under both of its logins', () => {
    expect([...botLogins('@nv-slang-bot')].sort()).toEqual(['nv-slang-bot', 'nv-slang-bot[bot]']);
  });

  it('names the assignees when there are any and says so plainly otherwise', () => {
    const named = standDownNote({ assignees: ['pdeayton-nv'], hours: 24 });
    expect(named).toContain(`${STAND_DOWN_MARKER}. It is assigned to @pdeayton-nv`);
    expect(named).toContain('mention @nv-slang-bot in a comment and I will pick it up');
    expect(named).toContain('<sub>');
    const plain = standDownNote({ assignees: [], hours: 24 });
    expect(plain).toContain('No automated triage or fix was started in the first 24 hours');
  });
});

describe('decideStandDown', () => {
  const facts = { state: 'open', assignees: [], botCommented: false, existingNote: false, botReferenced: false };
  const base = {
    createdAt: hoursAgo(30),
    now: NOW,
    hours: 24,
    optedOut: false,
    recorded: false,
    activeWithin: false,
    facts,
  };

  it('posts only for an old, open, silent, un-opted-out, idle chain', () => {
    expect(decideStandDown(base)).toEqual({ action: 'post' });
    expect(decideStandDown({ ...base, recorded: true })).toEqual({ action: 'skip', reason: 'recorded' });
    expect(decideStandDown({ ...base, optedOut: true })).toEqual({ action: 'skip', reason: 'opted-out' });
    expect(decideStandDown({ ...base, createdAt: hoursAgo(5) })).toEqual({ action: 'skip', reason: 'young' });
    expect(decideStandDown({ ...base, activeWithin: true })).toEqual({ action: 'skip', reason: 'active-session' });
    expect(decideStandDown({ ...base, facts: null })).toEqual({ action: 'skip', reason: 'github-unavailable' });
    expect(decideStandDown({ ...base, facts: { ...facts, state: 'closed' } })).toEqual({
      action: 'skip',
      reason: 'closed',
    });
  });

  it('records instead of posting when the bot already spoke or a note is there', () => {
    expect(decideStandDown({ ...base, facts: { ...facts, botCommented: true } })).toEqual({
      action: 'record',
      kind: 'bot-active',
    });
    expect(decideStandDown({ ...base, facts: { ...facts, botReferenced: true } })).toEqual({
      action: 'record',
      kind: 'bot-active',
    });
    expect(decideStandDown({ ...base, facts: { ...facts, botCommented: true, existingNote: true } })).toEqual({
      action: 'record',
      kind: 'coworker',
    });
  });
});

describe('sweepIssueStandDowns', () => {
  function github(
    issues: Record<
      string,
      {
        state?: string;
        assignees?: string[];
        comments?: { login: string; body: string }[];
        timeline?: { event: string; actor: string }[];
      }
    >,
  ) {
    const posts: { url: string; body: string }[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const m = /repos\/([^/]+\/[^/]+)\/issues\/(\d+)(\/comments|\/timeline)?/.exec(url);
      const key = m ? `${m[1]}#${m[2]}` : '';
      const data = issues[key];
      if (!data) return { ok: false, status: 404, json: async () => ({}) };
      if (init?.method === 'POST') {
        posts.push({ url, body: JSON.parse(init.body ?? '{}').body });
        return { ok: true, status: 201, json: async () => ({ id: 900 + posts.length }) };
      }
      if (m?.[3] === '/comments')
        return {
          ok: true,
          status: 200,
          json: async () => (data.comments ?? []).map((c) => ({ user: { login: c.login }, body: c.body })),
        };
      if (m?.[3] === '/timeline')
        return {
          ok: true,
          status: 200,
          json: async () => (data.timeline ?? []).map((e) => ({ event: e.event, actor: { login: e.actor } })),
        };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          state: data.state ?? 'open',
          assignees: (data.assignees ?? []).map((a) => ({ login: a })),
        }),
      };
    });
    return { fetchImpl: fetchImpl as unknown as typeof fetch, posts };
  }

  const session = (n: number, over: Record<string, unknown> = {}) => ({
    id: `s-${n}`,
    thread_id: `gh-issue-org/repo-${n}`,
    status: 'closed',
    container_status: 'stopped',
    last_active: hoursAgo(40),
    created_at: hoursAgo(40),
    ...over,
  });

  it('posts the note on a silent chain, records bot activity without posting, and leaves young or busy chains alone', async () => {
    dbAll.mockResolvedValue([
      session(1),
      session(2, { assignees: [] }),
      session(3, { created_at: hoursAgo(2) }),
      session(4, { status: 'active', container_status: 'running' }),
      session(5),
    ]);
    store.optOuts.add('org/repo#5');
    const gh = github({
      'org/repo#1': { assignees: ['ann'] },
      'org/repo#2': { comments: [{ login: 'nv-slang-bot[bot]', body: 'Triage: ...' }] },
    });
    const res = await sweepIssueStandDowns({ now: NOW, fetchImpl: gh.fetchImpl });
    expect(res.chains).toBe(5);
    expect(res.posted).toBe(1);
    expect(res.recorded).toBe(1);
    expect(res.skipped).toEqual({ young: 1, 'active-session': 1, 'opted-out': 1 });
    expect(gh.posts).toHaveLength(1);
    expect(gh.posts[0].url).toContain('/repos/org/repo/issues/1/comments');
    expect(gh.posts[0].body).toContain('It is assigned to @ann');
    expect(store.standDowns.get('org/repo#1')).toMatchObject({ kind: 'host', commentId: 901 });
    expect(store.standDowns.get('org/repo#2')).toMatchObject({ kind: 'bot-active' });

    // A second sweep finds every chain recorded or skipped; nothing is posted twice.
    const again = await sweepIssueStandDowns({ now: NOW, fetchImpl: gh.fetchImpl });
    expect(again.posted).toBe(0);
    expect(again.skipped.recorded).toBe(2);
  });

  it('treats a coworker note already on the issue as the note, and caps posts per sweep', async () => {
    dbAll.mockResolvedValue([session(11), session(12), session(13)]);
    const gh = github({
      'org/repo#11': { comments: [{ login: 'nv-slang-bot', body: `${STAND_DOWN_MARKER}. It is assigned to @x` }] },
      'org/repo#12': {},
      'org/repo#13': {},
    });
    const res = await sweepIssueStandDowns({ now: NOW, fetchImpl: gh.fetchImpl, maxNotes: 1 });
    expect(res.recorded).toBe(1);
    expect(store.standDowns.get('org/repo#11')).toMatchObject({ kind: 'coworker' });
    expect(res.posted).toBe(1);
    expect(res.skipped['note-cap']).toBe(1);
  });

  it('skips a chain whose issue GitHub cannot return, without recording it', async () => {
    dbAll.mockResolvedValue([session(21)]);
    const gh = github({});
    const res = await sweepIssueStandDowns({ now: NOW, fetchImpl: gh.fetchImpl });
    expect(res.skipped['github-unavailable']).toBe(1);
    expect(store.standDowns.size).toBe(0);
  });
});
