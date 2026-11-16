/**
 * What happens to a turn that is still in flight when its container goes away.
 *
 * A turn is in flight while the container holds a `processing` row in
 * processing_ack for its trigger; the trigger's messages_in row stays `pending`
 * until the runner acks it. These cases drive `reconcileSession` against real
 * session DBs, so they pin the whole path — the SLA kill, the requeue, and the
 * wake on the next pass — not only the helpers.
 *
 * The contract they pin:
 *   - A kill that blames the turn (absolute ceiling, claim-stuck) requeues the
 *     trigger through `resetStuckProcessingRows`: still `pending`, one more try,
 *     a short backoff, and `failed` once MAX_TRIES are spent. The next pass after
 *     the backoff wakes a fresh container.
 *   - A kill for an outside reason (CLAUDE.md refresh, operator restart) charges
 *     no try: the trigger is still due, so the next pass wakes a fresh container
 *     and the runner's startup cleanup lets it claim the trigger again.
 *   - An idle container (the turn already ended) has nothing to requeue.
 *   - Deliberate stops do not resume the work: a manual Stop closes the session,
 *     and a cost stop never claims the rows it holds back.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config.js', async () => {
  const os = await import('os');
  const path = await import('path');
  const fsMod = await import('fs');
  return {
    ...(await vi.importActual<typeof import('./config.js')>('./config.js')),
    // Built-in 30 min / 60 s timers, not whatever a developer's env sets.
    ABSOLUTE_CEILING_MS_RAW: '',
    CLAIM_STUCK_MS_RAW: '',
    DATA_DIR: fsMod.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-kill-requeue-')),
  };
});

const state = vi.hoisted(() => ({
  running: false,
  sessionStatus: 'active' as 'active' | 'closed',
  heartbeatMs: 0,
  incarnationStartMs: 0,
  claudeMdStale: false,
}));

vi.mock('./db/sessions.js', () => ({
  getSession: vi.fn(async (id: string) => ({
    id,
    agent_group_id: 'ag-1',
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: state.sessionStatus,
    container_status: state.running ? 'running' : 'stopped',
    last_active: null,
    created_at: '2026-11-16T00:00:00.000Z',
  })),
  isTaskThread: () => false,
  updateSession: vi.fn(),
}));
vi.mock('./db/agent-groups.js', () => ({ getAgentGroup: vi.fn(async () => ({ id: 'ag-1', folder: 'g' })) }));
vi.mock('./db/coordination.js', () => ({
  getSessionClaim: vi.fn(async () => ({
    session_id: 's-1',
    incarnation: 1,
    claimed_by: state.running ? 'host' : null,
    claimed_at: new Date(state.incarnationStartMs).toISOString(),
    container_ref: null,
    stop_intent: null,
    updated_at: new Date(state.incarnationStartMs).toISOString(),
  })),
}));
vi.mock('./db/a2a-session-sources.js', () => ({ getSourceFor: vi.fn(async () => undefined) }));
vi.mock('./drivers/index.js', () => ({ hostGpuPassthroughApplied: () => false }));
vi.mock('./gpu-probe-check.js', () => ({ checkGpuProbe: vi.fn() }));

vi.mock('./container-runner.js', () => ({
  claudeMdStaleForSession: vi.fn(async (sessionId: string) =>
    state.claudeMdStale ? { sessionId, agentGroupId: 'ag-1', folder: 'g' } : null,
  ),
  getContainerStartedAtMs: vi.fn(() => state.incarnationStartMs),
  isContainerRunning: vi.fn(() => state.running),
  // Fire-and-forget like the real one: the container is still registered when
  // the caller moves on. Each case flips `running` itself before the next pass.
  killContainer: vi.fn(),
  recomposeAndUpdateHash: vi.fn(async () => ({ kind: 'restart-ready', hash: 'h2' })),
}));

vi.mock('./request-wake.js', () => ({
  // A wake spawns a fresh incarnation: its claim time is now, which is what
  // fences the dead container's leftover claim and heartbeat out of the SLA check.
  requestWake: vi.fn(async () => {
    state.running = true;
    state.incarnationStartMs = Date.now();
    return true;
  }),
}));

// The session mailbox is the real SQLite one, over files under the mocked
// DATA_DIR; only the heartbeat and the host-written refresh note are stubbed.
vi.mock('./session-manager.js', async () => {
  const { SqliteAgentMailbox } = await import('./mailbox/sqlite/index.js');
  const sdb = await import('./mailbox/sqlite/session-db.js');
  const paths = await import('./mailbox/sqlite/paths.js');
  const store = new SqliteAgentMailbox();
  return {
    heartbeatMtimeMs: () => state.heartbeatMs,
    openInboundDb: (ag: string, sid: string) => sdb.openInboundDb(paths.inboundDbPath(ag, sid)),
    openOutboundDb: (ag: string, sid: string) => sdb.openOutboundDb(paths.outboundDbPath(ag, sid)),
    openOutboundDbRw: (ag: string, sid: string) => sdb.openOutboundDbWritable(paths.outboundDbPath(ag, sid)),
    withExistingMailboxSession: async <T>(
      agentGroupId: string,
      sessionId: string,
      fn: (mailbox: MailboxSession) => T | Promise<T>,
    ): Promise<T | undefined> =>
      (await store.exists({ agentGroupId, sessionId })) ? store.session({ agentGroupId, sessionId }, fn) : undefined,
    writeSessionMessage: vi.fn(),
  };
});

vi.mock('./modules/runaway/detect.js', () => ({ checkRunaway: vi.fn() }));
vi.mock('./modules/runaway/index.js', () => ({ runawayCardDeps: {} }));
vi.mock('./modules/critique-escalation/index.js', () => ({ checkCritiqueEscalation: vi.fn() }));
vi.mock('./modules/scheduling/recurrence.js', () => ({ handleRecurrence: vi.fn() }));
vi.mock('./modules/cross-session-context/index.js', () => ({ pruneEchoBacklog: vi.fn(() => 0) }));

import { DATA_DIR } from './config.js';
import { killContainer, recomposeAndUpdateHash } from './container-runner.js';
import { SqliteAgentMailbox } from './mailbox/sqlite/index.js';
import { inboundDbPath, outboundDbPath } from './mailbox/sqlite/paths.js';
import {
  ABSOLUTE_CEILING_MS,
  _resetMailboxGcForTesting,
  _resetQuietSessionsForTesting,
  reconcileSession,
} from './reconcile-session.js';
import { requestWake } from './request-wake.js';
import { writeSessionMessage } from './session-manager.js';
import type { MailboxSession } from './mailbox/types.js';

const SID = 's-1';
const AG = 'ag-1';
const MAX_TRIES = 5; // mirrors reconcile-session.ts

function db(side: 'inbound' | 'outbound'): Database.Database {
  return new Database(side === 'inbound' ? inboundDbPath(AG, SID) : outboundDbPath(AG, SID));
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Insert a pending trigger, and the processing_ack row the container wrote for it (if any). */
function seedTrigger(id: string, opts: { tries?: number; ack?: 'processing' | 'completed'; ackAtMs?: number } = {}) {
  const seq = 2 * (Number(id.replace(/\D/g, '')) || 1);
  const inb = db('inbound');
  inb
    .prepare(
      "INSERT INTO messages_in (id, seq, kind, timestamp, status, tries, trigger, content) VALUES (?, ?, 'chat', ?, 'pending', ?, 1, '{}')",
    )
    .run(id, seq, iso(Date.now() - 4 * 60 * 60_000), opts.tries ?? 0);
  inb.close();
  if (opts.ack) {
    const out = db('outbound');
    out
      .prepare('INSERT INTO processing_ack (message_id, status, status_changed) VALUES (?, ?, ?)')
      .run(id, opts.ack, iso(opts.ackAtMs ?? Date.now()));
    out.close();
  }
}

function trigger(id: string): { status: string; tries: number; process_after: string | null } {
  const inb = db('inbound');
  try {
    return inb.prepare('SELECT status, tries, process_after FROM messages_in WHERE id = ?').get(id) as {
      status: string;
      tries: number;
      process_after: string | null;
    };
  } finally {
    inb.close();
  }
}

function processingClaims(): string[] {
  const out = db('outbound');
  try {
    return (
      out.prepare("SELECT message_id FROM processing_ack WHERE status = 'processing'").all() as Array<{
        message_id: string;
      }>
    ).map((r) => r.message_id);
  } finally {
    out.close();
  }
}

/** The backoff a requeue set has run out — stands in for waiting it out on SQLite's clock. */
function elapseBackoff(id: string): void {
  const inb = db('inbound');
  inb.prepare('UPDATE messages_in SET process_after = ? WHERE id = ?').run(iso(Date.now() - 1000), id);
  inb.close();
}

/** A container that was spawned long ago and has been silent past the absolute ceiling. */
function containerPastCeiling(): void {
  state.running = true;
  state.incarnationStartMs = Date.now() - ABSOLUTE_CEILING_MS - 10 * 60_000;
  state.heartbeatMs = Date.now() - ABSOLUTE_CEILING_MS - 60_000;
}

/** A container that spawned a minute ago and is busy right now. */
function containerWorking(): void {
  state.running = true;
  state.incarnationStartMs = Date.now() - 60_000;
  state.heartbeatMs = Date.now();
}

beforeEach(() => {
  fs.rmSync(`${DATA_DIR}/v2-sessions`, { recursive: true, force: true });
  new SqliteAgentMailbox().prepare({ agentGroupId: AG, sessionId: SID });
  Object.assign(state, {
    running: false,
    sessionStatus: 'active',
    heartbeatMs: 0,
    incarnationStartMs: 0,
    claudeMdStale: false,
  });
  vi.mocked(killContainer).mockClear();
  vi.mocked(requestWake).mockClear();
  vi.mocked(recomposeAndUpdateHash).mockClear();
  vi.mocked(writeSessionMessage).mockClear();
  _resetQuietSessionsForTesting();
  // Keep the daily GC and the hourly reclaim out of these passes.
  _resetMailboxGcForTesting({ jitter: () => 0.5 });
});

afterEach(() => {
  fs.rmSync(`${DATA_DIR}/v2-sessions`, { recursive: true, force: true });
});

describe('absolute ceiling', () => {
  it('requeues an in-flight turn like claim-stuck does, and the next pass respawns it', async () => {
    containerPastCeiling();
    seedTrigger('m-1', { ack: 'processing', ackAtMs: Date.now() - ABSOLUTE_CEILING_MS - 5 * 60_000 });

    await reconcileSession(SID);

    expect(killContainer).toHaveBeenCalledWith(SID, 'absolute-ceiling');
    const requeued = trigger('m-1');
    expect(requeued.status).toBe('pending');
    expect(requeued.tries).toBe(1);
    // BACKOFF_BASE_MS * 2^0 = 5 s from now.
    const backoffMs = Date.parse(requeued.process_after!) - Date.now();
    expect(backoffMs).toBeGreaterThan(0);
    expect(backoffMs).toBeLessThanOrEqual(5000);
    // The orphan claim is gone, so the fresh container is not judged by it.
    expect(processingClaims()).toEqual([]);
    expect(requestWake).not.toHaveBeenCalled();

    // The container has exited; once the backoff has run out the pass wakes it.
    state.running = false;
    elapseBackoff('m-1');
    await reconcileSession(SID);

    expect(requestWake).toHaveBeenCalledTimes(1);
    expect(vi.mocked(requestWake).mock.calls[0][1]).toBe('due-message');
    expect(trigger('m-1').tries).toBe(1);
  });

  it('marks the trigger failed once MAX_TRIES are spent, and does not respawn for it', async () => {
    containerPastCeiling();
    seedTrigger('m-1', {
      tries: MAX_TRIES,
      ack: 'processing',
      ackAtMs: Date.now() - ABSOLUTE_CEILING_MS - 5 * 60_000,
    });

    await reconcileSession(SID);

    expect(killContainer).toHaveBeenCalledWith(SID, 'absolute-ceiling');
    expect(trigger('m-1')).toMatchObject({ status: 'failed', tries: MAX_TRIES });
    expect(processingClaims()).toEqual([]);

    state.running = false;
    await reconcileSession(SID);
    expect(requestWake).not.toHaveBeenCalled();
  });

  it('requeues nothing for an idle container whose turn already ended', async () => {
    // The turn ran and its trigger was acked; the container then sat idle until
    // the ceiling reaped it.
    containerPastCeiling();
    seedTrigger('m-1', { ack: 'completed', ackAtMs: Date.now() - ABSOLUTE_CEILING_MS - 5 * 60_000 });

    await reconcileSession(SID);

    expect(killContainer).toHaveBeenCalledWith(SID, 'absolute-ceiling');
    expect(trigger('m-1')).toMatchObject({ status: 'completed', tries: 0, process_after: null });

    state.running = false;
    await reconcileSession(SID);
    expect(requestWake).not.toHaveBeenCalled();
  });
});

describe('deliberate stops', () => {
  it('a manual Stop closes the session: the stopped turn is neither requeued nor resumed', async () => {
    // The runaway card's Stop marks the session closed and kills its container.
    state.sessionStatus = 'closed';
    seedTrigger('m-1', { ack: 'processing', ackAtMs: Date.now() - 10 * 60_000 });

    await reconcileSession(SID);

    expect(trigger('m-1')).toMatchObject({ status: 'pending', tries: 0, process_after: null });
    expect(processingClaims()).toEqual(['m-1']);
    expect(requestWake).not.toHaveBeenCalled();
    expect(killContainer).not.toHaveBeenCalled();
  });

  it('a cost stop never claims the rows it holds back, so reaping that container charges no try', async () => {
    // A cost-stopped runner leaves new triggers `pending` and unclaimed while it
    // waits for a human Continue/Stop, and is reaped at the ceiling as idle.
    containerPastCeiling();
    seedTrigger('m-1');

    await reconcileSession(SID);

    expect(killContainer).toHaveBeenCalledWith(SID, 'absolute-ceiling');
    expect(trigger('m-1')).toMatchObject({ status: 'pending', tries: 0, process_after: null });
  });
});

describe('kills for an outside reason', () => {
  it('replays an interrupted turn on the next pass without charging a try', async () => {
    // An operator restart or a crash took the container away mid-turn; the
    // trigger is still pending with the dead container's claim on it.
    seedTrigger('m-1', { ack: 'processing', ackAtMs: Date.now() - 10 * 60_000 });

    await reconcileSession(SID);

    expect(requestWake).toHaveBeenCalledTimes(1);
    expect(vi.mocked(requestWake).mock.calls[0][1]).toBe('due-message');
    // The fresh container's startup cleanup drops the stale claim and claims the
    // trigger again; the host leaves both alone.
    expect(trigger('m-1')).toMatchObject({ status: 'pending', tries: 0 });
  });

  it('a stale CLAUDE.md restarts the container mid-turn, queues the refresh note, and the turn is replayed', async () => {
    containerWorking();
    state.claudeMdStale = true;
    seedTrigger('m-1', { ack: 'processing', ackAtMs: Date.now() - 30_000 });

    await reconcileSession(SID);

    expect(recomposeAndUpdateHash).toHaveBeenCalledWith(SID);
    expect(killContainer).toHaveBeenCalledWith(SID, 'claude-md-stale');
    expect(writeSessionMessage).toHaveBeenCalledTimes(1);
    expect(trigger('m-1')).toMatchObject({ status: 'pending', tries: 0 });

    state.running = false;
    state.claudeMdStale = false;
    await reconcileSession(SID);
    expect(requestWake).toHaveBeenCalledTimes(1);
    expect(trigger('m-1')).toMatchObject({ status: 'pending', tries: 0 });
  });
});
