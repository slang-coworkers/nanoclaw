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
  // Read eagerly by defaultConfig() in db/connection.ts on every initDb call,
  // even though initTestDb overrides the path with ':memory:'.
  get CENTRAL_DB_PATH() {
    return path.join(_tempDir, 'data', 'v2.db');
  },
  ONECLI_URL: 'http://127.0.0.1:10254',
  ONECLI_API_KEY: '',
}));

vi.mock('../../container-runner.js', () => ({
  wakeContainer: vi.fn(async () => {}),
}));

vi.mock('../../log.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { isSafeAttachmentName, ensureA2aWiring, routeAgentMessage, forwardAttachedFiles } from './agent-route.js';
import { initTestDb, closeDb, getDb } from '../../db/connection.js';
import type { DbDriver } from '../../db/driver.js';
import { sqliteRaw } from '../../db/drivers/sqlite.js';
import { runMigrations, type Migration } from '../../db/migrations/index.js';
import { migration919 } from '../../db/migrations/919-a2a-session-mode-per-thread.js';
import { migration920 } from '../../db/migrations/920-a2a-session-sources.js';
import { createAgentGroup } from '../../db/agent-groups.js';
import { createSession, getSession } from '../../db/sessions.js';
import {
  createMessagingGroup,
  getMessagingGroupAgents,
  getMessagingGroupByPlatform,
} from '../../db/messaging-groups.js';
import { createDestination } from './db/agent-destinations.js';
import { getSourceFor } from '../../db/a2a-session-sources.js';
import { initSessionFolder, writeSessionRouting, sessionDir } from '../../session-manager.js';
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

/**
 * `Migration` is a union — a `SqliteOnlyMigration` takes a raw better-sqlite3
 * handle, a `PortableMigration` takes the `DbDriver`. 919/920 are portable;
 * this narrows on the discriminant rather than casting, so reclassifying
 * either one to `sqliteOnly` fails loudly here instead of silently passing a
 * driver where a raw handle is expected.
 */
function runPortableMigration(migration: Migration, db: DbDriver): Promise<void> {
  if (migration.sqliteOnly) {
    throw new Error(`${migration.name} is sqliteOnly — this test expects a portable migration`);
  }
  return Promise.resolve(migration.up(db));
}

async function setupTempDb(): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-route-test-'));
  _tempDir = tempDir;
  fs.mkdirSync(path.join(tempDir, 'groups'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'data', 'v2-sessions'), { recursive: true });
  process.chdir(tempDir);
  const db = await initTestDb();
  await runMigrations(db);
  return tempDir;
}

/**
 * Build the fan-out fixture: two root chains (A1 → B → C and A2 → B → C)
 * sharing the same B and C agent groups. Each root has its own session;
 * per-source isolation gives B two distinct recipient sessions even when
 * the threads match.
 */
async function setupTwoRootChains(): Promise<void> {
  // Each chain uses its OWN B-group (ag-b1, ag-b2) so per-source-AG
  // synthetic mg routing gives distinct C sessions on the (source-ag,
  // thread) key. Sharing one ag-b between both chains would collapse
  // c1 and c2 into a single session (per-source isolation is keyed by
  // source agent_group, not source session).
  for (const id of ['ag-a1', 'ag-a2', 'ag-b1', 'ag-b2', 'ag-c']) {
    await createAgentGroup({
      id,
      name: id,
      folder: id,
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
  }
  await createDestination({
    agent_group_id: 'ag-a1',
    local_name: 'b',
    target_type: 'agent',
    target_id: 'ag-b1',
    created_at: now(),
  });
  await createDestination({
    agent_group_id: 'ag-a2',
    local_name: 'b',
    target_type: 'agent',
    target_id: 'ag-b2',
    created_at: now(),
  });
  await createDestination({
    agent_group_id: 'ag-b1',
    local_name: 'c',
    target_type: 'agent',
    target_id: 'ag-c',
    created_at: now(),
  });
  await createDestination({
    agent_group_id: 'ag-b2',
    local_name: 'c',
    target_type: 'agent',
    target_id: 'ag-c',
    created_at: now(),
  });

  for (const [id, ag] of [
    ['sess-a1', 'ag-a1'],
    ['sess-a2', 'ag-a2'],
  ] as const) {
    const s: Session = {
      id,
      agent_group_id: ag,
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    await createSession(s);
    initSessionFolder(ag, id);
  }
}

async function seedPair(): Promise<{ senderSession: Session }> {
  await createAgentGroup({
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
  await createAgentGroup({
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
  await createDestination({
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
  await createSession(senderSession);
  initSessionFolder('ag-sender', senderSession.id);
  return { senderSession };
}

describe('ensureA2aWiring', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await setupTempDb();
  });
  afterEach(async () => {
    await closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('lazy-creates agent messaging_group and mga with session_mode=per-thread', async () => {
    await seedPair();
    const mgId = await ensureA2aWiring('ag-recipient');
    expect(mgId).toMatch(/^mg-a2a-/);
    const mg = await getMessagingGroupByPlatform('agent', 'agent:ag-recipient');
    expect(mg).toBeDefined();
    expect(mg!.channel_type).toBe('agent');
    const mgas = await getMessagingGroupAgents(mg!.id);
    expect(mgas).toHaveLength(1);
    expect(mgas[0].agent_group_id).toBe('ag-recipient');
    expect(mgas[0].session_mode).toBe('per-thread');
  });

  it('is idempotent — second call returns the same mg id, no duplicate mga', async () => {
    await seedPair();
    const first = await ensureA2aWiring('ag-recipient');
    const second = await ensureA2aWiring('ag-recipient');
    expect(second).toBe(first);
    const mg = (await getMessagingGroupByPlatform('agent', 'agent:ag-recipient'))!;
    expect(await getMessagingGroupAgents(mg.id)).toHaveLength(1);
  });
});

describe('routeAgentMessage — thread_id routing', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await setupTempDb();
  });
  afterEach(async () => {
    await closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('thread_id=null routes to per-source shared session (not agent-shared)', async () => {
    const { senderSession } = await seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: null, content: JSON.stringify({ text: 'hi' }) },
      senderSession,
    );
    const rows = await getDb().all<{ id: string; thread_id: string | null; messaging_group_id: string | null }>(
      'SELECT id, thread_id, messaging_group_id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].thread_id).toBeNull();
    expect(rows[0].messaging_group_id).not.toBeNull();
  });

  it('two different thread_ids create two distinct recipient sessions', async () => {
    const { senderSession } = await seedPair();
    await routeAgentMessage(
      { id: 'out-a', platform_id: 'ag-recipient', thread_id: 'review-PR-A', content: JSON.stringify({ text: 'A' }) },
      senderSession,
    );
    await routeAgentMessage(
      { id: 'out-b', platform_id: 'ag-recipient', thread_id: 'review-PR-B', content: JSON.stringify({ text: 'B' }) },
      senderSession,
    );
    const rows = await getDb().all<{ id: string; thread_id: string | null }>(
      'SELECT id, thread_id FROM sessions WHERE agent_group_id = ? ORDER BY created_at',
      'ag-recipient',
    );
    const threaded = rows.filter((r) => r.thread_id !== null);
    expect(threaded).toHaveLength(2);
    expect(new Set(threaded.map((r) => r.thread_id))).toEqual(new Set(['review-PR-A', 'review-PR-B']));
    expect(new Set(threaded.map((r) => r.id)).size).toBe(2);
  });

  it('reusing a thread_id routes to the existing per-thread session', async () => {
    const { senderSession } = await seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'PR-A', content: JSON.stringify({ text: 'first' }) },
      senderSession,
    );
    await routeAgentMessage(
      { id: 'out-2', platform_id: 'ag-recipient', thread_id: 'PR-A', content: JSON.stringify({ text: 'follow-up' }) },
      senderSession,
    );
    const threaded = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ? AND thread_id = ?',
      'ag-recipient',
      'PR-A',
    );
    expect(threaded).toHaveLength(1);
  });

  it('empty-string thread_id is treated as null (per-source shared)', async () => {
    const { senderSession } = await seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: '', content: JSON.stringify({ text: 'x' }) },
      senderSession,
    );
    const rows = await getDb().all<{ thread_id: string | null; messaging_group_id: string | null }>(
      'SELECT thread_id, messaging_group_id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].thread_id).toBeNull();
    expect(rows[0].messaging_group_id).not.toBeNull();
  });

  it('unthreaded + threaded deliveries to the same recipient live in two different sessions', async () => {
    const { senderSession } = await seedPair();
    await routeAgentMessage(
      { id: 'out-root', platform_id: 'ag-recipient', thread_id: null, content: JSON.stringify({ text: 'root' }) },
      senderSession,
    );
    await routeAgentMessage(
      { id: 'out-thread', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'threaded' }) },
      senderSession,
    );
    const rows = await getDb().all<{ thread_id: string | null }>(
      'SELECT thread_id FROM sessions WHERE agent_group_id = ? ORDER BY created_at',
      'ag-recipient',
    );
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
  beforeEach(async () => {
    tempDir = await setupTempDb();
  });
  afterEach(async () => {
    await closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('records source mapping + synthetic mg platform_id is composite (source+recipient)', async () => {
    const { senderSession } = await seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'hi' }) },
      senderSession,
    );
    // Composite mg platform_id so two sources with same thread_id don't merge.
    const mg = await getMessagingGroupByPlatform('agent', 'agent:ag-sender:ag-recipient');
    expect(mg).toBeDefined();
    const [recipientSess] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    expect(recipientSess).toBeDefined();

    const src = await getSourceFor(recipientSess.id);
    expect(src).toBeDefined();
    expect(src!.source_session_id).toBe('sess-sender');
    expect(src!.source_agent_group_id).toBe('ag-sender');
    expect(src!.source_thread_id).toBe('T1');
  });

  it('A→B→A: B replying (bare, platform_id=ag-sender) lands in sess-sender — no new session on A side', async () => {
    const { senderSession } = await seedPair();

    // Step 1 — A delegates to B on thread T1.
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'please review' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

    // Sanity: before reply, A has exactly one session (the seeded sender).
    const aBefore = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-sender');
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
    const aAfter = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-sender');
    expect(aAfter).toHaveLength(1);
    expect(aAfter[0].id).toBe('sess-sender');
  });

  it('two distinct sources reach the same recipient with the same thread_id without merging', async () => {
    const { senderSession } = await seedPair();
    // Second source — another agent with a destination to ag-recipient.
    await createAgentGroup({
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
    await createDestination({
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
    await createSession(otherSession);

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
    expect(await getMessagingGroupByPlatform('agent', 'agent:ag-sender:ag-recipient')).toBeDefined();
    expect(await getMessagingGroupByPlatform('agent', 'agent:ag-other:ag-recipient')).toBeDefined();
    const rows = await getDb().all<{ id: string; thread_id: string | null }>(
      'SELECT id, thread_id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const threaded = rows.filter((r) => r.thread_id === 'review-PR-A');
    expect(threaded).toHaveLength(2);
    // Each session's source is the corresponding origin session.
    const sources = new Set<string | undefined>();
    for (const r of threaded) sources.add((await getSourceFor(r.id))?.source_session_id);
    expect(sources).toEqual(new Set(['sess-sender', 'sess-other']));
  });

  it('two distinct sources on the same gh-issue thread COLLAPSE into one recipient session (per-message attribution preserved)', async () => {
    const { senderSession } = await seedPair();
    await createAgentGroup({
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
    await createDestination({
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
    await createSession(otherSession);

    // Both sources delegate to the recipient on the SAME canonical issue thread
    // (e.g. triager handoff + main follow-up on shader-slang/slang#9999). Unlike
    // the generic-thread case above, these MUST land in one session so the
    // recipient holds one coherent chain for the issue.
    const tid = 'gh-issue-shader-slang/slang-9999';
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: tid, content: JSON.stringify({ text: 'from A' }) },
      senderSession,
    );
    await routeAgentMessage(
      { id: 'out-2', platform_id: 'ag-recipient', thread_id: tid, content: JSON.stringify({ text: 'from Other' }) },
      otherSession,
    );

    const rows = await getDb().all<{ id: string; thread_id: string | null }>(
      'SELECT id, thread_id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const threaded = rows.filter((r) => r.thread_id === tid);
    expect(threaded).toHaveLength(1);

    // The single recipient session still records WHO sent each message, via the
    // per-message source_session_id column — this is what keeps reply routing
    // correct (per-message, not per-session) after the collapse.
    const recipientId = threaded[0].id;
    const { openInboundDb } = await import('../../session-manager.js');
    const recipientDb = openInboundDb('ag-recipient', recipientId);
    const inbound = recipientDb
      .prepare(
        "SELECT source_session_id FROM messages_in WHERE channel_type = 'agent' AND thread_id = ? ORDER BY seq ASC",
      )
      .all(tid) as Array<{ source_session_id: string | null }>;
    recipientDb.close();
    expect(new Set(inbound.map((r) => r.source_session_id))).toEqual(new Set(['sess-sender', 'sess-other']));
    // And the reply-routing source map points at this one collapsed session.
    expect(await getMessagingGroupByPlatform('agent', 'agent:ag-sender:ag-recipient')).toBeDefined();
    expect(await getMessagingGroupByPlatform('agent', 'agent:ag-other:ag-recipient')).toBeDefined();
    expect(recipientId).toBeTruthy();
  });

  it('writeSessionRouting on an a2a recipient emits platform_id=<source_ag>, not the synthetic mg', async () => {
    const { senderSession } = await seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'hi' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );

    await writeSessionRouting('ag-recipient', recipientRow.id);

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
    const { senderSession } = await seedPair();
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'hi' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

    // Nuke the original source session with FK enforcement off so the
    // a2a_session_sources row survives — simulating either a race between
    // session delete and reply delivery, or a direct operator intervention
    // that left the hint behind. The fail-closed contract says: even with
    // a stale hint in the table, routeAgentMessage must refuse to
    // synthesise a brand-new session on the sender's side.
    const raw = sqliteRaw(getDb());
    raw.pragma('foreign_keys = OFF');
    raw.prepare('DELETE FROM sessions WHERE id = ?').run('sess-sender');
    raw.pragma('foreign_keys = ON');

    // Confirm the adversarial state: sender has no session, but the hint row
    // still points at 'sess-sender'.
    const senderSessionsBefore = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-sender',
    );
    expect(senderSessionsBefore).toHaveLength(0);
    expect((await getSourceFor(recipientSession.id))?.source_session_id).toBe('sess-sender');

    // B replies. No source. Reply MUST be dropped (no exception, no new
    // session synthesised on the sender side).
    await expect(
      routeAgentMessage(
        { id: 'out-reply', platform_id: 'ag-sender', thread_id: 'T1', content: JSON.stringify({ text: 'late reply' }) },
        recipientSession,
      ),
    ).resolves.toBeUndefined();

    const senderSessionsAfter = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-sender',
    );
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
    await createAgentGroup({
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

    // Pre-create the synthetic mg (await ensureA2aWiring(self,self)) would create,
    // and bind the emitting session to it on threadId=T1. Per-thread
    // resolveSession lookup keys on (agent_group, mg, thread) — so this
    // session IS what resolveSession returns when routeAgentMessage tries
    // to deliver a self-targeted a2a from it. That's exactly the condition
    // L2 watches for.
    const mgId = await ensureA2aWiring('ag-self', 'ag-self');
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
    await createSession(session);
    initSessionFolder('ag-self', session.id);

    await routeAgentMessage(
      { id: 'self-a2a', platform_id: 'ag-self', thread_id: 'T1', content: JSON.stringify({ text: 'self-loop bait' }) },
      session,
    );

    // L2 fired: no second session in ag-self, no source-mapping recorded
    // (recordSource is downstream of the L2 return).
    const allSessions = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-self');
    expect(allSessions).toHaveLength(1);
    expect(allSessions[0].id).toBe(session.id);
    expect(await getSourceFor(session.id)).toBeUndefined();
  });

  it('gh-thread self-send: collapse resolves to the emitter session → L2 drops it (no split, no self-inbox)', async () => {
    // On a gh-issue thread, the ^gh-(issue|pr)- collapse makes resolveSession
    // return the canonical (here, the only) session for (agent, thread). A
    // self-targeted a2a from that session therefore resolves to the emitter
    // itself — L2 must drop it rather than deliver the agent's own outbound
    // back into its own inbox or mint a split.
    await createAgentGroup({
      id: 'ag-ghself',
      name: 'GhSelf',
      folder: 'ghself',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    const ghThread = 'gh-issue-r/repo-77';
    // Webhook-style canonical session: messaging_group_id null, on the gh thread.
    const session: Session = {
      id: 'sess-ghself',
      agent_group_id: 'ag-ghself',
      messaging_group_id: null,
      thread_id: ghThread,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    await createSession(session);
    initSessionFolder('ag-ghself', session.id);

    await routeAgentMessage(
      { id: 'gh-self-a2a', platform_id: 'ag-ghself', thread_id: ghThread, content: JSON.stringify({ text: 'echo' }) },
      session,
    );

    // No split minted, no self source-mapping, and the agent's own inbox did
    // not receive the self-targeted message.
    const allSessions = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-ghself');
    expect(allSessions).toHaveLength(1);
    expect(await getSourceFor(session.id)).toBeUndefined();
    const { openInboundDb } = await import('../../session-manager.js');
    const inbox = openInboundDb('ag-ghself', session.id);
    const selfRows = inbox.prepare("SELECT COUNT(*) AS n FROM messages_in WHERE channel_type = 'agent'").get() as {
      n: number;
    };
    inbox.close();
    expect(selfRows.n).toBe(0);
  });

  it('reply routing after gh-collapse: in_reply_to lands at the correct origin even with two senders in one session', async () => {
    // Two distinct senders deliver to the same recipient on a gh-issue thread;
    // the collapse puts both inbounds in ONE recipient session. A reply that
    // names a specific inbound (in_reply_to) must still route home to THAT
    // inbound's source, proving routing is per-message, not per-session.
    const { openInboundDb } = await import('../../session-manager.js');
    const { senderSession } = await seedPair(); // ag-sender → ag-recipient
    await createAgentGroup({
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
    await createDestination({
      agent_group_id: 'ag-other',
      local_name: 'recipient',
      target_type: 'agent',
      target_id: 'ag-recipient',
      created_at: now(),
    });
    // ag-recipient needs a destination back to ag-sender so its reply can route.
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'sender',
      target_type: 'agent',
      target_id: 'ag-sender',
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
    await createSession(otherSession);
    initSessionFolder('ag-other', otherSession.id);

    const tid = 'gh-issue-r/repo-88';
    await routeAgentMessage(
      { id: 'out-A', platform_id: 'ag-recipient', thread_id: tid, content: JSON.stringify({ text: 'from sender' }) },
      senderSession,
    );
    await routeAgentMessage(
      { id: 'out-B', platform_id: 'ag-recipient', thread_id: tid, content: JSON.stringify({ text: 'from other' }) },
      otherSession,
    );

    // One collapsed recipient session holding both inbounds.
    const recRows = await getDb().all<{ id: string }>(
      "SELECT id FROM sessions WHERE agent_group_id = 'ag-recipient' AND thread_id = ?",
      tid,
    );
    expect(recRows).toHaveLength(1);
    const recSession = (await getSession(recRows[0].id))!;

    // Find the inbound row from ag-sender (out-A became an a2a-* inbound with
    // source_session_id = sess-sender). Reply to THAT specific inbound.
    const recInbox = openInboundDb('ag-recipient', recSession.id);
    const senderInbound = recInbox
      .prepare(
        "SELECT id FROM messages_in WHERE channel_type = 'agent' AND source_session_id = 'sess-sender' ORDER BY seq ASC LIMIT 1",
      )
      .get() as { id: string } | undefined;
    recInbox.close();
    expect(senderInbound).toBeDefined();

    await routeAgentMessage(
      {
        id: 'reply-to-sender',
        platform_id: 'ag-sender',
        in_reply_to: senderInbound!.id,
        thread_id: tid,
        content: JSON.stringify({ text: 'reply home' }),
      },
      recSession,
    );

    // The reply landed in sess-sender (the in_reply_to origin), NOT sess-other.
    const senderInbox = openInboundDb('ag-sender', senderSession.id);
    const landed = senderInbox.prepare("SELECT COUNT(*) AS n FROM messages_in WHERE channel_type = 'agent'").get() as {
      n: number;
    };
    senderInbox.close();
    const otherInbox = openInboundDb('ag-other', otherSession.id);
    const otherLanded = otherInbox
      .prepare("SELECT COUNT(*) AS n FROM messages_in WHERE channel_type = 'agent'")
      .get() as { n: number };
    otherInbox.close();
    expect(landed.n).toBeGreaterThan(0);
    expect(otherLanded.n).toBe(0);
  });

  it('reply self-loop: sourceHint pointing at recipient itself is dropped (defense-in-depth)', async () => {
    // The invariant "source ≠ recipient" is established at recordSource time
    // (the main-route same-session guard runs before recordSource). This test
    // simulates a corruption — migration / backfill / a future code path —
    // that leaves a self-referential hint in a2a_session_sources, and proves
    // the reply branch refuses to write the agent's reply back into its own
    // session (which would feed the model its own output as the next inbound
    // turn and re-open the engine self-loop PR #355 closed).
    const { senderSession } = await seedPair();
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
    await createSession(recipientSession);
    initSessionFolder('ag-recipient', recipientSession.id);

    // Inject the corrupt mapping directly: this session points at itself as the
    // source. recordSource now refuses a self-referential write (its own guard),
    // so we insert straight into the table to simulate a row arriving via
    // migration / backfill / a future code path that bypasses recordSource —
    // exactly the corruption this defense-in-depth test exists to cover.
    await getDb().run(
      `INSERT INTO a2a_session_sources
           (recipient_session_id, recipient_agent_group_id, recipient_thread_id,
            source_session_id, source_agent_group_id, source_thread_id, created_at)
         VALUES (?, 'ag-recipient', 'T1', ?, 'ag-recipient', 'T1', ?)`,
      recipientSession.id,
      recipientSession.id,
      now(),
    );
    expect((await getSourceFor(recipientSession.id))?.source_session_id).toBe(recipientSession.id);

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
    expect(await getSession(senderSession.id)).toBeDefined();
  });

  it('B delegating to a fresh third agent C is treated as a new delegation, not a reply', async () => {
    const { senderSession } = await seedPair();
    // Third agent C, with a destination from B.
    await createAgentGroup({
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
    await createDestination({
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
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

    // B delegates to C — platform_id=ag-c does NOT match sourceHint's
    // source_agent_group_id (=ag-sender), so this is a fresh delegation,
    // not a reply. C should get its own recipient session.
    await routeAgentMessage(
      { id: 'out-2', platform_id: 'ag-c', thread_id: 'T1', content: JSON.stringify({ text: 'can you help' }) },
      recipientSession,
    );

    // C has a new session; A's sessions are unchanged (sess-sender only).
    const cSessions = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-c');
    expect(cSessions).toHaveLength(1);
    // The synthetic mg for B→C is agent:ag-recipient:ag-c (composite).
    expect(await getMessagingGroupByPlatform('agent', 'agent:ag-recipient:ag-c')).toBeDefined();
    // And C's source is B (not A).
    const cSource = await getSourceFor(cSessions[0].id);
    expect(cSource!.source_session_id).toBe(recipientSession.id);
    expect(cSource!.source_agent_group_id).toBe('ag-recipient');
  });

  it('multi-hop default: child replies to its direct parent node, not the root ancestor', async () => {
    const { senderSession } = await seedPair();

    await createAgentGroup({
      id: 'ag-child',
      name: 'Child',
      folder: 'child',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'child',
      target_type: 'agent',
      target_id: 'ag-child',
      created_at: now(),
    });

    // Root A delegates thread T1 to node B.
    await routeAgentMessage(
      { id: 'out-A-to-B', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'triage' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

    // Node B delegates the same thread to child C.
    await routeAgentMessage(
      { id: 'out-B-to-C', platform_id: 'ag-child', thread_id: 'T1', content: JSON.stringify({ text: 'fix' }) },
      recipientSession,
    );
    const [childRow] = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-child');
    const childSession = (await getSession(childRow.id))!;

    // Child C's bare/default reply goes to its direct source B. It must not
    // skip B and land in root A just because A exists in the ancestry.
    await routeAgentMessage(
      { id: 'out-C-to-B', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'fix done' }) },
      childSession,
    );

    const { openInboundDb } = await import('../../session-manager.js');
    const recipientDb = openInboundDb('ag-recipient', recipientSession.id);
    const directReply = recipientDb
      .prepare(
        "SELECT source_session_id, thread_id, content FROM messages_in WHERE channel_type = 'agent' ORDER BY seq DESC LIMIT 1",
      )
      .get() as { source_session_id: string; thread_id: string | null; content: string } | undefined;
    recipientDb.close();

    expect(directReply).toBeDefined();
    expect(directReply!.source_session_id).toBe(childSession.id);
    expect(directReply!.thread_id).toBe('T1');
    expect(JSON.parse(directReply!.content).text).toBe('fix done');

    const senderDb = openInboundDb('ag-sender', senderSession.id);
    const rootRows = senderDb
      .prepare("SELECT id FROM messages_in WHERE channel_type = 'agent' AND source_session_id = ?")
      .all(childSession.id) as Array<{ id: string }>;
    senderDb.close();
    expect(rootRows).toHaveLength(0);
  });

  it('multi-hop explicit ancestor: child can report to root without creating a sibling root thread', async () => {
    const { senderSession } = await seedPair();

    await createAgentGroup({
      id: 'ag-child',
      name: 'Child',
      folder: 'child',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'child',
      target_type: 'agent',
      target_id: 'ag-child',
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-child',
      local_name: 'root',
      target_type: 'agent',
      target_id: 'ag-sender',
      created_at: now(),
    });

    // Root A → node B → child C.
    await routeAgentMessage(
      { id: 'out-A-to-B', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'triage' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

    await routeAgentMessage(
      { id: 'out-B-to-C', platform_id: 'ag-child', thread_id: 'T1', content: JSON.stringify({ text: 'fix' }) },
      recipientSession,
    );
    const [childRow] = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-child');
    const childSession = (await getSession(childRow.id))!;

    const senderSessionsBefore = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-sender',
    );
    expect(senderSessionsBefore).toHaveLength(1);

    // This is the desired anti-fragmentation behavior for q7xfmf-like cases:
    // C may explicitly report to ancestor A, but it should land in A's
    // existing origin session rather than creating a new per-thread session.
    await routeAgentMessage(
      { id: 'out-C-to-A', platform_id: 'ag-sender', thread_id: 'T1', content: JSON.stringify({ text: 'root report' }) },
      childSession,
    );

    const senderSessionsAfter = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-sender',
    );
    expect(senderSessionsAfter).toHaveLength(1);
    expect(senderSessionsAfter[0].id).toBe(senderSession.id);

    const { openInboundDb } = await import('../../session-manager.js');
    const senderDb = openInboundDb('ag-sender', senderSession.id);
    const rootReport = senderDb
      .prepare(
        "SELECT source_session_id, thread_id, content FROM messages_in WHERE channel_type = 'agent' ORDER BY seq DESC LIMIT 1",
      )
      .get() as { source_session_id: string; thread_id: string | null; content: string } | undefined;
    senderDb.close();

    expect(rootReport).toBeDefined();
    expect(rootReport!.source_session_id).toBe(childSession.id);
    expect(rootReport!.thread_id).toBe('T1');
    expect(JSON.parse(rootReport!.content).text).toBe('root report');
  });

  it('multi-hop stale ancestor: child→root drops when the root session was deleted (no fresh root synthesised)', async () => {
    const { senderSession } = await seedPair();

    await createAgentGroup({
      id: 'ag-child',
      name: 'Child',
      folder: 'child',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'child',
      target_type: 'agent',
      target_id: 'ag-child',
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-child',
      local_name: 'root',
      target_type: 'agent',
      target_id: 'ag-sender',
      created_at: now(),
    });

    // A → B → C, with all three sessions established.
    await routeAgentMessage(
      { id: 'out-A-to-B', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'triage' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

    await routeAgentMessage(
      { id: 'out-B-to-C', platform_id: 'ag-child', thread_id: 'T1', content: JSON.stringify({ text: 'fix' }) },
      recipientSession,
    );
    const [childRow] = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-child');
    const childSession = (await getSession(childRow.id))!;

    // Adversarial state: nuke A's session but leave the chain intact in
    // a2a_session_sources so the walk reaches a row whose source_session_id
    // points at a deleted session. Fail-closed must drop, not synthesise.
    const raw = sqliteRaw(getDb());
    raw.pragma('foreign_keys = OFF');
    raw.prepare('DELETE FROM sessions WHERE id = ?').run('sess-sender');
    raw.pragma('foreign_keys = ON');

    expect(await getDb().all('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-sender')).toHaveLength(0);

    await expect(
      routeAgentMessage(
        {
          id: 'out-C-to-A',
          platform_id: 'ag-sender',
          thread_id: 'T1',
          content: JSON.stringify({ text: 'late root report' }),
        },
        childSession,
      ),
    ).resolves.toBeUndefined();

    expect(await getDb().all('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-sender')).toHaveLength(0);
  });

  it('ancestor walk drops cleanly when the chain encodes a self-cycle', async () => {
    // Adversarial backfill: corrupt a2a_session_sources so the walk would
    // visit the emitting session itself. The bounded walk + visited-set
    // must terminate without delivering and without throwing.
    const { senderSession } = await seedPair();
    await routeAgentMessage(
      { id: 'out-A-to-B', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'first' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

    // Stamp a self-pointing source row over the recipient's existing one.
    // INSERT OR REPLACE matches the production upsert semantics.
    await getDb().run(
      `INSERT OR REPLACE INTO a2a_session_sources
           (recipient_session_id, recipient_agent_group_id, recipient_thread_id,
            source_session_id, source_agent_group_id, source_thread_id, created_at)
         VALUES (?, ?, 'T1', ?, ?, 'T1', ?)`,
      recipientSession.id,
      recipientSession.agent_group_id,
      recipientSession.id, // self-pointing
      recipientSession.agent_group_id,
      now(),
    );

    // B writes to a third (unrelated) group. The ancestor walk should
    // detect the self-cycle and bail; main-route fresh delegation takes
    // over. No exception, no infinite loop, fresh peer session created.
    await createAgentGroup({
      id: 'ag-stranger',
      name: 'Stranger',
      folder: 'stranger',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'stranger',
      target_type: 'agent',
      target_id: 'ag-stranger',
      created_at: now(),
    });

    await expect(
      routeAgentMessage(
        {
          id: 'out-B-to-stranger',
          platform_id: 'ag-stranger',
          thread_id: 'T1',
          content: JSON.stringify({ text: 'lateral' }),
        },
        recipientSession,
      ),
    ).resolves.toBeUndefined();

    const strangerSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-stranger',
    );
    expect(strangerSessions).toHaveLength(1);
  });

  it('precedence: explicit in_reply_to beats lineage when target group is in ancestry', async () => {
    // Setup: A → B → C lineage AND a separate older A session that B's
    // inbound row points back at via in_reply_to. The reorder contract
    // ("exact inbound named by sender wins over lineage row") routes the
    // reply to the in_reply_to-resolved session, not to the lineage's
    // most-recent A session. Without the reorder, ancestor walk would
    // collapse the reply onto whichever A session lineage points at.
    const { senderSession } = await seedPair();

    await createAgentGroup({
      id: 'ag-child',
      name: 'Child',
      folder: 'child',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'child',
      target_type: 'agent',
      target_id: 'ag-child',
      created_at: now(),
    });

    // First leg: A → B with thread T1.
    await routeAgentMessage(
      { id: 'out-A1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'first' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

    // Second leg: B → C, establishing C in the lineage.
    await routeAgentMessage(
      { id: 'out-B-to-C', platform_id: 'ag-child', thread_id: 'T1', content: JSON.stringify({ text: 'fix' }) },
      recipientSession,
    );
    const [childRow] = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-child');
    const childSession = (await getSession(childRow.id))!;

    // Read the inbound id of A→B in B's inbound DB; this is what C cannot
    // know about, but B can use as in_reply_to when it answers A.
    const { openInboundDb } = await import('../../session-manager.js');
    const recipDb = openInboundDb('ag-recipient', recipientSession.id);
    const aToBInboundRow = recipDb
      .prepare("SELECT id FROM messages_in WHERE source_session_id = ? AND channel_type = 'agent'")
      .get('sess-sender') as { id: string } | undefined;
    recipDb.close();
    expect(aToBInboundRow).toBeDefined();

    // B replies to A with explicit in_reply_to. Lineage says
    // findAncestorRoute(B, ag-sender) would route to A's session via the
    // ancestry row — same target session in this case, so the assertion
    // is about the precedence path rather than a divergent destination.
    // The key is that the reply routes via the explicit-target path
    // (resolveExplicitReplyTarget), not via the ancestor walk.
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

    // Reply landed in sess-sender's inbound stamped with B as the source.
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

    // No new sender-side session created — both ancestor walk and
    // in_reply_to converge on the same originator, but neither path
    // forks q7xfmf-style.
    const senderSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-sender',
    );
    expect(senderSessions).toHaveLength(1);

    // Sanity: childSession exists and didn't receive this reply
    // (the message was emitted by recipientSession, not childSession).
    expect(childSession).toBeDefined();
  });

  it('closed ancestor: child→root drops when root session status is non-active', async () => {
    // The ancestor session row exists, but its status was flipped to
    // 'closed' (e.g. operator ended the conversation). Ancestor walk
    // must not resurrect it by writing a fresh inbound + waking the
    // container. Mirrors resolveExplicitReplyTarget's status='active'
    // requirement.
    const { senderSession } = await seedPair();

    await createAgentGroup({
      id: 'ag-child',
      name: 'Child',
      folder: 'child',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'child',
      target_type: 'agent',
      target_id: 'ag-child',
      created_at: now(),
    });

    await routeAgentMessage(
      { id: 'out-A-to-B', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'triage' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

    await routeAgentMessage(
      { id: 'out-B-to-C', platform_id: 'ag-child', thread_id: 'T1', content: JSON.stringify({ text: 'fix' }) },
      recipientSession,
    );
    const [childRow] = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-child');
    const childSession = (await getSession(childRow.id))!;

    // Close the root session.
    await getDb().run("UPDATE sessions SET status = 'closed' WHERE id = ?", 'sess-sender');
    expect((await getSession('sess-sender'))!.status).toBe('closed');

    // Snapshot inbound count before, so we can assert no row was added.
    const { openInboundDb } = await import('../../session-manager.js');
    const senderDb = openInboundDb('ag-sender', 'sess-sender');
    const before = (
      senderDb.prepare("SELECT COUNT(*) AS n FROM messages_in WHERE channel_type = 'agent'").get() as {
        n: number;
      }
    ).n;
    senderDb.close();

    await expect(
      routeAgentMessage(
        {
          id: 'out-C-to-A',
          platform_id: 'ag-sender',
          thread_id: 'T1',
          content: JSON.stringify({ text: 'late root report' }),
        },
        childSession,
      ),
    ).resolves.toBeUndefined();

    const senderDb2 = openInboundDb('ag-sender', 'sess-sender');
    const after = (
      senderDb2.prepare("SELECT COUNT(*) AS n FROM messages_in WHERE channel_type = 'agent'").get() as {
        n: number;
      }
    ).n;
    senderDb2.close();
    expect(after).toBe(before);

    // No new ancestor-side session should have been spawned either.
    const senderSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-sender',
    );
    expect(senderSessions).toHaveLength(1);
    expect(senderSessions[0].id).toBe('sess-sender');
  });

  it('lineage authorization: child can reach an ancestor without an explicit destination row (intentional)', async () => {
    // Defines an explicit contract: ancestor walk's lineage IS the
    // authorization. A child does NOT need a hasDestination row pointing
    // at the root; the chain itself proves it has reply privilege. This
    // test exists so future reviewers can see the design intent rather
    // than "fix" lineage to require destinations.
    const { senderSession } = await seedPair();

    await createAgentGroup({
      id: 'ag-child',
      name: 'Child',
      folder: 'child',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'child',
      target_type: 'agent',
      target_id: 'ag-child',
      created_at: now(),
    });
    // Deliberately NO destination from ag-child → ag-sender.

    await routeAgentMessage(
      { id: 'out-A-to-B', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'triage' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

    await routeAgentMessage(
      { id: 'out-B-to-C', platform_id: 'ag-child', thread_id: 'T1', content: JSON.stringify({ text: 'fix' }) },
      recipientSession,
    );
    const [childRow] = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-child');
    const childSession = (await getSession(childRow.id))!;

    // No destination from C → A — but lineage proves the chain. Should
    // succeed, not throw "unauthorized".
    await expect(
      routeAgentMessage(
        {
          id: 'out-C-to-A',
          platform_id: 'ag-sender',
          thread_id: 'T1',
          content: JSON.stringify({ text: 'root report' }),
        },
        childSession,
      ),
    ).resolves.toBeUndefined();

    // Reply landed in the existing root session (same shape as the
    // multi-hop explicit ancestor test).
    const senderSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-sender',
    );
    expect(senderSessions).toHaveLength(1);
  });

  it('depth > 2: A → B → C → D — D can report to root A directly', async () => {
    const { senderSession } = await seedPair();

    for (const id of ['ag-c', 'ag-d']) {
      await createAgentGroup({
        id,
        name: id,
        folder: id,
        is_admin: 0,
        agent_provider: null,
        container_config: null,
        coworker_type: null,
        allowed_mcp_tools: null,
        created_at: now(),
      });
    }
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'c',
      target_type: 'agent',
      target_id: 'ag-c',
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-c',
      local_name: 'd',
      target_type: 'agent',
      target_id: 'ag-d',
      created_at: now(),
    });

    // A → B
    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 's1' }) },
      senderSession,
    );
    const recipientSession = (await getSession(
      (await getDb().all<{ id: string }>('SELECT id FROM sessions WHERE agent_group_id=?', 'ag-recipient'))[0].id,
    ))!;

    // B → C
    await routeAgentMessage(
      { id: 'out-2', platform_id: 'ag-c', thread_id: 'T1', content: JSON.stringify({ text: 's2' }) },
      recipientSession,
    );
    const cSession = (await getSession(
      (await getDb().all<{ id: string }>('SELECT id FROM sessions WHERE agent_group_id=?', 'ag-c'))[0].id,
    ))!;

    // C → D
    await routeAgentMessage(
      { id: 'out-3', platform_id: 'ag-d', thread_id: 'T1', content: JSON.stringify({ text: 's3' }) },
      cSession,
    );
    const dSession = (await getSession(
      (await getDb().all<{ id: string }>('SELECT id FROM sessions WHERE agent_group_id=?', 'ag-d'))[0].id,
    ))!;

    // D → A: 3-hop ancestor walk should land in the original A session,
    // no new sender-side session synthesised.
    await routeAgentMessage(
      { id: 'out-4', platform_id: 'ag-sender', thread_id: 'T1', content: JSON.stringify({ text: 'root rpt' }) },
      dSession,
    );

    const senderSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-sender',
    );
    expect(senderSessions).toHaveLength(1);
    expect(senderSessions[0].id).toBe('sess-sender');

    const { openInboundDb } = await import('../../session-manager.js');
    const senderDb = openInboundDb('ag-sender', 'sess-sender');
    const reply = senderDb
      .prepare(
        "SELECT source_session_id, content FROM messages_in WHERE channel_type = 'agent' ORDER BY seq DESC LIMIT 1",
      )
      .get() as { source_session_id: string; content: string } | undefined;
    senderDb.close();
    expect(reply).toBeDefined();
    expect(reply!.source_session_id).toBe(dSession.id);
    expect(JSON.parse(reply!.content).text).toBe('root rpt');
  });

  it('two-roots same thread: A1→B1→C and A2→B2→C, C→A1 must not land in A2', async () => {
    // Fan-out isolation. Two independent root chains using the same
    // thread_id share a leaf agent group (ag-c) but live in distinct
    // recipient sessions per source. A reply from C-on-chain-1 to A1
    // must walk back to A1's session via the chain-1 lineage row, not
    // collide with A2.
    await setupTwoRootChains();

    const a1 = (await getSession('sess-a1'))!;
    const a2 = (await getSession('sess-a2'))!;

    await routeAgentMessage(
      { id: 'out-a1-b1', platform_id: 'ag-b1', thread_id: 'T1', content: JSON.stringify({ text: 'a1->b' }) },
      a1,
    );
    await routeAgentMessage(
      { id: 'out-a2-b2', platform_id: 'ag-b2', thread_id: 'T1', content: JSON.stringify({ text: 'a2->b' }) },
      a2,
    );

    const b1 = (await getSession(
      (await getDb().all<{ id: string }>('SELECT id FROM sessions WHERE agent_group_id=?', 'ag-b1'))[0].id,
    ))!;
    const b2 = (await getSession(
      (await getDb().all<{ id: string }>('SELECT id FROM sessions WHERE agent_group_id=?', 'ag-b2'))[0].id,
    ))!;

    // Each B sends to C on the same thread. Two C sessions emerge.
    await routeAgentMessage(
      { id: 'out-b1-c', platform_id: 'ag-c', thread_id: 'T1', content: JSON.stringify({ text: 'b1->c' }) },
      b1,
    );
    await routeAgentMessage(
      { id: 'out-b2-c', platform_id: 'ag-c', thread_id: 'T1', content: JSON.stringify({ text: 'b2->c' }) },
      b2,
    );

    const cSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ? ORDER BY created_at',
      'ag-c',
    );
    expect(cSessions).toHaveLength(2);
    const c1 = (await getSession(cSessions[0].id))!;
    const c2 = (await getSession(cSessions[1].id))!;

    // C-on-chain-1 reports up to A1. Must land in sess-a1 (not sess-a2).
    await routeAgentMessage(
      { id: 'out-c1-a1', platform_id: 'ag-a1', thread_id: 'T1', content: JSON.stringify({ text: 'c1->a1' }) },
      c1,
    );

    const { openInboundDb } = await import('../../session-manager.js');
    const a1Db = openInboundDb('ag-a1', 'sess-a1');
    const a1Reply = a1Db
      .prepare(
        "SELECT source_session_id, content FROM messages_in WHERE channel_type = 'agent' ORDER BY seq DESC LIMIT 1",
      )
      .get() as { source_session_id: string; content: string } | undefined;
    a1Db.close();
    expect(a1Reply).toBeDefined();
    expect(a1Reply!.source_session_id).toBe(c1.id);
    expect(JSON.parse(a1Reply!.content).text).toBe('c1->a1');

    // A2 received nothing on this exchange.
    const a2Db = openInboundDb('ag-a2', 'sess-a2');
    const a2Rows = a2Db.prepare("SELECT id FROM messages_in WHERE channel_type = 'agent'").all() as Array<{
      id: string;
    }>;
    a2Db.close();
    expect(a2Rows).toHaveLength(0);

    // Mirror: C-on-chain-2 reports to A2. Must land in sess-a2.
    await routeAgentMessage(
      { id: 'out-c2-a2', platform_id: 'ag-a2', thread_id: 'T1', content: JSON.stringify({ text: 'c2->a2' }) },
      c2,
    );
    const a2Db2 = openInboundDb('ag-a2', 'sess-a2');
    const a2Reply = a2Db2
      .prepare(
        "SELECT source_session_id, content FROM messages_in WHERE channel_type = 'agent' ORDER BY seq DESC LIMIT 1",
      )
      .get() as { source_session_id: string; content: string } | undefined;
    a2Db2.close();
    expect(a2Reply).toBeDefined();
    expect(a2Reply!.source_session_id).toBe(c2.id);
    expect(JSON.parse(a2Reply!.content).text).toBe('c2->a2');

    // No fresh A1/A2 sessions synthesised.
    expect(await getDb().all('SELECT id FROM sessions WHERE agent_group_id=?', 'ag-a1')).toHaveLength(1);
    expect(await getDb().all('SELECT id FROM sessions WHERE agent_group_id=?', 'ag-a2')).toHaveLength(1);
  });

  it('unrelated peer same thread: descendant→peer with a reused thread_id stays fresh/lateral', async () => {
    // A→B→C plus a stranger D sharing thread_id 'T1'. C → D must NOT
    // walk to ancestor A just because thread_id matches; D is not in
    // C's lineage. Should create a fresh per-source D session.
    const { senderSession } = await seedPair();

    for (const id of ['ag-c', 'ag-d']) {
      await createAgentGroup({
        id,
        name: id,
        folder: id,
        is_admin: 0,
        agent_provider: null,
        container_config: null,
        coworker_type: null,
        allowed_mcp_tools: null,
        created_at: now(),
      });
    }
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'c',
      target_type: 'agent',
      target_id: 'ag-c',
      created_at: now(),
    });
    await createDestination({
      agent_group_id: 'ag-c',
      local_name: 'd',
      target_type: 'agent',
      target_id: 'ag-d',
      created_at: now(),
    });

    await routeAgentMessage(
      { id: 'out-1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: '1' }) },
      senderSession,
    );
    const recipientSession = (await getSession(
      (await getDb().all<{ id: string }>('SELECT id FROM sessions WHERE agent_group_id=?', 'ag-recipient'))[0].id,
    ))!;
    await routeAgentMessage(
      { id: 'out-2', platform_id: 'ag-c', thread_id: 'T1', content: JSON.stringify({ text: '2' }) },
      recipientSession,
    );
    const cSession = (await getSession(
      (await getDb().all<{ id: string }>('SELECT id FROM sessions WHERE agent_group_id=?', 'ag-c'))[0].id,
    ))!;

    // C → D with thread_id=T1. D is not an ancestor → fresh session.
    await routeAgentMessage(
      { id: 'out-3', platform_id: 'ag-d', thread_id: 'T1', content: JSON.stringify({ text: 'lateral' }) },
      cSession,
    );

    const dSessions = await getDb().all<{
      id: string;
    }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-d');
    expect(dSessions).toHaveLength(1);

    // A's session count unchanged — ancestor walk did NOT collapse the
    // lateral D message onto A.
    expect(await getDb().all('SELECT id FROM sessions WHERE agent_group_id=?', 'ag-sender')).toHaveLength(1);
  });

  it('layer 1.5: explicit in_reply_to routes to the originating session even when a2a_session_sources mapping was overwritten', async () => {
    // Scenario: B has been a recipient of TWO sources sequentially —
    // first A (sess-sender), then a third source (sess-other). The
    // a2a_session_sources upsert leaves only the latest mapping (other),
    // so the fork's per-session reply-detection branch can't recover
    // A's session from B alone. Layer 1.5 reads `in_reply_to` and looks
    // up source_session_id in B's inbound DB — which still holds A's
    // session id stamped on the original delegation row.
    const { senderSession } = await seedPair();

    // Second source — a peer that also delegates to ag-recipient.
    await createAgentGroup({
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
    await createDestination({
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
    await createSession(otherSession);
    initSessionFolder('ag-other', otherSession.id);

    // 1) A → B with thread T1 (records source for B's session = A).
    await routeAgentMessage(
      { id: 'out-A1', platform_id: 'ag-recipient', thread_id: 'T1', content: JSON.stringify({ text: 'from A' }) },
      senderSession,
    );
    const [recipientRow] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const recipientSession = (await getSession(recipientRow.id))!;

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

    const aSessionsBefore = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-sender',
    );
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
    const aSessionsAfter = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-sender',
    );
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

  it('D1 guard: a direct in_reply_to pointing at an unrelated (non-ancestor) thread is rejected, not hijacked', async () => {
    // Hijack shape: agent rA (thread A) replies naming an inbound whose origin
    // session sC lives on thread C — a session NOT in rA's lineage — but stamps
    // a THIRD thread B. Layer 1 must NOT deliver into sC; it should fall through
    // to the stamped thread's own routing (fresh + auth).
    const { openInboundDb } = await import('../../session-manager.js');
    await seedPair(); // ag-sender, ag-recipient, ag-sender→ag-recipient destination
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'sender',
      target_type: 'agent',
      target_id: 'ag-sender',
      created_at: now(),
    });

    // sC: sender-group session on thread "C" (the future in_reply_to target).
    const sC: Session = {
      id: 'sess-sC',
      agent_group_id: 'ag-sender',
      messaging_group_id: null,
      thread_id: 'C',
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    await createSession(sC);
    initSessionFolder('ag-sender', sC.id);

    // sC dispatches to ag-recipient on thread "A" → mints rA (recipient session
    // on thread A) whose inbox row carries source_session_id = sess-sC.
    await routeAgentMessage(
      {
        id: 'out-C-to-A',
        platform_id: 'ag-recipient',
        thread_id: 'A',
        content: JSON.stringify({ text: 'from C on A' }),
      },
      sC,
    );
    const rARow = (await getDb().get<{ id: string }>(
      "SELECT id FROM sessions WHERE agent_group_id = 'ag-recipient' AND thread_id = 'A'",
    ))!;
    const rA = (await getSession(rARow.id))!;

    // Sever the lineage so sC is NOT rA's ancestor — isolates the guard from the
    // Layer-2 ancestor walk (which would otherwise legitimately re-deliver to sC).
    await getDb().run('DELETE FROM a2a_session_sources WHERE recipient_session_id = ?', rA.id);

    const rAInbox = openInboundDb('ag-recipient', rA.id);
    const srcInbound = rAInbox
      .prepare(
        "SELECT id FROM messages_in WHERE channel_type = 'agent' AND source_session_id = 'sess-sC' ORDER BY seq ASC LIMIT 1",
      )
      .get() as { id: string } | undefined;
    rAInbox.close();
    expect(srcInbound).toBeDefined();

    // rA replies, NAMING the sC inbound, but STAMPS thread "B" (≠ C, ≠ A).
    await routeAgentMessage(
      {
        id: 'reply-stamped-B',
        platform_id: 'ag-sender',
        in_reply_to: srcInbound!.id,
        thread_id: 'B',
        content: JSON.stringify({ text: 'stamped B' }),
      },
      rA,
    );

    // Guard fired: NOTHING delivered into sC (thread C).
    const sCInbox = openInboundDb('ag-sender', sC.id);
    const inC = (
      sCInbox.prepare("SELECT COUNT(*) AS n FROM messages_in WHERE channel_type = 'agent'").get() as { n: number }
    ).n;
    sCInbox.close();
    expect(inC).toBe(0);

    // Fell through to a fresh per-thread session on the STAMPED thread B.
    const bSessions = await getDb().all(
      "SELECT id FROM sessions WHERE agent_group_id = 'ag-sender' AND thread_id = 'B'",
    );
    expect(bSessions).toHaveLength(1);
  });

  it('D1 guard does NOT fire on a same-thread reply (candidate thread === stamped thread)', async () => {
    // Same setup as above, but rA stamps thread "C" — matching the candidate's
    // thread. This is a legitimate reply; the guard must NOT fire and delivery
    // must land in sC.
    const { openInboundDb } = await import('../../session-manager.js');
    await seedPair();
    await createDestination({
      agent_group_id: 'ag-recipient',
      local_name: 'sender',
      target_type: 'agent',
      target_id: 'ag-sender',
      created_at: now(),
    });
    const sC: Session = {
      id: 'sess-sC',
      agent_group_id: 'ag-sender',
      messaging_group_id: null,
      thread_id: 'C',
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    await createSession(sC);
    initSessionFolder('ag-sender', sC.id);
    await routeAgentMessage(
      { id: 'out-C-to-A2', platform_id: 'ag-recipient', thread_id: 'A', content: JSON.stringify({ text: 'from C' }) },
      sC,
    );
    const rARow = (await getDb().get<{ id: string }>(
      "SELECT id FROM sessions WHERE agent_group_id = 'ag-recipient' AND thread_id = 'A'",
    ))!;
    const rA = (await getSession(rARow.id))!;
    await getDb().run('DELETE FROM a2a_session_sources WHERE recipient_session_id = ?', rA.id);
    const rAInbox = openInboundDb('ag-recipient', rA.id);
    const srcInbound = rAInbox
      .prepare(
        "SELECT id FROM messages_in WHERE channel_type = 'agent' AND source_session_id = 'sess-sC' ORDER BY seq ASC LIMIT 1",
      )
      .get() as { id: string };
    rAInbox.close();

    await routeAgentMessage(
      {
        id: 'reply-stamped-C',
        platform_id: 'ag-sender',
        in_reply_to: srcInbound.id,
        thread_id: 'C', // matches candidate thread → guard must NOT fire
        content: JSON.stringify({ text: 'stamped C' }),
      },
      rA,
    );

    const sCInbox = openInboundDb('ag-sender', sC.id);
    const inC = (
      sCInbox.prepare("SELECT COUNT(*) AS n FROM messages_in WHERE channel_type = 'agent'").get() as { n: number }
    ).n;
    sCInbox.close();
    expect(inC).toBeGreaterThan(0);
  });

  it('peer-affinity respects thread_id: re-dispatch on thread X routes to that thread, not most-recent peer overall', async () => {
    // Multi-thread fan-out scenario: A dispatches to B on TWO different
    // threads (T-1 and T-2). Two B sessions emerge. B-on-T-2 replies
    // most-recently. A then re-dispatches on T-1 (no in_reply_to). The
    // unfiltered peer-affinity heuristic would route to B-on-T-2 (most
    // recent overall); the thread-filtered lookup must pin to B-on-T-1.
    const { senderSession } = await seedPair();

    // 1) A → B on thread T-1.
    await routeAgentMessage(
      {
        id: 'out-A-T1-1',
        platform_id: 'ag-recipient',
        thread_id: 'T-1',
        content: JSON.stringify({ text: 'first dispatch on T-1' }),
      },
      senderSession,
    );
    const [bOnT1Row] = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    const bOnT1 = (await getSession(bOnT1Row.id))!;

    // 2) A → B on thread T-2 (creates a SECOND B session via per-thread routing).
    await routeAgentMessage(
      {
        id: 'out-A-T2',
        platform_id: 'ag-recipient',
        thread_id: 'T-2',
        content: JSON.stringify({ text: 'dispatch on T-2' }),
      },
      senderSession,
    );
    const bSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ? ORDER BY created_at',
      'ag-recipient',
    );
    expect(bSessions).toHaveLength(2);
    const bOnT2 = (await getSession(bSessions.find((s) => s.id !== bOnT1.id)!.id))!;

    // 3) B-on-T-2 replies (so its reply is the MOST RECENT inbound from
    //    ag-recipient in A's inbound DB).
    await routeAgentMessage(
      {
        id: 'out-B-T2-reply',
        platform_id: 'ag-sender',
        thread_id: 'T-2',
        content: JSON.stringify({ text: 'T-2 reply' }),
      },
      bOnT2,
    );

    // 4) A re-dispatches on thread T-1 (no in_reply_to). Without the
    //    thread filter, peer-affinity would resolve to bOnT-2 (most recent
    //    inbound from peer overall) and the message would mis-route.
    //    With the filter, it pins to bOnT-1.
    await routeAgentMessage(
      {
        id: 'out-A-T1-2',
        platform_id: 'ag-recipient',
        thread_id: 'T-1',
        content: JSON.stringify({ text: 'second dispatch on T-1' }),
      },
      senderSession,
    );

    // The new dispatch should land in bOnT-1, NOT in bOnT-2 and NOT spawn a third session.
    const bSessionsAfter = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    expect(bSessionsAfter).toHaveLength(2);

    const { openInboundDb } = await import('../../session-manager.js');
    const bT1Db = openInboundDb('ag-recipient', bOnT1.id);
    const bT1Latest = bT1Db
      .prepare("SELECT content FROM messages_in WHERE channel_type = 'agent' ORDER BY seq DESC LIMIT 1")
      .get() as { content: string } | undefined;
    bT1Db.close();
    expect(bT1Latest).toBeDefined();
    expect(JSON.parse(bT1Latest!.content).text).toBe('second dispatch on T-1');

    // bOnT-2 should NOT have received the T-1 dispatch.
    const bT2Db = openInboundDb('ag-recipient', bOnT2.id);
    const bT2Latest = bT2Db
      .prepare("SELECT content FROM messages_in WHERE channel_type = 'agent' ORDER BY seq DESC LIMIT 1")
      .get() as { content: string } | undefined;
    bT2Db.close();
    expect(bT2Latest).toBeDefined();
    // Most recent T-2 inbound is still the original T-2 dispatch ("dispatch on T-2"),
    // NOT the new T-1 dispatch ("second dispatch on T-1").
    expect(JSON.parse(bT2Latest!.content).text).toBe('dispatch on T-2');
  });

  it('peer-affinity with thread_id=null preserves most-recent-overall behavior (single-thread parity)', async () => {
    // When the outbound carries no thread_id, peer-affinity must keep
    // the old "most recent inbound from this peer wins" semantics.
    // Multi-thread inboxes don't apply here (the sender didn't pick a
    // thread); the heuristic is meant to be "answer whoever talked to me
    // last." Regression guard so the new threadId param doesn't change
    // the unthreaded path.
    const { senderSession } = await seedPair();

    // Two B sessions, on T-1 and T-2.
    await routeAgentMessage(
      { id: 'out-A-T1', platform_id: 'ag-recipient', thread_id: 'T-1', content: JSON.stringify({ text: 'd-T1' }) },
      senderSession,
    );
    const bOnT1 = (await getSession(
      (await getDb().all<{ id: string }>('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-recipient'))[0].id,
    ))!;
    await routeAgentMessage(
      { id: 'out-A-T2', platform_id: 'ag-recipient', thread_id: 'T-2', content: JSON.stringify({ text: 'd-T2' }) },
      senderSession,
    );
    const bSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ? ORDER BY created_at',
      'ag-recipient',
    );
    const bOnT2 = (await getSession(bSessions.find((s) => s.id !== bOnT1.id)!.id))!;

    // B-on-T-2 replies most-recently.
    await routeAgentMessage(
      { id: 'out-BT2-r', platform_id: 'ag-sender', thread_id: 'T-2', content: JSON.stringify({ text: 'r-T2' }) },
      bOnT2,
    );

    // A sends to B with NO thread_id. Peer-affinity falls back to
    // most-recent-overall (which is the T-2 reply). The unthreaded reply
    // routes to bOnT-2 — same as pre-fix behavior.
    await routeAgentMessage(
      { id: 'out-A-untrhd', platform_id: 'ag-recipient', thread_id: null, content: JSON.stringify({ text: 'untrhd' }) },
      senderSession,
    );

    // No new B session created.
    expect(await getDb().all('SELECT id FROM sessions WHERE agent_group_id = ?', 'ag-recipient')).toHaveLength(2);

    // The unthreaded message landed in bOnT-2 (most-recent peer overall).
    const { openInboundDb } = await import('../../session-manager.js');
    const bT2Db = openInboundDb('ag-recipient', bOnT2.id);
    const bT2Latest = bT2Db
      .prepare("SELECT content FROM messages_in WHERE channel_type = 'agent' ORDER BY seq DESC LIMIT 1")
      .get() as { content: string } | undefined;
    bT2Db.close();
    expect(bT2Latest).toBeDefined();
    expect(JSON.parse(bT2Latest!.content).text).toBe('untrhd');
  });
});

describe('migration 020', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await setupTempDb();
  });
  afterEach(async () => {
    await closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a2a_session_sources table with expected columns + indexes', async () => {
    const cols = await getDb().all<{ name: string }>('PRAGMA table_info(a2a_session_sources)');
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
    const idx = await getDb().all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name = 'a2a_session_sources'",
    );
    const idxNames = idx.map((i) => i.name);
    expect(idxNames).toContain('idx_a2a_src_session');
    expect(idxNames).toContain('idx_a2a_recipient_ag');
    expect(idxNames).toContain('idx_a2a_src_ag_recipient');
  });

  it('is idempotent', async () => {
    const db = getDb();
    await expect(runPortableMigration(migration920, db)).resolves.not.toThrow();
    await expect(runPortableMigration(migration920, db)).resolves.not.toThrow();
  });
});

describe('migration 019', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await setupTempDb();
  });
  afterEach(async () => {
    await closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('upgrades pre-existing channel_type=agent wirings with session_mode=shared to per-thread', async () => {
    const db = getDb();
    await createAgentGroup({
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
    await createMessagingGroup({
      id: 'mg-agent-old',
      channel_type: 'agent',
      platform_id: 'agent:ag-r',
      name: null,
      is_group: 0,
      unknown_sender_policy: 'public',
      admin_user_id: null,
      created_at: now(),
    });
    await db.run(
      `INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, ignored_message_policy, session_mode, priority, created_at)
       VALUES ('mga-old', 'mg-agent-old', 'ag-r', 'always', NULL, 'all', 'drop', 'shared', 0, ?)`,
      now(),
    );

    await runPortableMigration(migration919, db);
    const row = (await db.get<{ session_mode: string }>(
      "SELECT session_mode FROM messaging_group_agents WHERE id = 'mga-old'",
    ))!;
    expect(row.session_mode).toBe('per-thread');
  });

  it('does not touch dashboard/slack/telegram wirings', async () => {
    const db = getDb();
    await createAgentGroup({
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
      await createMessagingGroup({
        id: mgId,
        channel_type: channel,
        platform_id: `${channel}:x`,
        name: null,
        is_group: 0,
        unknown_sender_policy: 'public',
        admin_user_id: null,
        created_at: now(),
      });
      await db.run(
        `INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, ignored_message_policy, session_mode, priority, created_at)
         VALUES (?, ?, 'ag-1', 'always', NULL, 'all', 'drop', 'shared', 0, ?)`,
        `mga-${channel}`,
        mgId,
        now(),
      );
    }

    await runPortableMigration(migration919, db);
    const rows = await db.all<{ id: string; session_mode: string }>(
      "SELECT id, session_mode FROM messaging_group_agents WHERE id LIKE 'mga-%'",
    );
    for (const r of rows) {
      expect(r.session_mode, `row ${r.id} should still be 'shared'`).toBe('shared');
    }
  });

  it('is idempotent', async () => {
    const db = getDb();
    await createAgentGroup({
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
    await createMessagingGroup({
      id: 'mg-agent',
      channel_type: 'agent',
      platform_id: 'agent:foo',
      name: null,
      is_group: 0,
      unknown_sender_policy: 'public',
      admin_user_id: null,
      created_at: now(),
    });
    await db.run(
      `INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, ignored_message_policy, session_mode, priority, created_at)
       VALUES ('mga-1', 'mg-agent', 'ag-1', 'always', NULL, 'all', 'drop', 'per-thread', 0, ?)`,
      now(),
    );

    await expect(runPortableMigration(migration919, db)).resolves.not.toThrow();
    await expect(runPortableMigration(migration919, db)).resolves.not.toThrow();
    const row = (await db.get<{ session_mode: string }>(
      "SELECT session_mode FROM messaging_group_agents WHERE id = 'mga-1'",
    ))!;
    expect(row.session_mode).toBe('per-thread');
  });
});

// =============================================================
// Layer 0: sender-pinned recipient session via `target_session_id`.
// Verifies the pin lands the message in the named session when valid,
// silently falls through on validation mismatch, and never bypasses the
// destination authorization gate.
// =============================================================
describe('routeAgentMessage — target_session_id (Layer 0 pin)', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await setupTempDb();
  });
  afterEach(async () => {
    await closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /** Create an extra recipient session belonging to ag-recipient — used as
   *  the pin target. Returned id matches the convention of the thread-based
   *  fresh-delegation path so we can assert "pin landed here, not a fresh". */
  async function seedPinnedSession(id: string, threadId: string | null = null): Promise<Session> {
    const s: Session = {
      id,
      agent_group_id: 'ag-recipient',
      messaging_group_id: null,
      thread_id: threadId,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    await createSession(s);
    initSessionFolder('ag-recipient', id);
    return s;
  }

  it('valid pin: delivery lands in the named session, no fresh session minted', async () => {
    const { senderSession } = await seedPair();
    const pinned = await seedPinnedSession('sess-pinned-ok');

    await routeAgentMessage(
      {
        id: 'out-pin',
        platform_id: 'ag-recipient',
        thread_id: 'unrelated-thread',
        content: JSON.stringify({ text: 'wake up' }),
        target_session_id: pinned.id,
      },
      senderSession,
    );

    const recipientSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    // Only the pre-seeded session exists — no fresh per-thread mint
    expect(recipientSessions.map((r) => r.id)).toEqual([pinned.id]);
  });

  it('pin to closed session: falls through, mints fresh per-thread session', async () => {
    const { senderSession } = await seedPair();
    const closed = await seedPinnedSession('sess-closed');
    await getDb().run('UPDATE sessions SET status = ? WHERE id = ?', 'closed', closed.id);

    await routeAgentMessage(
      {
        id: 'out-pin-closed',
        platform_id: 'ag-recipient',
        thread_id: 'fallback',
        content: JSON.stringify({ text: 'x' }),
        target_session_id: closed.id,
      },
      senderSession,
    );

    const fresh = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ? AND status = ? AND thread_id = ?',
      'ag-recipient',
      'active',
      'fallback',
    );
    expect(fresh).toHaveLength(1);
    expect(fresh[0].id).not.toBe(closed.id);
  });

  it('pin to wrong agent group: falls through (different group not honored)', async () => {
    const { senderSession } = await seedPair();
    // Make a session under sender's own group — not under recipient.
    const wrongGroup: Session = {
      id: 'sess-wrong-group',
      agent_group_id: 'ag-sender',
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    await createSession(wrongGroup);

    await routeAgentMessage(
      {
        id: 'out-pin-wrong',
        platform_id: 'ag-recipient',
        thread_id: 'fallback-2',
        content: JSON.stringify({ text: 'x' }),
        target_session_id: wrongGroup.id,
      },
      senderSession,
    );

    const recipientSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    // Wrong-group pin ignored, fresh session minted under recipient
    expect(recipientSessions).toHaveLength(1);
    expect(recipientSessions[0].id).not.toBe(wrongGroup.id);
  });

  it('pin to non-existent session: falls through silently', async () => {
    const { senderSession } = await seedPair();

    await routeAgentMessage(
      {
        id: 'out-pin-missing',
        platform_id: 'ag-recipient',
        thread_id: 'fallback-3',
        content: JSON.stringify({ text: 'x' }),
        target_session_id: 'sess-does-not-exist',
      },
      senderSession,
    );

    const recipientSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    expect(recipientSessions).toHaveLength(1);
  });

  it('pin to self: rejected, falls through to fresh delegation', async () => {
    const { senderSession } = await seedPair();

    await routeAgentMessage(
      {
        id: 'out-pin-self',
        platform_id: 'ag-recipient',
        thread_id: 'fallback-4',
        content: JSON.stringify({ text: 'x' }),
        target_session_id: senderSession.id,
      },
      senderSession,
    );

    const recipientSessions = await getDb().all<{ id: string }>(
      'SELECT id FROM sessions WHERE agent_group_id = ?',
      'ag-recipient',
    );
    expect(recipientSessions).toHaveLength(1);
    expect(recipientSessions[0].id).not.toBe(senderSession.id);
  });

  it('pin without destination row: still throws unauthorized (auth not bypassed)', async () => {
    // Build the recipient + sender groups without a destination row.
    await createAgentGroup({
      id: 'ag-no-dest',
      name: 'NoDest',
      folder: 'no-dest',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    await createAgentGroup({
      id: 'ag-target-no-dest',
      name: 'TargetNoDest',
      folder: 'target-no-dest',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    const senderSession: Session = {
      id: 'sess-no-dest',
      agent_group_id: 'ag-no-dest',
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    await createSession(senderSession);
    initSessionFolder('ag-no-dest', senderSession.id);

    const pinnedTarget: Session = {
      id: 'sess-target-no-dest',
      agent_group_id: 'ag-target-no-dest',
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    };
    await createSession(pinnedTarget);
    initSessionFolder('ag-target-no-dest', pinnedTarget.id);

    await expect(
      routeAgentMessage(
        {
          id: 'out-pin-unauth',
          platform_id: 'ag-target-no-dest',
          thread_id: null,
          content: JSON.stringify({ text: 'x' }),
          target_session_id: pinnedTarget.id,
        },
        senderSession,
      ),
    ).rejects.toThrow(/unauthorized agent-to-agent/);
  });

  it('pin loses to in_reply_to: explicit reply target wins (Layer 1 over Layer 0)', async () => {
    // Set up: source has a prior inbound row whose source_session_id points
    // to a specific recipient session (the reply target). A pin to a
    // different session of the same recipient must NOT override the reply.
    const { senderSession } = await seedPair();
    const replyTarget = await seedPinnedSession('sess-reply-target');
    const wrongPin = await seedPinnedSession('sess-wrong-pin');

    // Seed an a2a inbound row in the sender's inbound DB whose
    // source_session_id is the reply target — this is what
    // resolveExplicitReplyTarget will look up via in_reply_to.
    const senderInDbPath = path.join(_tempDir, 'data', 'v2-sessions', 'ag-sender', senderSession.id, 'inbound.db');
    const Database = (await import('better-sqlite3')).default;
    const inDb = new Database(senderInDbPath);
    inDb
      .prepare(
        `INSERT INTO messages_in (id, seq, kind, timestamp, status, trigger, content, source_session_id)
         VALUES ('in-1', 1, 'chat', ?, 'pending', 1, '{"text":"hi"}', ?)`,
      )
      .run(now(), replyTarget.id);
    inDb.close();

    await routeAgentMessage(
      {
        id: 'out-pin-vs-reply',
        platform_id: 'ag-recipient',
        thread_id: null,
        content: JSON.stringify({ text: 'x' }),
        in_reply_to: 'in-1',
        target_session_id: wrongPin.id,
      },
      senderSession,
    );

    // Reply target should have received the message; pin target should not.
    // Both sessions still exist (we created them above), so we assert via
    // the inbound DB count for each.
    const Db2 = (await import('better-sqlite3')).default;
    const replyInDb = new Db2(path.join(_tempDir, 'data', 'v2-sessions', 'ag-recipient', replyTarget.id, 'inbound.db'));
    const replyCount = (replyInDb.prepare('SELECT COUNT(*) AS n FROM messages_in').get() as { n: number }).n;
    replyInDb.close();
    const pinInDb = new Db2(path.join(_tempDir, 'data', 'v2-sessions', 'ag-recipient', wrongPin.id, 'inbound.db'));
    const pinCount = (pinInDb.prepare('SELECT COUNT(*) AS n FROM messages_in').get() as { n: number }).n;
    pinInDb.close();

    expect(replyCount).toBe(1);
    expect(pinCount).toBe(0);
  });
});

// =============================================================
// forwardAttachedFiles — file-forwarding security guard.
// Restores coverage for the symlink/realpath guard in agent-route.ts
// (a confined agent must not exfiltrate host files by symlinking them
// into its outbox under a safe-looking name). forwardAttachedFiles is
// pure-FS, keyed on sessionDir(), so we exercise it directly.
// =============================================================
describe('forwardAttachedFiles — file-forwarding security guard', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await setupTempDb();
  });
  afterEach(async () => {
    await closeDb();
    process.chdir(realCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function makeOutbox(msgId: string): string {
    const dir = path.join(sessionDir('ag-src', 'sess-src'), 'outbox', msgId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  it('copies a real file from source outbox to target inbox (positive control)', () => {
    const outboxDir = makeOutbox('msg-real');
    fs.writeFileSync(path.join(outboxDir, 'report.pdf'), 'fake-pdf-bytes');

    const attachments = forwardAttachedFiles(
      { agentGroupId: 'ag-src', sessionId: 'sess-src', messageId: 'msg-real', filenames: ['report.pdf'] },
      { agentGroupId: 'ag-tgt', sessionId: 'sess-tgt', messageId: 'in-real' },
    );

    expect(attachments).toHaveLength(1);
    expect(attachments[0].name).toBe('report.pdf');
    expect(attachments[0].type).toBe('file');
    const targetPath = path.join(sessionDir('ag-tgt', 'sess-tgt'), attachments[0].localPath);
    expect(fs.existsSync(targetPath)).toBe(true);
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe('fake-pdf-bytes');
  });

  it('SECURITY: skips a symlinked source file — no host-file exfiltration', () => {
    const secretPath = path.join(tempDir, 'host-secret.txt');
    fs.writeFileSync(secretPath, 'host-secret-bytes');

    const outboxDir = makeOutbox('msg-symlink');
    fs.symlinkSync(secretPath, path.join(outboxDir, 'safe-name.txt'));

    const attachments = forwardAttachedFiles(
      { agentGroupId: 'ag-src', sessionId: 'sess-src', messageId: 'msg-symlink', filenames: ['safe-name.txt'] },
      { agentGroupId: 'ag-tgt', sessionId: 'sess-tgt', messageId: 'in-symlink' },
    );

    expect(attachments).toHaveLength(0);
    const leaked = path.join(sessionDir('ag-tgt', 'sess-tgt'), 'inbox', 'in-symlink', 'safe-name.txt');
    expect(fs.existsSync(leaked)).toBe(false);
  });

  it('SECURITY: skips a symlinked source outbox directory', () => {
    const realSecretDir = path.join(tempDir, 'secret-dir');
    fs.mkdirSync(realSecretDir, { recursive: true });
    fs.writeFileSync(path.join(realSecretDir, 'x.txt'), 'bytes');

    const outboxParent = path.join(sessionDir('ag-src', 'sess-src'), 'outbox');
    fs.mkdirSync(outboxParent, { recursive: true });
    fs.symlinkSync(realSecretDir, path.join(outboxParent, 'msg-dirlink'));

    const attachments = forwardAttachedFiles(
      { agentGroupId: 'ag-src', sessionId: 'sess-src', messageId: 'msg-dirlink', filenames: ['x.txt'] },
      { agentGroupId: 'ag-tgt', sessionId: 'sess-tgt', messageId: 'in-dirlink' },
    );
    expect(attachments).toHaveLength(0);
  });

  it('SECURITY (#2828): skips a symlinked TARGET inbox dir — writes nothing outside', () => {
    // A compromised recipient can write inside its own session dir; pre-placing
    // its whole `inbox` as a symlink must not redirect a forwarded attachment
    // outside the sandbox. ensureContainedInboxDir rejects the symlinked root.
    const canaryDir = path.join(tempDir, 'canary-outside-inbox');
    fs.mkdirSync(canaryDir, { recursive: true });

    const outboxDir = makeOutbox('msg-tgt-symlink');
    fs.writeFileSync(path.join(outboxDir, 'pwn.txt'), 'attacker-bytes');

    // Target pre-places its whole `inbox` as a symlink pointing outside.
    const targetSessDir = sessionDir('ag-tgt', 'sess-tgt');
    fs.mkdirSync(targetSessDir, { recursive: true });
    fs.symlinkSync(canaryDir, path.join(targetSessDir, 'inbox'));

    const attachments = forwardAttachedFiles(
      { agentGroupId: 'ag-src', sessionId: 'sess-src', messageId: 'msg-tgt-symlink', filenames: ['pwn.txt'] },
      { agentGroupId: 'ag-tgt', sessionId: 'sess-tgt', messageId: 'in-tgt-symlink' },
    );

    expect(attachments).toHaveLength(0);
    // Nothing written through the symlink to the canary location.
    expect(fs.readdirSync(canaryDir)).toHaveLength(0);
  });
});
