/**
 * An approved a2a_message_gate replay routes exactly as the held send would
 * have: same thread_id, same target_session_id pin, same guard resource.
 * Before the fix the held payload dropped both, so an approved message fell
 * back to the sender's thread and lost its pin.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import './guard.js';
import { routeAgentMessage } from './agent-route.js';
import { createDestination } from './db/agent-destinations.js';
import { setMessagePolicy } from './db/agent-message-policies.js';
import { applyA2aMessageGate } from './message-gate.js';
import { closeDb, createAgentGroup, initTestDb, runMigrations } from '../../db/index.js';
import { getDb } from '../../db/connection.js';
import { createPendingApproval, createSession, getPendingApproval } from '../../db/sessions.js';
import { guard } from '../../guard/index.js';
import { inboundDbPath } from '../../mailbox/sqlite/paths.js';
import { initSessionFolder } from '../../session-manager.js';
import type { PendingApproval, Session } from '../../types.js';
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

// Record every guard consult, delegating to the real decision.
vi.mock('../../guard/index.js', async (importActual) => {
  const actual = await importActual<typeof import('../../guard/index.js')>();
  return { ...actual, guard: vi.fn(actual.guard) };
});

vi.mock('../../config.js', async () => {
  const actual = await vi.importActual('../../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-a2a-held-replay' };
});

const TEST_DIR = '/tmp/nanoclaw-test-a2a-held-replay';
const A = 'ag-A';
const B = 'ag-B';
const now = () => new Date().toISOString();

function session(id: string, agentGroupId: string, threadId: string | null): Session {
  return {
    id,
    agent_group_id: agentGroupId,
    messaging_group_id: null,
    thread_id: threadId,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: null,
    created_at: now(),
  };
}

async function addSession(s: Session): Promise<Session> {
  await createSession(s);
  initSessionFolder(s.agent_group_id, s.id);
  return s;
}

function inboundTexts(agentGroupId: string, sessionId: string): string[] {
  const path = inboundDbPath(agentGroupId, sessionId);
  if (!fs.existsSync(path)) return [];
  const db = new Database(path, { readonly: true });
  const rows = db.prepare('SELECT content FROM messages_in ORDER BY seq').all() as Array<{ content: string }>;
  db.close();
  return rows.map((r) => JSON.parse(r.content).text as string);
}

async function bSessionsOn(threadId: string | null): Promise<Session[]> {
  return threadId === null
    ? getDb().all<Session>(
        "SELECT * FROM sessions WHERE agent_group_id = ? AND thread_id IS NULL AND id <> 'sess-B'",
        B,
      )
    : getDb().all<Session>('SELECT * FROM sessions WHERE agent_group_id = ? AND thread_id = ?', B, threadId);
}

/** Write the pending row a hold creates, from the payload requestApproval was given. */
async function seedHold(approvalId: string, payload: Record<string, unknown>): Promise<PendingApproval> {
  await createPendingApproval({
    approval_id: approvalId,
    session_id: 'sess-A',
    request_id: approvalId,
    action: 'a2a_message_gate',
    payload: JSON.stringify(payload),
    created_at: now(),
    agent_group_id: A,
    title: 'Message approval',
    options_json: '[]',
    approver_user_id: 'telegram:dana',
  });
  return (await getPendingApproval(approvalId))!;
}

/** Send through the policy hold, then approve it; returns the held payload. */
async function holdThenApprove(
  sender: Session,
  msg: { id: string; thread_id?: string | null; target_session_id?: string | null },
  beforeApprove?: () => Promise<void>,
): Promise<{ payload: Record<string, unknown>; notify: ReturnType<typeof vi.fn> }> {
  await routeAgentMessage(
    { platform_id: B, content: JSON.stringify({ text: msg.id }), in_reply_to: null, ...msg },
    sender,
  );
  expect(requestApproval).toHaveBeenCalledTimes(1);
  const payload = vi.mocked(requestApproval).mock.calls[0][0].payload;
  const approval = await seedHold(`appr-${msg.id}`, payload);
  if (beforeApprove) await beforeApprove();
  const notify = vi.fn();
  await applyA2aMessageGate({ session: sender, userId: 'telegram:dana', notify, payload, approval });
  return { payload, notify };
}

describe('approved a2a_message_gate replay keeps its routing inputs', () => {
  let SA: Session;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    await runMigrations(await initTestDb());
    vi.mocked(requestApproval).mockClear();
    vi.mocked(guard).mockClear();

    await createAgentGroup({ id: A, name: 'A', folder: 'a', agent_provider: null, created_at: now() });
    await createAgentGroup({ id: B, name: 'B', folder: 'b', agent_provider: null, created_at: now() });
    SA = await addSession(session('sess-A', A, 'sender-thread'));
    await addSession(session('sess-B', B, null));
    await createDestination({
      agent_group_id: A,
      local_name: 'b',
      target_type: 'agent',
      target_id: B,
      created_at: now(),
    });
    await setMessagePolicy(A, B, 'telegram:dana', now());
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  it('keeps an explicit thread_id, and re-runs the guard with the same resource', async () => {
    const { payload, notify } = await holdThenApprove(SA, { id: 'threaded', thread_id: 'review-PR-A' });

    expect(payload).toMatchObject({ thread_id: 'review-PR-A', target_session_id: null });
    const onThread = await bSessionsOn('review-PR-A');
    expect(onThread).toHaveLength(1);
    expect(inboundTexts(B, onThread[0].id)).toEqual(['threaded']);
    // Not the sender's thread, which is where the replay used to land.
    expect(await bSessionsOn('sender-thread')).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();

    const [held, replayed] = vi.mocked(guard).mock.calls.map(([, input]) => input);
    expect(replayed.resource).toEqual(held.resource);
    expect(held.resource).toMatchObject({ route: 'fresh', thread: 'review-PR-A' });
    expect(replayed.grant?.approval_id).toBe('appr-threaded');
  });

  it('keeps a target_session_id pin', async () => {
    const pinned = await addSession(session('sess-B-pinned', B, 'pinned-thread'));
    const { payload, notify } = await holdThenApprove(SA, { id: 'pinned', target_session_id: pinned.id });

    expect(payload).toMatchObject({ thread_id: null, target_session_id: pinned.id });
    expect(inboundTexts(B, pinned.id)).toEqual(['pinned']);
    expect(await bSessionsOn('sender-thread')).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
    const [held, replayed] = vi.mocked(guard).mock.calls.map(([, input]) => input);
    expect(replayed.resource).toEqual(held.resource);
    expect(held.resource).toMatchObject({ route: 'pinned' });
  });

  it("a legacy row without the fields replays as before: the sender's thread, no pin", async () => {
    // Held before thread_id / target_session_id were recorded.
    const legacy = { id: 'legacy', platform_id: B, content: JSON.stringify({ text: 'legacy' }), in_reply_to: null };
    const approval = await seedHold('appr-legacy', legacy);
    const notify = vi.fn();
    await applyA2aMessageGate({ session: SA, userId: 'telegram:dana', notify, payload: legacy, approval });

    const onSenderThread = await bSessionsOn('sender-thread');
    expect(onSenderThread).toHaveLength(1);
    expect(inboundTexts(B, onSenderThread[0].id)).toEqual(['legacy']);
    expect(notify).not.toHaveBeenCalled();
  });

  it('a pin whose session was closed while held is ignored; the replay routes unpinned on the stored thread', async () => {
    const pinned = await addSession(session('sess-B-closing', B, 'pinned-thread'));
    const { notify } = await holdThenApprove(
      SA,
      { id: 'stale-pin', thread_id: 'pinned-thread', target_session_id: pinned.id },
      async () => {
        await getDb().run("UPDATE sessions SET status = 'closed' WHERE id = ?", pinned.id);
      },
    );

    // The closed session is neither written to nor woken.
    expect(inboundTexts(B, pinned.id)).toEqual([]);
    // Same outcome as a live send with a stale pin: a session on the stored thread.
    const live = (await bSessionsOn('pinned-thread')).filter((s) => s.status === 'active');
    expect(live).toHaveLength(1);
    expect(inboundTexts(B, live[0].id)).toEqual(['stale-pin']);
    expect(notify).not.toHaveBeenCalled();
  });
});
