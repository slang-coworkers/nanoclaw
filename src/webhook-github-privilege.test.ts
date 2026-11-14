/**
 * A GitHub event reaches a session of the privilege of its sender
 * (src/modules/session-privilege). Real test database and session folders.
 *
 * Consider a PR whose owner session is closed, because an approved maintainer
 * started it. A comment from someone who is not approved must not reach that
 * session; it starts an open session of the same coworker on the same thread.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config.js', async () => {
  const actual = await vi.importActual<typeof import('./config.js')>('./config.js');
  return {
    ...actual,
    DATA_DIR: '/tmp/nanoclaw-test-webhook-privilege',
    GROUPS_DIR: '/tmp/nanoclaw-test-webhook-privilege/groups',
    INSTANCE_SLUG: '',
  };
});

import { closeDb, createAgentGroup, initTestDb, runMigrations } from './db/index.js';
import { getDb } from './db/connection.js';
import './mailbox/compose.js';
import { inboundDbPath } from './mailbox/sqlite/paths.js';
import { resolveSession } from './session-manager.js';
import { deliverGitHubMention, type GitHubMentionEvent } from './webhook-github.js';
import type { SessionPrivilege } from './modules/session-privilege/index.js';

const TEST_DIR = '/tmp/nanoclaw-test-webhook-privilege';
const REPO = 'shader-slang/slang';
const THREAD = `gh-pr-${REPO}-7`;
const now = () => new Date().toISOString();

function event(commentId: number, privilege: SessionPrivilege | undefined): GitHubMentionEvent {
  return {
    repo: REPO,
    issueNumber: 7,
    commentId,
    commentUrl: `https://github.com/${REPO}/pull/7#issuecomment-${commentId}`,
    commenter: 'someone',
    body: '@bot please look',
    isPr: true,
    privilege,
  };
}

/** The ids of the webhook rows a session's inbound.db holds. */
function inboxOf(sessionId: string): string[] {
  const db = new Database(inboundDbPath('ag-1', sessionId), { readonly: true });
  try {
    return (db.prepare("SELECT id FROM messages_in WHERE kind = 'webhook' ORDER BY id").all() as { id: string }[]).map(
      (r) => r.id,
    );
  } finally {
    db.close();
  }
}

let closedId: string;

beforeEach(async () => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  await runMigrations(await initTestDb());
  await createAgentGroup({ id: 'ag-1', name: 'Orchestrator', folder: 'orch', agent_provider: null, created_at: now() });
  await getDb().run("UPDATE agent_groups SET is_admin = 1 WHERE id = 'ag-1'");
  closedId = (await resolveSession('ag-1', null, THREAD, 'per-thread', 'closed')).session.id;
  await getDb().run(
    'INSERT INTO pr_session_mappings (repo, pr_number, agent_group_id, session_id, thread_id, created_at) VALUES (?, 7, ?, ?, ?, ?)',
    REPO,
    'ag-1',
    closedId,
    THREAD,
    now(),
  );
});

afterEach(async () => {
  await closeDb();
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('deliverGitHubMention on a PR owned by a closed session', () => {
  it('delivers an approved sender to the closed session', async () => {
    expect(await deliverGitHubMention(event(1, 'closed'))).toBe('local');
    expect(inboxOf(closedId)).toEqual(['gh-1']);
  });

  it('delivers an automated sender, which has no privilege, to the owner session', async () => {
    expect(await deliverGitHubMention(event(2, undefined))).toBe('local');
    expect(inboxOf(closedId)).toEqual(['gh-2']);
  });

  it('delivers anyone else to an open session of the same coworker on the same thread, never the closed one', async () => {
    expect(await deliverGitHubMention(event(3, 'open'))).toBe('local');
    expect(inboxOf(closedId)).toEqual([]);

    const sessions = await getDb().all<{ id: string; privilege: string; thread_id: string }>(
      "SELECT id, privilege, thread_id FROM sessions WHERE agent_group_id = 'ag-1' ORDER BY created_at, id",
    );
    expect(sessions.map((s) => [s.privilege, s.thread_id])).toEqual([
      ['closed', THREAD],
      ['open', THREAD],
    ]);
    const open = sessions.find((s) => s.privilege === 'open')!;
    expect(inboxOf(open.id)).toEqual(['gh-3']);

    // A second comment from the same kind of sender reuses that open session.
    expect(await deliverGitHubMention(event(4, 'open'))).toBe('local');
    expect(inboxOf(open.id)).toEqual(['gh-3', 'gh-4']);
    expect(inboxOf(closedId)).toEqual([]);
  });
});
