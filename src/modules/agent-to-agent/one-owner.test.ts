/**
 * One owner per GitHub work item — a2a.send REFUSES a delivery that would mint
 * a second live session in the recipient group for an item it already owns.
 * Reproduces the #13406 takeover: the Orchestrator dispatched slang-fixer on
 * `gh-issue-shader-slang/slang-11709/13406-resume` "on purpose" so routing
 * would not reach the budget-exhausted owner session on `…-11709`.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import './guard.js';
import { routeAgentMessage } from './agent-route.js';
import { createDestination } from './db/agent-destinations.js';
import { setMessagePolicy } from './db/agent-message-policies.js';
import { closeDb, createAgentGroup, initTestDb, runMigrations } from '../../db/index.js';
import { getDb } from '../../db/connection.js';
import { createSession } from '../../db/sessions.js';
import { GuardDenyError } from '../../guard/index.js';
import { inboundDbPath, outboundDbPath } from '../../mailbox/sqlite/paths.js';
import { initSessionFolder } from '../../session-manager.js';
import type { Session } from '../../types.js';
import { requestApproval } from '../approvals/index.js';

vi.mock('../../container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
}));

vi.mock('../approvals/index.js', async (importActual) => {
  const actual = await importActual<typeof import('../approvals/index.js')>();
  return { ...actual, requestApproval: vi.fn().mockResolvedValue(undefined) };
});

vi.mock('../../config.js', async () => {
  const actual = await vi.importActual('../../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-a2a-one-owner' };
});

const TEST_DIR = '/tmp/nanoclaw-test-a2a-one-owner';
const ORCH = 'ag-orch';
const FIXER = 'ag-fixer';
const CANONICAL = 'gh-issue-shader-slang/slang-11709';
const RESUME = 'gh-issue-shader-slang/slang-11709/13406-resume';

const now = () => new Date().toISOString();

function session(id: string, agentGroupId: string, threadId: string | null, createdAt = now()): Session {
  return {
    id,
    agent_group_id: agentGroupId,
    messaging_group_id: null,
    thread_id: threadId,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: null,
    created_at: createdAt,
  };
}

async function addSession(s: Session): Promise<Session> {
  await createSession(s);
  initSessionFolder(s.agent_group_id, s.id);
  return s;
}

function readInbound(agentGroupId: string, sessionId: string): Array<{ content: string; channel_type: string | null }> {
  const db = new Database(inboundDbPath(agentGroupId, sessionId), { readonly: true });
  const rows = db.prepare('SELECT content, channel_type FROM messages_in ORDER BY seq').all() as Array<{
    content: string;
    channel_type: string | null;
  }>;
  db.close();
  return rows;
}

async function fixerSessionsOn(threadId: string): Promise<Session[]> {
  return getDb().all<Session>('SELECT * FROM sessions WHERE agent_group_id = ? AND thread_id = ?', FIXER, threadId);
}

function writeCostCap(s: Session, value: Record<string, unknown>): void {
  const db = new Database(outboundDbPath(s.agent_group_id, s.id));
  db.exec('CREATE TABLE IF NOT EXISTS session_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)');
  db.prepare('INSERT OR REPLACE INTO session_state (key, value, updated_at) VALUES (?, ?, ?)').run(
    'cost_cap',
    JSON.stringify(value),
    now(),
  );
  db.close();
}

const resumeMsg = (over: Partial<Parameters<typeof routeAgentMessage>[0]> = {}) => ({
  id: `out-${Math.random().toString(36).slice(2, 8)}`,
  platform_id: FIXER,
  thread_id: RESUME,
  content: JSON.stringify({ text: '[Resume] #13406 — the owner ran out of budget; you are a fresh session.' }),
  ...over,
});

async function pendingApprovalCount(): Promise<number> {
  return (await getDb().get<{ n: number }>('SELECT COUNT(*) AS n FROM pending_approvals'))!.n;
}

function senderNotices(s: Session): string[] {
  return readInbound(s.agent_group_id, s.id)
    .filter((r) => r.channel_type === 'system')
    .map((r) => JSON.parse(r.content).text as string);
}

describe('a2a.send — one owner per GitHub work item', () => {
  let orch: Session;
  let owner: Session;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    await runMigrations(await initTestDb());
    vi.mocked(requestApproval).mockClear();

    await createAgentGroup({ id: ORCH, name: 'Orchestrator', folder: 'main', agent_provider: null, created_at: now() });
    await createAgentGroup({
      id: FIXER,
      name: 'slang-fixer',
      folder: 'slang-fixer',
      agent_provider: null,
      created_at: now(),
    });
    await createDestination({
      agent_group_id: ORCH,
      local_name: 'slang-fixer',
      target_type: 'agent',
      target_id: FIXER,
      created_at: now(),
    });
    orch = await addSession(session('sess-orch', ORCH, 'system:tasks:watch-13406-owner-stop'));
    owner = await addSession(session('sess-owner', FIXER, CANONICAL, '2026-08-05T04:08:44.002Z'));
    writeCostCap(owner, { capUsd: 150, spentUsd: 295.72, status: 'escalated', ceilingUsd: 300, window: 'lifetime' });
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  it('refuses a dispatch that would start a second fixer session on a sub-thread of an owned issue', async () => {
    await routeAgentMessage(resumeMsg(), orch);

    expect(await fixerSessionsOn(RESUME)).toHaveLength(0);
    // Refused outright: no card, no pending row, nothing an approval could release.
    expect(requestApproval).not.toHaveBeenCalled();
    expect(await pendingApprovalCount()).toBe(0);

    // The sender is told once, with the owner and its cost state.
    const notices = senderNotices(orch);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toBe(
      'shader-slang/slang#11709 already has a slang-fixer session sess-owner ' +
        '(thread gh-issue-shader-slang/slang-11709, cost escalated $295.72 of $300.00). ' +
        'A second session for the same item is not allowed. ' +
        'Send to that session (target_session_id) or ask the operator to raise its ceiling.',
    );
  });

  it('refuses every spelling of the same item, including the dash form and the PR kind', async () => {
    await routeAgentMessage(resumeMsg({ thread_id: 'gh-issue-shader-slang/slang-11709-take2' }), orch);
    await routeAgentMessage(resumeMsg({ thread_id: 'gh-pr-shader-slang/slang-11709' }), orch);
    expect(await fixerSessionsOn('gh-issue-shader-slang/slang-11709-take2')).toHaveLength(0);
    expect(await fixerSessionsOn('gh-pr-shader-slang/slang-11709')).toHaveLength(0);
    expect(senderNotices(orch)).toHaveLength(2);
  });

  it('refuses even when a policy row would otherwise hold the edge for approval', async () => {
    await setMessagePolicy(ORCH, FIXER, 'telegram:sam', now());
    await routeAgentMessage(resumeMsg(), orch);
    expect(requestApproval).not.toHaveBeenCalled();
    expect(await pendingApprovalCount()).toBe(0);
    expect(await fixerSessionsOn(RESUME)).toHaveLength(0);
  });

  it('a structural deny is unchanged — a missing destination still throws', async () => {
    await getDb().run('DELETE FROM agent_destinations WHERE agent_group_id = ?', ORCH);
    await expect(routeAgentMessage(resumeMsg(), orch)).rejects.toBeInstanceOf(GuardDenyError);
    expect(senderNotices(orch)).toHaveLength(0);
  });

  it('delivers on the canonical thread — it lands in the owner session', async () => {
    await routeAgentMessage(resumeMsg({ thread_id: CANONICAL }), orch);
    expect(await fixerSessionsOn(CANONICAL)).toHaveLength(1);
    expect(readInbound(FIXER, owner.id)).toHaveLength(1);
    expect(senderNotices(orch)).toHaveLength(0);
  });

  it('delivers when the sender pins the owner session', async () => {
    await routeAgentMessage(resumeMsg({ target_session_id: owner.id }), orch);
    expect(await fixerSessionsOn(RESUME)).toHaveLength(0);
    expect(readInbound(FIXER, owner.id)).toHaveLength(1);
    expect(senderNotices(orch)).toHaveLength(0);
  });

  it('allows a new session when every session on the item is closed', async () => {
    await getDb().run("UPDATE sessions SET status = 'closed' WHERE id = ?", owner.id);
    await routeAgentMessage(resumeMsg(), orch);
    expect(await fixerSessionsOn(RESUME)).toHaveLength(1);
  });

  it("allows non-GitHub threads and a group's first session for a different item", async () => {
    await routeAgentMessage(resumeMsg({ thread_id: 'review-PR-A' }), orch);
    await routeAgentMessage(resumeMsg({ thread_id: 'gh-issue-shader-slang/slang-11710/sub' }), orch);
    expect(await fixerSessionsOn('review-PR-A')).toHaveLength(1);
    expect(await fixerSessionsOn('gh-issue-shader-slang/slang-11710/sub')).toHaveLength(1);
    expect(senderNotices(orch)).toHaveLength(0);
  });

  it('counts the pr_session_mappings owner of a PR as the owner of that item', async () => {
    await getDb().run(
      'INSERT INTO pr_session_mappings (repo, pr_number, agent_group_id, session_id, thread_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      'shader-slang/slang',
      13406,
      FIXER,
      owner.id,
      CANONICAL,
      now(),
    );
    await routeAgentMessage(resumeMsg({ thread_id: 'gh-pr-shader-slang/slang-13406' }), orch);
    expect(await fixerSessionsOn('gh-pr-shader-slang/slang-13406')).toHaveLength(0);
    expect(senderNotices(orch)[0]).toMatch(/^shader-slang\/slang#13406 already has a slang-fixer session sess-owner/);
  });

  it('refuses a self-dispatch onto a new sub-thread of an item the group already owns', async () => {
    await routeAgentMessage(resumeMsg({ thread_id: `${CANONICAL}/fresh-budget` }), owner);
    expect(await fixerSessionsOn(`${CANONICAL}/fresh-budget`)).toHaveLength(0);
    expect(senderNotices(owner)).toHaveLength(1);
  });
});
