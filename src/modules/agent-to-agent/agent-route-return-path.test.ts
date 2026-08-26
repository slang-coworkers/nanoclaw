/**
 * a2a return-path routing.
 *
 * Split out of `agent-route.test.ts` rather than merged into it: this suite
 * needs `vi.mock('../../config.js')` to resolve DATA_DIR to ONE fixed path
 * (`readInbound` opens the session DB by absolute path), while that file mocks
 * the same module with lazy getters over a per-run `os.tmpdir()` directory.
 * A single file cannot hold both shapes of the same mock, and per-run
 * isolation there is worth keeping — so the two live side by side.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { ensureA2aWiring, forwardAttachedFiles, routeAgentMessage } from './agent-route.js';
import { log } from '../../log.js';
import { createDestination } from './db/agent-destinations.js';
import { getDb } from '../../db/connection.js';
import { initTestDb, closeDb, runMigrations, createAgentGroup } from '../../db/index.js';
import { createSession, updateSession } from '../../db/sessions.js';
import { inboundDbPath } from '../../mailbox/sqlite/paths.js';
import { initSessionFolder, resolveSession, sessionDir, writeSessionMessage } from '../../session-manager.js';
import type { Session } from '../../types.js';

vi.mock('../../container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
}));

vi.mock('../../config.js', async () => {
  const actual = await vi.importActual('../../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-a2a-route' };
});

const TEST_DIR = '/tmp/nanoclaw-test-a2a-route';

function now(): string {
  return new Date().toISOString();
}

/**
 * The recipient session a FRESH a2a send lands in (Layer 3 of the fork's
 * layered routing): `ensureA2aWiring(target, source)` mints a per-(source,
 * target) messaging group, and the session is keyed on that mg plus the thread
 * the sender inherits. Upstream delivered a fresh peer send into an arbitrary
 * pre-existing session of the target, so its fixtures could assert against a
 * hand-seeded `sess-B`; the fork mints one session per sender so two sources
 * delegating into the same recipient never share context — which means a test
 * has to ASK routing which session that is rather than assume one.
 *
 * Both calls are idempotent, so this returns the exact session
 * `routeAgentMessage` delivered into whether called before or after it. Mirrors
 * `deliveredSessionId` in message-gate.test.ts, but threads the sender's
 * `thread_id` through because these fixtures use threaded A-side sessions
 * (performAgentRoute inherits `session.thread_id` when the msg carries none).
 */
async function a2aTargetSession(targetAgentGroupId: string, sender: Session): Promise<Session> {
  const threadId = sender.thread_id;
  const mgId = await ensureA2aWiring(targetAgentGroupId, sender.agent_group_id);
  const { session } = await resolveSession(targetAgentGroupId, mgId, threadId, threadId ? 'per-thread' : 'shared');
  return session;
}

function readInbound(agentGroupId: string, sessionId: string) {
  const db = new Database(inboundDbPath(agentGroupId, sessionId), { readonly: true });
  const rows = db
    .prepare('SELECT id, platform_id, channel_type, content, source_session_id FROM messages_in ORDER BY seq')
    .all() as Array<{
    id: string;
    platform_id: string | null;
    channel_type: string | null;
    content: string;
    source_session_id: string | null;
  }>;
  db.close();
  return rows;
}

describe('routeAgentMessage return-path', () => {
  const A = 'ag-A';
  const B = 'ag-B';
  let S1: Session;
  let S2: Session;
  let SB: Session;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });

    const db = await initTestDb();
    await runMigrations(db);

    await createAgentGroup({ id: A, name: 'A', folder: 'a', agent_provider: null, created_at: now() });
    await createAgentGroup({ id: B, name: 'B', folder: 'b', agent_provider: null, created_at: now() });

    // S1 (older), S2 (newer) — both active sessions on A.
    S1 = {
      id: 'sess-A-old',
      agent_group_id: A,
      messaging_group_id: null,
      thread_id: 'test:old',
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    S2 = {
      id: 'sess-A-new',
      agent_group_id: A,
      messaging_group_id: null,
      thread_id: 'test:new',
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: '2026-02-01T00:00:00.000Z',
    };
    SB = {
      id: 'sess-B',
      agent_group_id: B,
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: '2026-01-15T00:00:00.000Z',
    };
    await createSession(S1);
    await createSession(S2);
    await createSession(SB);
    initSessionFolder(A, S1.id);
    initSessionFolder(A, S2.id);
    initSessionFolder(B, SB.id);

    await createDestination({
      agent_group_id: A,
      local_name: 'b',
      target_type: 'agent',
      target_id: B,
      created_at: now(),
    });
    await createDestination({
      agent_group_id: B,
      local_name: 'a',
      target_type: 'agent',
      target_id: A,
      created_at: now(),
    });
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  it('forward direction: stamps source_session_id on the target inbound row', async () => {
    // A.S1 emits an outbound a2a to B.
    await routeAgentMessage(
      {
        id: 'msg-from-A-S1',
        platform_id: B,
        content: JSON.stringify({ text: 'hello B' }),
        in_reply_to: null,
      },
      S1,
    );

    // Not SB: a fresh send mints its own per-(source, thread) recipient session,
    // so the pre-seeded sess-B never sees it (see a2aTargetSession).
    const B1 = await a2aTargetSession(B, S1);
    const bRows = readInbound(B, B1.id);
    expect(bRows).toHaveLength(1);
    expect(bRows[0].platform_id).toBe(A);
    expect(bRows[0].source_session_id).toBe(S1.id); // <- the return address
  });

  it('reply direction: routes back to the originating session, not the newest', async () => {
    // A.S1 sends to B.
    await routeAgentMessage(
      {
        id: 'msg-from-A-S1',
        platform_id: B,
        content: JSON.stringify({ text: 'ping' }),
        in_reply_to: null,
      },
      S1,
    );

    // Capture the synthetic id the host stamped on B's inbound — that's what
    // B's container would reference as `in_reply_to` when replying.
    const B1 = await a2aTargetSession(B, S1);
    const bRows = readInbound(B, B1.id);
    const yId = bRows[0]!.id;

    // The reply must be emitted BY the session that received the forward, not
    // by the unrelated pre-seeded sess-B: resolveExplicitReplyTarget reads
    // `source_session_id` out of the *sender's own* inbound DB, and only B1
    // holds that row. Replying as sess-B would look like a fresh send.
    await routeAgentMessage(
      {
        id: 'msg-from-B',
        platform_id: A,
        content: JSON.stringify({ text: 'pong' }),
        in_reply_to: yId,
      },
      B1,
    );

    const s1Rows = readInbound(A, S1.id);
    const s2Rows = readInbound(A, S2.id);

    // The reply lands in S1 (originator) even though S2 is newer.
    expect(s1Rows).toHaveLength(1);
    expect(s1Rows[0].platform_id).toBe(B);
    expect(JSON.parse(s1Rows[0].content).text).toBe('pong');
    expect(s2Rows).toHaveLength(0);
  });

  it('fallback: a2a with no in_reply_to mints a per-source session, touching neither existing one', async () => {
    // No prior conversation. B initiates an a2a to A out of the blue.
    await routeAgentMessage(
      {
        id: 'msg-from-B-fresh',
        platform_id: A,
        content: JSON.stringify({ text: 'unsolicited' }),
        in_reply_to: null,
      },
      SB,
    );

    // Upstream's fallback was "newest active session of the target wins", so it
    // expected S2. The fork has no such heuristic: with nothing in the sender's
    // inbound DB to key peer-affinity on and no lineage row, Layer 3 mints a
    // session for the (B→A) pair. That is the stronger property — an
    // unsolicited peer cannot inject into a conversation it was never part of —
    // so BOTH pre-existing sessions must stay empty.
    const s1Rows = readInbound(A, S1.id);
    const s2Rows = readInbound(A, S2.id);
    expect(s1Rows).toHaveLength(0);
    expect(s2Rows).toHaveLength(0);

    const fresh = await a2aTargetSession(A, SB);
    expect(fresh.id).not.toBe(S1.id);
    expect(fresh.id).not.toBe(S2.id);
    const freshRows = readInbound(A, fresh.id);
    expect(freshRows).toHaveLength(1);
    expect(JSON.parse(freshRows[0]!.content).text).toBe('unsolicited');
  });

  it('peer-affinity fallback: with no in_reply_to, routes to most recent peer-source session', async () => {
    // A.S1 sends to B (establishing affinity: B's last contact from A was via S1).
    await routeAgentMessage(
      {
        id: 'msg-from-A-S1-pre',
        platform_id: B,
        content: JSON.stringify({ text: 'context-establishing' }),
        in_reply_to: null,
      },
      S1,
    );

    // B sends a follow-up but its container forgot to set in_reply_to (e.g.
    // emitted via an MCP tool path that doesn't thread the batch's in_reply_to
    // through). The host should still route this to S1 because S1 is the
    // session most recently in conversation with B — not the chronologically
    // newest session of A.
    //
    // Emitted from the session that actually received the forward: peer-affinity
    // scans the SENDER's inbound DB for the most recent a2a row from A, and only
    // that session holds one.
    const B1 = await a2aTargetSession(B, S1);
    await routeAgentMessage(
      {
        id: 'msg-from-B-followup',
        platform_id: A,
        content: JSON.stringify({ text: 'standing by' }),
        in_reply_to: null,
      },
      B1,
    );

    const s1Rows = readInbound(A, S1.id);
    const s2Rows = readInbound(A, S2.id);
    // Affinity wins: reply to S1, not the newer S2.
    expect(s1Rows).toHaveLength(1);
    expect(JSON.parse(s1Rows[0]!.content).text).toBe('standing by');
    expect(s2Rows).toHaveLength(0);
  });

  it('stale origin: closed origin session drops the reply rather than rerouting it', async () => {
    // A.S1 sends to B, establishing source_session_id = S1.id on B's inbound.
    await routeAgentMessage(
      { id: 'msg-fwd', platform_id: B, content: JSON.stringify({ text: 'hello' }), in_reply_to: null },
      S1,
    );
    const B1 = await a2aTargetSession(B, S1);
    const bRows = readInbound(B, B1.id);
    const inboundId = bRows[0]!.id;

    // Close S1 — simulates session cleanup or channel disconnect.
    await updateSession(S1.id, { status: 'closed' });

    // B replies. origin points to S1 (closed).
    await routeAgentMessage(
      { id: 'msg-reply-stale', platform_id: A, content: JSON.stringify({ text: 'reply' }), in_reply_to: inboundId },
      B1,
    );

    // Upstream fell through to "newest active session of A" (S2). The fork fails
    // CLOSED instead: the explicit-reply resolver rejects the non-active origin,
    // and the Layer-2 ancestor walk — which finds the same S1 via
    // a2a_session_sources — refuses to write or wake a non-active ancestor
    // (deliverAncestorReply's status guard). Resurrecting a conversation the
    // operator ended, or dumping its reply into an unrelated live session, are
    // both worse than dropping with an audit log. So NOTHING is delivered
    // anywhere in A — a strictly tighter guarantee than upstream's reroute.
    expect(readInbound(A, S1.id)).toHaveLength(0);
    expect(readInbound(A, S2.id)).toHaveLength(0);
    const aSessions = await getDb().all<{ id: string }>('SELECT id FROM sessions WHERE agent_group_id = ?', A);
    expect(aSessions.map((s) => s.id).sort()).toEqual([S1.id, S2.id].sort());
  });

  it('cross-agent-group guard: origin session belonging to wrong agent group is rejected', async () => {
    // Third agent group C sends to B, stamping source_session_id = SC on B's inbound.
    const C = 'ag-C';
    await createAgentGroup({ id: C, name: 'C', folder: 'c', agent_provider: null, created_at: now() });
    const SC: Session = {
      id: 'sess-C',
      agent_group_id: C,
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: '2026-03-01T00:00:00.000Z',
    };
    await createSession(SC);
    initSessionFolder(C, SC.id);
    await createDestination({
      agent_group_id: C,
      local_name: 'b',
      target_type: 'agent',
      target_id: B,
      created_at: now(),
    });

    await routeAgentMessage(
      { id: 'msg-from-C', platform_id: B, content: JSON.stringify({ text: 'from C' }), in_reply_to: null },
      SC,
    );
    // C's delegation minted its own B-side session (per-source isolation), which
    // is the only place the C-originated row exists — and therefore the only
    // session that can reference it as in_reply_to.
    const BfromC = await a2aTargetSession(B, SC);
    const bRows = readInbound(B, BfromC.id);
    const cInboundId = bRows.find((r) => r.platform_id === C)!.id;

    // B replies to A, but in_reply_to references the C-originated row.
    // Guard rejects (SC belongs to C, not A) → the reply must NOT land in SC.
    await routeAgentMessage(
      {
        id: 'msg-reply-tamper',
        platform_id: A,
        content: JSON.stringify({ text: 'misdirected' }),
        in_reply_to: cInboundId,
      },
      BfromC,
    );

    // The guard held: the C-owned origin was rejected, so nothing was
    // misdirected into C's session.
    expect(readInbound(C, SC.id)).toHaveLength(0);

    // Upstream then expected the fallthrough to land in A's newest session (S2).
    // The fork has no newest-session heuristic — the rejected origin falls
    // through to Layer 3, which mints a fresh (B→A) session. What still must
    // hold, and is the point of the test, is that the tampered reference never
    // steered delivery: neither pre-existing A session receives it.
    expect(readInbound(A, S1.id)).toHaveLength(0);
    expect(readInbound(A, S2.id)).toHaveLength(0);
    const fresh = await a2aTargetSession(A, BfromC);
    expect([S1.id, S2.id, SC.id]).not.toContain(fresh.id);
    const freshRows = readInbound(A, fresh.id);
    expect(freshRows).toHaveLength(1);
    expect(JSON.parse(freshRows[0]!.content).text).toBe('misdirected');
  });

  it('in_reply_to referencing a non-a2a row resolves no origin and routes fresh', async () => {
    // Write a channel message into B's inbound (no source_session_id).
    await writeSessionMessage(B, SB.id, {
      id: 'channel-msg-1',
      kind: 'chat',
      timestamp: now(),
      platformId: 'user-123',
      channelType: 'slack',
      threadId: null,
      content: 'hello from slack',
    });

    // B replies to A with in_reply_to pointing to the channel message.
    // source_session_id is null → peer-affinity finds nothing either (SB has no
    // prior a2a inbound from A), so no origin resolves. Upstream then picked A's
    // newest session; the fork mints a per-source session instead. The invariant
    // under test is unchanged: a channel row carries no return address, so it
    // must not steer the reply into an unrelated A session.
    await routeAgentMessage(
      {
        id: 'msg-reply-channel',
        platform_id: A,
        content: JSON.stringify({ text: 'response' }),
        in_reply_to: 'channel-msg-1',
      },
      SB,
    );

    expect(readInbound(A, S1.id)).toHaveLength(0);
    expect(readInbound(A, S2.id)).toHaveLength(0);
    const fresh = await a2aTargetSession(A, SB);
    expect([S1.id, S2.id]).not.toContain(fresh.id);
    expect(readInbound(A, fresh.id)).toHaveLength(1);
  });

  it('self-message is allowed without a destination row', async () => {
    // A targets itself — no agent_destinations row exists for A→A.
    await routeAgentMessage(
      { id: 'self-msg', platform_id: A, content: JSON.stringify({ text: 'self-note' }), in_reply_to: null },
      S1,
    );

    // Upstream landed this in S2 via a newest-session fallback. The fork routes
    // A→A through the same per-source Layer-3 mint as any other pair, so the
    // note lands in the (A→A) session — NOT back in the emitter S1, which the
    // main-route self-target guard would have dropped. The authorization point
    // stands: the guard's self-send ALLOW let it through with no destination row.
    const selfSession = await a2aTargetSession(A, S1);
    expect(selfSession.id).not.toBe(S1.id);
    const selfRows = readInbound(A, selfSession.id);
    expect(selfRows).toHaveLength(1);
    expect(JSON.parse(selfRows[0]!.content).text).toBe('self-note');
  });

  it('BUG: no volume cap on a2a routing — unbounded ping-pong is allowed (#2063)', async () => {
    // Two agents can exchange unlimited messages with no rate limit or loop
    // detection. This test documents the gap — it should FAIL once #2063 lands.
    //
    // The B side of the exchange is the per-source session A.S1's pings land in,
    // resolved up front so each pong is emitted by the session that actually
    // holds the conversation (pongs then route home by peer-affinity). Texts are
    // distinct per iteration so echo-drop's loop detector — which suppresses the
    // *wake*, not the row — never fires and every message is genuinely routed.
    const B1 = await a2aTargetSession(B, S1);
    const errors: string[] = [];
    for (let i = 0; i < 20; i++) {
      try {
        await routeAgentMessage(
          { id: `ping-${i}`, platform_id: B, content: JSON.stringify({ text: `ping ${i}` }), in_reply_to: null },
          S1,
        );
        await routeAgentMessage(
          { id: `pong-${i}`, platform_id: A, content: JSON.stringify({ text: `pong ${i}` }), in_reply_to: null },
          B1,
        );
      } catch (e) {
        errors.push((e as Error).message);
        break;
      }
    }
    // BUG: all 40 messages go through — no cap, no throttle.
    // Once loop prevention lands, this should throw or reject after a threshold.
    const bRows = readInbound(B, B1.id);
    const s1Rows = readInbound(A, S1.id);
    const s2Rows = readInbound(A, S2.id);
    expect(errors).toHaveLength(0);
    expect(bRows).toHaveLength(20);
    expect(s1Rows.length + s2Rows.length).toBe(20);
  });

  it('file forwarding: copies bytes from source outbox to target inbox', async () => {
    // Place a file in S1's outbox for the message.
    const outboxDir = path.join(sessionDir(A, S1.id), 'outbox', 'msg-with-file');
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.writeFileSync(path.join(outboxDir, 'report.pdf'), 'fake-pdf-bytes');

    await routeAgentMessage(
      {
        id: 'msg-with-file',
        platform_id: B,
        content: JSON.stringify({ text: 'see attached', files: ['report.pdf'] }),
        in_reply_to: null,
      },
      S1,
    );

    // Bytes follow the message, so they land in the minted per-source session's
    // inbox — not the pre-seeded sess-B's.
    const B1 = await a2aTargetSession(B, S1);
    const bRows = readInbound(B, B1.id);
    expect(bRows).toHaveLength(1);
    const parsed = JSON.parse(bRows[0]!.content);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].name).toBe('report.pdf');
    expect(parsed.attachments[0].type).toBe('file');

    // Verify actual file bytes were copied to the target inbox.
    const targetPath = path.join(sessionDir(B, B1.id), parsed.attachments[0].localPath);
    expect(fs.existsSync(targetPath)).toBe(true);
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe('fake-pdf-bytes');
  });

  it('file forwarding: skips symlinked source files', async () => {
    const secretPath = path.join(TEST_DIR, 'host-secret.txt');
    fs.writeFileSync(secretPath, 'host-secret-bytes');

    const outboxDir = path.join(sessionDir(A, S1.id), 'outbox', 'msg-with-symlink');
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.symlinkSync(secretPath, path.join(outboxDir, 'safe-name.txt'));

    await routeAgentMessage(
      {
        id: 'msg-with-symlink',
        platform_id: B,
        content: JSON.stringify({ text: 'see attached', files: ['safe-name.txt'] }),
        in_reply_to: null,
      },
      S1,
    );

    const B1 = await a2aTargetSession(B, S1);
    const bRows = readInbound(B, B1.id);
    expect(bRows).toHaveLength(1);
    const parsed = JSON.parse(bRows[0]!.content);
    expect(parsed.attachments).toHaveLength(0);
  });

  // #2828 — target-side symlink containment. A compromised target agent can
  // write inside its own session dir; these tests prove it cannot redirect a
  // forwarded attachment outside the session sandbox via a pre-placed symlink.

  it('file forwarding (#2828): skips a symlinked target inbox dir, writes nothing outside', async () => {
    const warnSpy = vi.spyOn(log, 'warn');
    const canaryDir = path.join(TEST_DIR, 'canary-outside-inbox');
    fs.mkdirSync(canaryDir, { recursive: true });

    // Source has a real attachment to forward.
    const outboxDir = path.join(sessionDir(A, S1.id), 'outbox', 'msg-evil-inbox');
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.writeFileSync(path.join(outboxDir, 'pwn.txt'), 'attacker-bytes');

    // Mint the recipient session BEFORE routing so the symlink can be planted at
    // the inbox the forward will actually target. Idempotent, so the subsequent
    // route resolves this same session rather than a second one.
    const B1 = await a2aTargetSession(B, S1);

    // Target pre-places its whole `inbox` as a symlink pointing outside.
    const targetInbox = path.join(sessionDir(B, B1.id), 'inbox');
    fs.rmSync(targetInbox, { recursive: true, force: true });
    fs.symlinkSync(canaryDir, targetInbox);

    await routeAgentMessage(
      {
        id: 'msg-evil-inbox',
        platform_id: B,
        content: JSON.stringify({ text: 'see attached', files: ['pwn.txt'] }),
        in_reply_to: null,
      },
      S1,
    );

    // Message still routes — just with no attachments.
    const bRows = readInbound(B, B1.id);
    expect(bRows).toHaveLength(1);
    expect(JSON.parse(bRows[0]!.content).attachments).toHaveLength(0);

    // Nothing was written through the symlink to the canary location.
    expect(fs.readdirSync(canaryDir)).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('file forwarding (#2828): skips a symlinked inbox/<msgId> subdir, writes nothing outside', async () => {
    const warnSpy = vi.spyOn(log, 'warn');
    const canaryDir = path.join(TEST_DIR, 'canary-outside-subdir');
    fs.mkdirSync(canaryDir, { recursive: true });

    const outboxDir = path.join(sessionDir(A, S1.id), 'outbox', 'msg-evil-subdir');
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.writeFileSync(path.join(outboxDir, 'pwn.txt'), 'attacker-bytes');

    // The forwarded a2a msg id generated inside routeAgentMessage is random, so
    // a symlink can't be pre-placed at inbox/<that-id>. Drive forwardAttachedFiles
    // directly with a fixed target message id and plant the symlink at that path.
    const targetMsgId = 'evil-subdir-msg';
    const realInbox = path.join(sessionDir(B, SB.id), 'inbox');
    fs.mkdirSync(realInbox, { recursive: true });
    fs.symlinkSync(canaryDir, path.join(realInbox, targetMsgId));

    const attachments = forwardAttachedFiles(
      { agentGroupId: A, sessionId: S1.id, messageId: 'msg-evil-subdir', filenames: ['pwn.txt'] },
      { agentGroupId: B, sessionId: SB.id, messageId: targetMsgId },
    );

    expect(attachments).toHaveLength(0);
    expect(fs.readdirSync(canaryDir)).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('file forwarding (#2828): refuses a pre-existing symlinked dst file (COPYFILE_EXCL)', async () => {
    const warnSpy = vi.spyOn(log, 'warn');
    const canaryFile = path.join(TEST_DIR, 'canary-dst-target.txt');
    fs.writeFileSync(canaryFile, 'original-canary');

    const outboxDir = path.join(sessionDir(A, S1.id), 'outbox', 'msg-evil-dst');
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.writeFileSync(path.join(outboxDir, 'doc.txt'), 'attacker-bytes');

    // inbox/<msgId>/ is a real dir, but contains a pre-placed symlink named
    // exactly like the incoming attachment, pointing at the canary file.
    // We can only do this once we know the a2a msg id, which is generated
    // inside routeAgentMessage. So we instead drive forwardAttachedFiles
    // directly with a fixed target message id.
    const targetMsgId = 'fixed-evil-dst';
    const realInboxSubdir = path.join(sessionDir(B, SB.id), 'inbox', targetMsgId);
    fs.mkdirSync(realInboxSubdir, { recursive: true });
    fs.symlinkSync(canaryFile, path.join(realInboxSubdir, 'doc.txt'));

    const attachments = forwardAttachedFiles(
      { agentGroupId: A, sessionId: S1.id, messageId: 'msg-evil-dst', filenames: ['doc.txt'] },
      { agentGroupId: B, sessionId: SB.id, messageId: targetMsgId },
    );

    // The exclusive write failed → nothing forwarded.
    expect(attachments).toHaveLength(0);
    // Canary file untouched (symlink not followed/overwritten).
    expect(fs.readFileSync(canaryFile, 'utf-8')).toBe('original-canary');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('file forwarding (#2828 regression): a normal forward still works end-to-end', async () => {
    const outboxDir = path.join(sessionDir(A, S1.id), 'outbox', 'msg-ok-file');
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.writeFileSync(path.join(outboxDir, 'ok.txt'), 'legit-bytes');

    await routeAgentMessage(
      {
        id: 'msg-ok-file',
        platform_id: B,
        content: JSON.stringify({ text: 'see attached', files: ['ok.txt'] }),
        in_reply_to: null,
      },
      S1,
    );

    const B1 = await a2aTargetSession(B, S1);
    const bRows = readInbound(B, B1.id);
    expect(bRows).toHaveLength(1);
    const parsed = JSON.parse(bRows[0]!.content);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].name).toBe('ok.txt');
    const targetPath = path.join(sessionDir(B, B1.id), parsed.attachments[0].localPath);
    expect(fs.existsSync(targetPath)).toBe(true);
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe('legit-bytes');
  });
});
