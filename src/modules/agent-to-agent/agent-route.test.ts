import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let _tempDir = '';
vi.mock('../../config.js', () => ({
  get GROUPS_DIR() {
    return path.join(_tempDir, 'groups');
  },
  get DATA_DIR() {
    return path.join(_tempDir, 'data');
  },
}));

vi.mock('../../container-runner.js', () => ({
  wakeContainer: vi.fn(async () => {}),
}));

vi.mock('../../log.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { isSafeAttachmentName, ensureA2aWiring, routeAgentMessage } from './agent-route.js';
import { initTestDb, closeDb, getDb } from '../../db/connection.js';
import { runMigrations } from '../../db/migrations/index.js';
import { migration019 } from '../../db/migrations/019-a2a-session-mode-per-thread.js';
import { migration020 } from '../../db/migrations/020-a2a-session-sources.js';
import { createAgentGroup } from '../../db/agent-groups.js';
import { createSession, getSession } from '../../db/sessions.js';
import {
  createMessagingGroup,
  getMessagingGroupAgents,
  getMessagingGroupByPlatform,
} from '../../db/messaging-groups.js';
import { createDestination } from './db/agent-destinations.js';
import { getSourceFor, recordSource } from '../../db/a2a-session-sources.js';
import { initSessionFolder, writeSessionRouting } from '../../session-manager.js';
import type { Session } from '../../types.js';

/**
 * `forwardAttachedFiles` has a filesystem side that's awkward to unit-test
 * without mocking DATA_DIR. The guarantee worth pinning is that the
 * filename validator rejects everything that could escape the inbox dir —
 * `forwardAttachedFiles` runs this guard before any I/O, so traversal is
 * impossible as long as this matrix holds.
 */
describe('isSafeAttachmentName', () => {
  it('accepts plain filenames', () => {
    expect(isSafeAttachmentName('baby-duck.png')).toBe(true);
    expect(isSafeAttachmentName('file with spaces.pdf')).toBe(true);
    expect(isSafeAttachmentName('report.v2.docx')).toBe(true);
    expect(isSafeAttachmentName('.hidden')).toBe(true); // leading dot is fine, just not `.` / `..`
  });

  it('rejects empty / sentinel values', () => {
    expect(isSafeAttachmentName('')).toBe(false);
    expect(isSafeAttachmentName('.')).toBe(false);
    expect(isSafeAttachmentName('..')).toBe(false);
  });

  it('rejects path separators', () => {
    expect(isSafeAttachmentName('../evil.png')).toBe(false);
    expect(isSafeAttachmentName('/etc/passwd')).toBe(false);
    expect(isSafeAttachmentName('nested/file.txt')).toBe(false);
    expect(isSafeAttachmentName('windows\\path.exe')).toBe(false);
  });

  it('rejects NUL bytes', () => {
    expect(isSafeAttachmentName('clean\0.png')).toBe(false);
  });

  it('rejects anything path.basename would strip', () => {
    expect(isSafeAttachmentName('a/b')).toBe(false);
    expect(isSafeAttachmentName('./thing')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isSafeAttachmentName(null as unknown as string)).toBe(false);
    expect(isSafeAttachmentName(undefined as unknown as string)).toBe(false);
  });
});

// =============================================================
// Thread-aware a2a delegation — tests for the per-thread routing
// that supersedes the old agent-shared-only behaviour. Covers
// Changes 2+3 from the thread-aware-a2a-delegation plan.
// =============================================================

const realCwd = process.cwd();
const now = () => new Date().toISOString();

function setupTempDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-route-test-'));
  _tempDir = tempDir;
  fs.mkdirSync(path.join(tempDir, 'groups'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'data', 'v2-sessions'), { recursive: true });
  process.chdir(tempDir);
  const db = initTestDb();
  runMigrations(db);
  return tempDir;
}

function seedPair(): { senderSession: Session } {
  createAgentGroup({
    id: 'ag-sender',
    name: 'Sender',
    folder: 'sender',
    is_admin: 0,
    agent_provider: null,
    container_config: null,
    coworker_type: null,
    allowed_mcp_tools: null,
    created_at: now(),
  });
  createAgentGroup({
    id: 'ag-recipient',
    name: 'Recipient',
    folder: 'recipient',
    is_admin: 0,
    agent_provider: null,
    container_config: null,
    coworker_type: null,
    allowed_mcp_tools: null,
    created_at: now(),
  });
  createDestination({
    agent_group_id: 'ag-sender',
    local_name: 'recipient',
    target_type: 'agent',
    target_id: 'ag-recipient',
    created_at: now(),
  });
  const senderSession: Session = {
    id: 'sess-sender',
    agent_group_id: 'ag-sender',
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: null,
    created_at: now(),
  };
  // Insert into sessions table so a2a_session_sources' FK on
  // source_session_id can resolve when routeAgentMessage records the route,
  // and initialise the on-disk session folder so the reply-branch's
  // writeSessionMessage has a real inbound.db to append to.
  createSession(senderSession);
  initSessionFolder('ag-sender', senderSession.id);
  return { senderSession };
}

describe('ensureA2aWiring', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = setupTempDb();
  });
  afterEach(() => {
    closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('lazy-creates agent messaging_group and mga with session_mode=per-thread', () => {
    seedPair();
    const mgId = ensureA2aWiring('ag-recipient');
    expect(mgId).toMatch(/^mg-a2a-/);
    const mg = getMessagingGroupByPlatform('agent', 'agent:ag-recipient');
    expect(mg).toBeDefined();
    expect(mg!.channel_type).toBe('agent');
    const mgas = getMessagingGroupAgents(mg!.id);
    expect(mgas).toHaveLength(1);
    expect(mgas[0].agent_group_id).toBe('ag-recipient');
    expect(mgas[0].session_mode).toBe('per-thread');
  });

  it('is idempotent — second call returns the same mg id, no duplicate mga', () => {
    seedPair();
    const first = ensureA2aWiring('ag-recipient');
    const second = ensureA2aWiring('ag-recipient');
    expect(second).toBe(first);
    const mg = getMessagingGroupByPlatform('agent', 'agent:ag-recipient')!;
    expect(getMessagingGroupAgents(mg.id)).toHaveLength(1);
  });
});

describe('routeAgentMessage — thread_id routing', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = setupTempDb();
  });
  afterEach(() => {
    closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('thread_id=null routes to per-source shared session (not agent-shared)', async () => {
    const { senderSession } = seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: null, content: JSON.stringify({ text: 'hi' }) },
      senderSession,
    );
    const rows = getDb()
      .prepare('SELECT id, thread_id, messaging_group_id FROM sessions WHERE agent_group_id = ?')
      .all('ag-recipient') as Array<{ id: string; thread_id: string | null; messaging_group_id: string | null }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].thread_id).toBeNull();
    expect(rows[0].messaging_group_id).not.toBeNull();
  });

  it('two different thread_ids create two distinct recipient sessions', async () => {
    const { senderSession } = seedPair();
    await routeAgentMessage(
      { id: 'out-a', platform_id: 'ag-recipient', thread_id: 'review-PR-A', content: JSON.stringify({ text: 'A' }) },
      senderSession,
    );
    await routeAgentMessage(
      { id: 'out-b', platform_id: 'ag-recipient', thread_id: 'review-PR-B', content: JSON.stringify({ text: 'B' }) },
      senderSession,
    );
    const rows = getDb()
      .prepare('SELECT id, thread_id FROM sessions WHERE agent_group_id = ? ORDER BY created_at')
      .all('ag-recipient') as Array<{ id: string; thread_id: string | null }>;
    const threaded = rows.filter((r) => r.thread_id !== null);
    expect(threaded).toHaveLength(2);
    expect(new Set(threaded.map((r) => r.thread_id))).toEqual(new Set(['review-PR-A', 'review-PR-B']));
    expect(new Set(threaded.map((r) => r.id)).size).toBe(2);
  });

  it('reusing a thread_id routes to the existing per-thread session', async () => {
    const { senderSession } = seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'PR-A', content: JSON.stringify({ text: 'first' }) },
      senderSession,
    );
    await routeAgentMessage(
      { id: 'out-2', platform_id: 'ag-recipient', thread_id: 'PR-A', content: JSON.stringify({ text: 'follow-up' }) },
      senderSession,
    );
    const threaded = getDb()
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ? AND thread_id = ?')
      .all('ag-recipient', 'PR-A') as Array<{ id: string }>;
    expect(threaded).toHaveLength(1);
  });

  it('empty-string thread_id is treated as null (per-source shared)', async () => {
    const { senderSession } = seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: '', content: JSON.stringify({ text: 'x' }) },
      senderSession,
    );
    const rows = getDb()
      .prepare('SELECT thread_id, messaging_group_id FROM sessions WHERE agent_group_id = ?')
      .all('ag-recipient') as Array<{ thread_id: string | null; messaging_group_id: string | null }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].thread_id).toBeNull();
    expect(rows[0].messaging_group_id).not.toBeNull();
  });

  it('unthreaded + threaded deliveries to the same recipient live in two different sessions', async () => {
    const { senderSession } = seedPair();
    await routeAgentMessage(
      { id: 'out-root', platform_id: 'ag-recipient', thread_id: null, content: JSON.stringify({ text: 'root' }) },
      senderSession,
    );
    await routeAgentMessage(
      { id: 'out-thread', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'threaded' }) },
      senderSession,
    );
    const rows = getDb()
      .prepare('SELECT thread_id FROM sessions WHERE agent_group_id = ? ORDER BY created_at')
      .all('ag-recipient') as Array<{ thread_id: string | null }>;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.thread_id).sort((a, b) => (a ?? '').localeCompare(b ?? ''))).toEqual([null, 'T1']);
  });
});

// =============================================================
// Round-trip a2a — source-session envelope regression tests.
// Pin down the critical contract that was broken before migration
// 020: A → B → A lands back in A's original session, NOT a
// freshly-synthesised one.
// =============================================================
describe('routeAgentMessage — source-session envelope (round-trip)', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = setupTempDb();
  });
  afterEach(() => {
    closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('records source mapping + synthetic mg platform_id is composite (source+recipient)', async () => {
    const { senderSession } = seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'hi' }) },
      senderSession,
    );
    // Composite mg platform_id so two sources with same thread_id don't merge.
    const mg = getMessagingGroupByPlatform('agent', 'agent:ag-sender:ag-recipient');
    expect(mg).toBeDefined();
    const [recipientSess] = getDb()
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ?')
      .all('ag-recipient') as Array<{ id: string }>;
    expect(recipientSess).toBeDefined();

    const src = getSourceFor(recipientSess.id);
    expect(src).toBeDefined();
    expect(src!.source_session_id).toBe('sess-sender');
    expect(src!.source_agent_group_id).toBe('ag-sender');
    expect(src!.source_thread_id).toBe('T1');
  });

  it('A→B→A: B replying (bare, platform_id=ag-sender) lands in sess-sender — no new session on A side', async () => {
    const { senderSession } = seedPair();

    // Step 1 — A delegates to B on thread T1.
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'please review' }) },
      senderSession,
    );
    const [recipientRow] = getDb()
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ?')
      .all('ag-recipient') as Array<{ id: string }>;
    const recipientSession = getSession(recipientRow.id)!;

    // Sanity: before reply, A has exactly one session (the seeded sender).
    const aBefore = getDb().prepare('SELECT id FROM sessions WHERE agent_group_id = ?').all('ag-sender') as Array<{
      id: string;
    }>;
    expect(aBefore).toHaveLength(1);
    expect(aBefore[0].id).toBe('sess-sender');

    // Step 2 — B replies bare. After writeSessionRouting the container's
    // default reply routing is {channel_type='agent', platform_id='ag-sender',
    // thread_id='T1'}, so B's outbound row carries platform_id='ag-sender'.
    await routeAgentMessage(
      {
        id: 'out-reply',
        platform_id: 'ag-sender', // ← the real source ag, NOT agent:ag-sender:ag-recipient
        thread_id: 'T1',
        content: JSON.stringify({ text: 'on it' }),
      },
      recipientSession,
    );

    // Assertion: A still has exactly one session (no brand-new one created
    // by re-resolving via routeAgentMessage).
    const aAfter = getDb().prepare('SELECT id FROM sessions WHERE agent_group_id = ?').all('ag-sender') as Array<{
      id: string;
    }>;
    expect(aAfter).toHaveLength(1);
    expect(aAfter[0].id).toBe('sess-sender');
  });

  it('two distinct sources reach the same recipient with the same thread_id without merging', async () => {
    const { senderSession } = seedPair();
    // Second source — another agent with a destination to ag-recipient.
    createAgentGroup({
      id: 'ag-other',
      name: 'Other',
      folder: 'other',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    createDestination({
      agent_group_id: 'ag-other',
      local_name: 'recipient',
      target_type: 'agent',
      target_id: 'ag-recipient',
      created_at: now(),
    });
    const otherSession: Session = {
      id: 'sess-other',
      agent_group_id: 'ag-other',
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    createSession(otherSession);

    // Both pick the same thread_id — a real scenario when two operators
    // coincidentally reference 'review-PR-A'. Pre-fix, these collapsed
    // into one recipient session.
    await routeAgentMessage(
      {
        id: 'out-1',
        platform_id: 'ag-recipient',
        thread_id: 'review-PR-A',
        content: JSON.stringify({ text: 'from A' }),
      },
      senderSession,
    );
    await routeAgentMessage(
      {
        id: 'out-2',
        platform_id: 'ag-recipient',
        thread_id: 'review-PR-A',
        content: JSON.stringify({ text: 'from Other' }),
      },
      otherSession,
    );

    // Two distinct recipient sessions under two distinct synthetic mgs.
    expect(getMessagingGroupByPlatform('agent', 'agent:ag-sender:ag-recipient')).toBeDefined();
    expect(getMessagingGroupByPlatform('agent', 'agent:ag-other:ag-recipient')).toBeDefined();
    const rows = getDb()
      .prepare('SELECT id, thread_id FROM sessions WHERE agent_group_id = ?')
      .all('ag-recipient') as Array<{ id: string; thread_id: string | null }>;
    const threaded = rows.filter((r) => r.thread_id === 'review-PR-A');
    expect(threaded).toHaveLength(2);
    // Each session's source is the corresponding origin session.
    const sources = new Set(threaded.map((r) => getSourceFor(r.id)?.source_session_id));
    expect(sources).toEqual(new Set(['sess-sender', 'sess-other']));
  });

  it('writeSessionRouting on an a2a recipient emits platform_id=<source_ag>, not the synthetic mg', async () => {
    const { senderSession } = seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'hi' }) },
      senderSession,
    );
    const [recipientRow] = getDb()
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ?')
      .all('ag-recipient') as Array<{ id: string }>;

    writeSessionRouting('ag-recipient', recipientRow.id);

    // Open the inbound.db directly and read back the session_routing row.
    const Database = (await import('better-sqlite3')).default;
    const inboundPath = path.join(tempDir, 'data', 'v2-sessions', 'ag-recipient', recipientRow.id, 'inbound.db');
    const db = new Database(inboundPath, { readonly: true });
    const routing = db
      .prepare('SELECT channel_type, platform_id, thread_id FROM session_routing WHERE id = 1')
      .get() as { channel_type: string; platform_id: string; thread_id: string | null };
    db.close();

    // Real source_agent_group_id — so container's bare send_message produces
    // an outbound addressed at ag-sender, which routeAgentMessage's reply
    // branch then delivers back into sess-sender.
    expect(routing.channel_type).toBe('agent');
    expect(routing.platform_id).toBe('ag-sender');
    expect(routing.thread_id).toBe('T1');
  });

  it('fail-closed: if the original source session is gone, the reply is DROPPED (no synthesised session)', async () => {
    const { senderSession } = seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'hi' }) },
      senderSession,
    );
    const [recipientRow] = getDb()
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ?')
      .all('ag-recipient') as Array<{ id: string }>;
    const recipientSession = getSession(recipientRow.id)!;

    // Nuke the original source session with FK enforcement off so the
    // a2a_session_sources row survives — simulating either a race between
    // session delete and reply delivery, or a direct operator intervention
    // that left the hint behind. The fail-closed contract says: even with
    // a stale hint in the table, routeAgentMessage must refuse to
    // synthesise a brand-new session on the sender's side.
    const db = getDb();
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM sessions WHERE id = ?').run('sess-sender');
    db.pragma('foreign_keys = ON');

    // Confirm the adversarial state: sender has no session, but the hint row
    // still points at 'sess-sender'.
    const senderSessionsBefore = db
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ?')
      .all('ag-sender') as Array<{ id: string }>;
    expect(senderSessionsBefore).toHaveLength(0);
    expect(getSourceFor(recipientSession.id)?.source_session_id).toBe('sess-sender');

    // B replies. No source. Reply MUST be dropped (no exception, no new
    // session synthesised on the sender side).
    await expect(
      routeAgentMessage(
        { id: 'out-reply', platform_id: 'ag-sender', thread_id: 'T1', content: JSON.stringify({ text: 'late reply' }) },
        recipientSession,
      ),
    ).resolves.toBeUndefined();

    const senderSessionsAfter = getDb()
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ?')
      .all('ag-sender') as Array<{ id: string }>;
    expect(senderSessionsAfter).toHaveLength(0);
  });

  it('main-route self-target: a2a addressed at own group whose target session resolves to emitter is dropped (L2)', async () => {
    // Coverage net for the auto-route path on `channel_type='agent'`. If
    // formatter L3a or notifyAgent L3b ever regresses and re-introduces a
    // channel='agent' / platformId=<own-group> envelope into the session's
    // inbound, the agent-runner auto-route will emit an outbound with the
    // same routing — a self-targeted a2a. The host's same-session guard at
    // routeAgentMessage's main-route path is the last line of defense and
    // must drop it before any new session, message, or source-mapping is
    // written.
    createAgentGroup({
      id: 'ag-self',
      name: 'Self',
      folder: 'self',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });

    // Pre-create the synthetic mg ensureA2aWiring(self,self) would create,
    // and bind the emitting session to it on threadId=T1. Per-thread
    // resolveSession lookup keys on (agent_group, mg, thread) — so this
    // session IS what resolveSession returns when routeAgentMessage tries
    // to deliver a self-targeted a2a from it. That's exactly the condition
    // L2 watches for.
    const mgId = ensureA2aWiring('ag-self', 'ag-self');
    const session: Session = {
      id: 'sess-self',
      agent_group_id: 'ag-self',
      messaging_group_id: mgId,
      thread_id: 'T1',
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    createSession(session);
    initSessionFolder('ag-self', session.id);

    await routeAgentMessage(
      { id: 'self-a2a', platform_id: 'ag-self', thread_id: 'T1', content: JSON.stringify({ text: 'self-loop bait' }) },
      session,
    );

    // L2 fired: no second session in ag-self, no source-mapping recorded
    // (recordSource is downstream of the L2 return).
    const allSessions = getDb().prepare('SELECT id FROM sessions WHERE agent_group_id = ?').all('ag-self') as Array<{
      id: string;
    }>;
    expect(allSessions).toHaveLength(1);
    expect(allSessions[0].id).toBe(session.id);
    expect(getSourceFor(session.id)).toBeUndefined();
  });

  it('reply self-loop: sourceHint pointing at recipient itself is dropped (defense-in-depth)', async () => {
    // The invariant "source ≠ recipient" is established at recordSource time
    // (the main-route same-session guard runs before recordSource). This test
    // simulates a corruption — migration / backfill / a future code path —
    // that leaves a self-referential hint in a2a_session_sources, and proves
    // the reply branch refuses to write the agent's reply back into its own
    // session (which would feed the model its own output as the next inbound
    // turn and re-open the engine self-loop PR #355 closed).
    const { senderSession } = seedPair();
    // Seed a recipient session manually (no delegation, so no real source).
    const recipientSession: Session = {
      id: 'sess-recipient-self',
      agent_group_id: 'ag-recipient',
      messaging_group_id: null,
      thread_id: 'T1',
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    createSession(recipientSession);
    initSessionFolder('ag-recipient', recipientSession.id);

    // Inject the corrupt mapping: this session points at itself as the source.
    recordSource({
      recipientSessionId: recipientSession.id,
      recipientAgentGroupId: 'ag-recipient',
      recipientThreadId: 'T1',
      sourceSessionId: recipientSession.id,
      sourceAgentGroupId: 'ag-recipient',
      sourceThreadId: 'T1',
    });
    expect(getSourceFor(recipientSession.id)?.source_session_id).toBe(recipientSession.id);

    // Recipient emits a "reply" addressed at its own agent group. Reply
    // detection fires (sourceHint exists, sourceAgentGroupId matches
    // platform_id) — but the new same-session guard must drop the write.
    await expect(
      routeAgentMessage(
        { id: 'out-self', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'echo' }) },
        recipientSession,
      ),
    ).resolves.toBeUndefined();

    // Sanity: nothing about the sender session changed (it wasn't even involved).
    expect(getSession(senderSession.id)).toBeDefined();
  });

  it('B delegating to a fresh third agent C is treated as a new delegation, not a reply', async () => {
    const { senderSession } = seedPair();
    // Third agent C, with a destination from B.
    createAgentGroup({
      id: 'ag-c',
      name: 'C',
      folder: 'c',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'c',
      target_type: 'agent',
      target_id: 'ag-c',
      created_at: now(),
    });

    // A → B delegation first.
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'hi' }) },
      senderSession,
    );
    const [recipientRow] = getDb()
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ?')
      .all('ag-recipient') as Array<{ id: string }>;
    const recipientSession = getSession(recipientRow.id)!;

    // B delegates to C — platform_id=ag-c does NOT match sourceHint's
    // source_agent_group_id (=ag-sender), so this is a fresh delegation,
    // not a reply. C should get its own recipient session.
    await routeAgentMessage(
      { id: 'out-2', platform_id: 'ag-c', thread_id: 'T1', content: JSON.stringify({ text: 'can you help' }) },
      recipientSession,
    );

    // C has a new session; A's sessions are unchanged (sess-sender only).
    const cSessions = getDb().prepare('SELECT id FROM sessions WHERE agent_group_id = ?').all('ag-c') as Array<{
      id: string;
    }>;
    expect(cSessions).toHaveLength(1);
    // The synthetic mg for B→C is agent:ag-recipient:ag-c (composite).
    expect(getMessagingGroupByPlatform('agent', 'agent:ag-recipient:ag-c')).toBeDefined();
    // And C's source is B (not A).
    const cSource = getSourceFor(cSessions[0].id);
    expect(cSource!.source_session_id).toBe(recipientSession.id);
    expect(cSource!.source_agent_group_id).toBe('ag-recipient');
  });

  it('layer 1.5: explicit in_reply_to routes to the originating session even when a2a_session_sources mapping was overwritten', async () => {
    // Scenario: B has been a recipient of TWO sources sequentially —
    // first A (sess-sender), then a third source (sess-other). The
    // a2a_session_sources upsert leaves only the latest mapping (other),
    // so the fork's per-session reply-detection branch can't recover
    // A's session from B alone. Layer 1.5 reads `in_reply_to` and looks
    // up source_session_id in B's inbound DB — which still holds A's
    // session id stamped on the original delegation row.
    const { senderSession } = seedPair();

    // Second source — a peer that also delegates to ag-recipient.
    createAgentGroup({
      id: 'ag-other',
      name: 'Other',
      folder: 'other',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    createDestination({
      agent_group_id: 'ag-other',
      local_name: 'recipient',
      target_type: 'agent',
      target_id: 'ag-recipient',
      created_at: now(),
    });
    const otherSession: Session = {
      id: 'sess-other',
      agent_group_id: 'ag-other',
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    createSession(otherSession);
    initSessionFolder('ag-other', otherSession.id);

    // 1) A → B with thread T1 (records source for B's session = A).
    await routeAgentMessage(
      { id: 'out-A1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'from A' }) },
      senderSession,
    );
    const [recipientRow] = getDb()
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ?')
      .all('ag-recipient') as Array<{ id: string }>;
    const recipientSession = getSession(recipientRow.id)!;

    // 2) Other → same recipient on a DIFFERENT thread to land in a NEW
    // recipient session (so a2a_session_sources for THAT session = other).
    // (Same-session delegations from a different source overwrite via
    // ON CONFLICT, but here we're not testing that — we're testing
    // that B replying to A still routes to A even when a 'other' is
    // active alongside.)
    await routeAgentMessage(
      {
        id: 'out-O1',
        platform_id: 'ag-recipient',
        thread_id: 'T-other',
        content: JSON.stringify({ text: 'from other' }),
      },
      otherSession,
    );

    // 3) B replies to A's original delegation. Outbound carries
    //    in_reply_to=<id of the a2a inbound A→B>. We read that inbound's
    //    real id (the synthetic a2a- prefix) from B's inbound DB.
    const { openInboundDb } = await import('../../session-manager.js');
    const recipDb = openInboundDb('ag-recipient', recipientSession.id);
    const aToBInboundRow = recipDb
      .prepare("SELECT id, source_session_id FROM messages_in WHERE source_session_id = ? AND channel_type = 'agent'")
      .get('sess-sender') as { id: string; source_session_id: string } | undefined;
    recipDb.close();
    expect(aToBInboundRow).toBeDefined();
    expect(aToBInboundRow!.source_session_id).toBe('sess-sender');

    const aSessionsBefore = getDb()
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ?')
      .all('ag-sender') as Array<{ id: string }>;
    expect(aSessionsBefore).toHaveLength(1);

    await routeAgentMessage(
      {
        id: 'out-B-reply',
        platform_id: 'ag-sender',
        thread_id: 'T1',
        content: JSON.stringify({ text: 'on it' }),
        in_reply_to: aToBInboundRow!.id,
      },
      recipientSession,
    );

    // A still has exactly one session (no fresh one created).
    const aSessionsAfter = getDb()
      .prepare('SELECT id FROM sessions WHERE agent_group_id = ?')
      .all('ag-sender') as Array<{ id: string }>;
    expect(aSessionsAfter).toHaveLength(1);
    expect(aSessionsAfter[0].id).toBe('sess-sender');

    // The reply landed in sess-sender's inbound (verified via the row's
    // source_session_id stamp pointing back to the recipient).
    const senderDb = openInboundDb('ag-sender', 'sess-sender');
    const replyRow = senderDb
      .prepare(
        "SELECT source_session_id, content FROM messages_in WHERE channel_type = 'agent' ORDER BY seq DESC LIMIT 1",
      )
      .get() as { source_session_id: string; content: string } | undefined;
    senderDb.close();
    expect(replyRow).toBeDefined();
    expect(replyRow!.source_session_id).toBe(recipientSession.id);
    expect(JSON.parse(replyRow!.content).text).toBe('on it');
  });
});

describe('migration 020', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = setupTempDb();
  });
  afterEach(() => {
    closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a2a_session_sources table with expected columns + indexes', () => {
    const db = getDb();
    const cols = db.prepare('PRAGMA table_info(a2a_session_sources)').all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    expect(names).toEqual(
      new Set([
        'recipient_session_id',
        'recipient_agent_group_id',
        'recipient_thread_id',
        'source_session_id',
        'source_agent_group_id',
        'source_thread_id',
        'created_at',
      ]),
    );
    const idx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name = 'a2a_session_sources'")
      .all() as Array<{ name: string }>;
    const idxNames = idx.map((i) => i.name);
    expect(idxNames).toContain('idx_a2a_src_session');
    expect(idxNames).toContain('idx_a2a_recipient_ag');
    expect(idxNames).toContain('idx_a2a_src_ag_recipient');
  });

  it('is idempotent', () => {
    const db = getDb();
    expect(() => migration020.up(db)).not.toThrow();
    expect(() => migration020.up(db)).not.toThrow();
  });
});

describe('migration 019', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = setupTempDb();
  });
  afterEach(() => {
    closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('upgrades pre-existing channel_type=agent wirings with session_mode=shared to per-thread', () => {
    const db = getDb();
    createAgentGroup({
      id: 'ag-r',
      name: 'R',
      folder: 'r',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    createMessagingGroup({
      id: 'mg-agent-old',
      channel_type: 'agent',
      platform_id: 'agent:ag-r',
      name: null,
      is_group: 0,
      unknown_sender_policy: 'public',
      admin_user_id: null,
      created_at: now(),
    });
    db.prepare(
      `INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, ignored_message_policy, session_mode, priority, created_at)
       VALUES ('mga-old', 'mg-agent-old', 'ag-r', 'always', NULL, 'all', 'drop', 'shared', 0, ?)`,
    ).run(now());

    migration019.up(db);
    const row = db.prepare("SELECT session_mode FROM messaging_group_agents WHERE id = 'mga-old'").get() as {
      session_mode: string;
    };
    expect(row.session_mode).toBe('per-thread');
  });

  it('does not touch dashboard/slack/telegram wirings', () => {
    const db = getDb();
    createAgentGroup({
      id: 'ag-1',
      name: 'A',
      folder: 'a',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    for (const channel of ['slack', 'telegram', 'whatsapp'] as const) {
      const mgId = `mg-${channel}`;
      createMessagingGroup({
        id: mgId,
        channel_type: channel,
        platform_id: `${channel}:x`,
        name: null,
        is_group: 0,
        unknown_sender_policy: 'public',
        admin_user_id: null,
        created_at: now(),
      });
      db.prepare(
        `INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, ignored_message_policy, session_mode, priority, created_at)
         VALUES (?, ?, 'ag-1', 'always', NULL, 'all', 'drop', 'shared', 0, ?)`,
      ).run(`mga-${channel}`, mgId, now());
    }

    migration019.up(db);
    const rows = db
      .prepare("SELECT id, session_mode FROM messaging_group_agents WHERE id LIKE 'mga-%'")
      .all() as Array<{ id: string; session_mode: string }>;
    for (const r of rows) {
      expect(r.session_mode, `row ${r.id} should still be 'shared'`).toBe('shared');
    }
  });

  it('is idempotent', () => {
    const db = getDb();
    createAgentGroup({
      id: 'ag-1',
      name: 'A',
      folder: 'a',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    createMessagingGroup({
      id: 'mg-agent',
      channel_type: 'agent',
      platform_id: 'agent:foo',
      name: null,
      is_group: 0,
      unknown_sender_policy: 'public',
      admin_user_id: null,
      created_at: now(),
    });
    db.prepare(
      `INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, ignored_message_policy, session_mode, priority, created_at)
       VALUES ('mga-1', 'mg-agent', 'ag-1', 'always', NULL, 'all', 'drop', 'per-thread', 0, ?)`,
    ).run(now());

    expect(() => migration019.up(db)).not.toThrow();
    expect(() => migration019.up(db)).not.toThrow();
    const row = db.prepare("SELECT session_mode FROM messaging_group_agents WHERE id = 'mga-1'").get() as {
      session_mode: string;
    };
    expect(row.session_mode).toBe('per-thread');
  });
});
