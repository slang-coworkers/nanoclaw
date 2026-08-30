// Tests for src/modules/critique-escalation/ — the host side of critique-gate
// enforcement.
//
// The contract these lock down:
//   - stale/missing escalations SELF-HEAL (nudge the agent, no human card)
//   - a failed critique (must-fix) cards a human immediately
//   - self-heal exhaustion escalates to a human rather than opening the gate
//   - a card is auto-retracted once the requirement is satisfied
//   - an admin approval is ONE-SHOT + TTL'd, a rejection is request-scoped
//   - a container-side fail-open is ingested and recorded exactly once
//
// The approvals module, session-manager and the DB layer are mocked: these
// tests exercise the escalation-file → decision flow, not delivery plumbing.
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from './types.js';

const requestApprovalMock = vi.fn().mockResolvedValue(undefined);
const notifyAgentMock = vi.fn();
type ApprovalHandler = (ctx: {
  session: Session;
  payload: Record<string, unknown>;
  userId: string;
  notify: (t: string) => Promise<void>;
}) => Promise<void>;
type ResolvedHandler = (event: {
  approval: { action: string };
  session: Session;
  outcome: 'approve' | 'reject';
  userId: string;
}) => Promise<void>;
let approvalHandler: ApprovalHandler | undefined;
let resolvedHandler: ResolvedHandler | undefined;

vi.mock('./modules/approvals/index.js', () => ({
  requestApproval: (...args: unknown[]) => requestApprovalMock(...args),
  registerApprovalHandler: (_action: string, h: ApprovalHandler) => {
    approvalHandler = h;
  },
  registerApprovalResolvedHandler: (h: ResolvedHandler) => {
    resolvedHandler = h;
  },
  notifyAgent: (...args: unknown[]) => notifyAgentMock(...args),
}));

// sessionDir walks DATA_DIR (cwd-derived); mock it so nothing touches ./data.
vi.mock('./session-manager.js', () => ({
  sessionDir: (agentGroupId: string, sessionId: string) => path.join(os.tmpdir(), 'unused', agentGroupId, sessionId),
}));

const recordEventMock = vi.fn();
let prForSession: { repo: string; pr_number: number } | null = null;

/** In-memory stand-in for critique_bypass_grants — the host's own ledger. */
interface Grant {
  grant_id: string;
  session_id: string;
  requested_at: number | null;
  granted_at: string;
  expires_at: string;
  granted_by: string | null;
  consumed_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  release_recorded_at: string | null;
}
const ledger = new Map<string, Grant>();
let createGrantThrows = false;
/**
 * Stand-in for the unique dedupe index. `recordEscalationEvent` returns what
 * happened to the append, and the module surfaces anything that is not
 * 'recorded' / 'duplicate'.
 */
const recordedKeys = new Set<string>();
/** Events that actually became rows — i.e. attempts minus deduped replays. */
const insertedEvents: Array<Record<string, unknown>> = [];

vi.mock('./db/critique-escalations.js', () => ({
  recordEscalationEvent: (e: Record<string, unknown>) => {
    recordEventMock(e);
    const key = e.dedupe_key;
    if (typeof key === 'string' && key.length > 0) {
      if (recordedKeys.has(key)) return 'duplicate';
      recordedKeys.add(key);
    }
    insertedEvents.push(e);
    return 'recorded';
  },
  lookupPrForSession: () => prForSession,
  createBypassGrant: (g: Omit<Grant, 'consumed_at' | 'revoked_at' | 'revoked_reason' | 'release_recorded_at'>) => {
    if (createGrantThrows) throw new Error('ledger unavailable');
    ledger.set(g.grant_id, {
      ...g,
      consumed_at: null,
      revoked_at: null,
      revoked_reason: null,
      release_recorded_at: null,
    });
  },
  getBypassGrant: (id: string) => ledger.get(id) ?? null,
  getLatestSpendableGrant: (sessionId: string, nowIso: string) =>
    [...ledger.values()]
      .filter(
        (g) =>
          g.session_id === sessionId &&
          !g.consumed_at &&
          !g.revoked_at &&
          Date.parse(g.expires_at) > Date.parse(nowIso),
      )
      .sort((a, b) => Date.parse(b.granted_at) - Date.parse(a.granted_at))[0] ?? null,
  markBypassGrantConsumed: (id: string, iso: string) => {
    const g = ledger.get(id);
    if (g && !g.consumed_at) g.consumed_at = iso;
  },
  markBypassGrantReleaseRecorded: (id: string, iso: string) => {
    const g = ledger.get(id);
    if (g && !g.release_recorded_at) g.release_recorded_at = iso;
  },
  revokeBypassGrant: (id: string, iso: string, reason: string) => {
    const g = ledger.get(id);
    if (g && !g.revoked_at) {
      g.revoked_at = iso;
      g.revoked_reason = reason;
    }
  },
}));

const deleteApprovalMock = vi.fn();
let pendingApprovals: Array<{ approval_id: string; session_id: string; status: string }> = [];
vi.mock('./db/sessions.js', () => ({
  getPendingApprovalsByAction: () => pendingApprovals,
  deletePendingApproval: (...args: unknown[]) => deleteApprovalMock(...args),
}));

const {
  checkCritiqueEscalation,
  applyBypassApproval,
  applyBypassRejection,
  isRequirementCleared,
  reconcileBypassState,
} = await import('./modules/critique-escalation/index.js');

const session = { id: 'sess-esc-test', agent_group_id: 'ag-esc-test', thread_id: null } as unknown as Session;

const REASON_MISSING = 'missing critique stages: OUTPUT_REVIEW';
const REASON_STALE =
  '13 edit(s) recorded since the last critique round — the OUTPUT_REVIEW approve no longer covers the current state. Re-run /codex-critique with STAGE: OUTPUT_REVIEW';
const REASON_FAILED =
  'OUTPUT_REVIEW last verdict is "must-fix" (must be "approve"). Re-run /codex-critique with STAGE: OUTPUT_REVIEW after fixing the issues';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'critique-esc-test-'));
  requestApprovalMock.mockClear();
  notifyAgentMock.mockClear();
  recordEventMock.mockClear();
  deleteApprovalMock.mockClear();
  pendingApprovals = [];
  prForSession = null;
  ledger.clear();
  recordedKeys.clear();
  insertedEvents.length = 0;
  createGrantThrows = false;
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeEscalation(content: Record<string, unknown>): void {
  fs.writeFileSync(path.join(dir, 'critique-escalation.json'), JSON.stringify(content));
}
function readEscalation(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(dir, 'critique-escalation.json'), 'utf-8')) as Record<string, unknown>;
}
function writeState(content: Record<string, unknown>): void {
  fs.writeFileSync(path.join(dir, 'workflow-state.json'), JSON.stringify(content));
}
function readState(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(dir, 'workflow-state.json'), 'utf-8')) as Record<string, unknown>;
}
function eventKinds(): string[] {
  return recordEventMock.mock.calls.map((c) => (c[0] as { event: string }).event);
}

describe('checkCritiqueEscalation — self-heal path', () => {
  it('does nothing when no escalation file exists', async () => {
    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).not.toHaveBeenCalled();
    expect(notifyAgentMock).not.toHaveBeenCalled();
  });

  it('self-heals a MISSING-stages escalation instead of carding a human', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_MISSING, hit: 'PR creation' });
    await checkCritiqueEscalation(session, dir);

    expect(requestApprovalMock).not.toHaveBeenCalled();
    expect(notifyAgentMock).toHaveBeenCalledTimes(1);
    const directive = String(notifyAgentMock.mock.calls[0][1]);
    expect(directive).toContain('/codex-critique');
    expect(directive).toContain('OUTPUT_REVIEW');
    expect(directive).toContain('PR creation');
    // The agent must not be taught that waiting works — it used to.
    expect(directive).toContain('will NOT open on its own');

    const esc = readEscalation();
    expect(esc.self_heal_attempts).toBe(1);
    expect(esc.class).toBe('missing');
    expect(esc.forwarded_at).toBeUndefined();
    expect(eventKinds()).toEqual(['self_heal']);
  });

  it('self-heals a STALE escalation too', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_STALE, hit: 'PR creation' });
    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).not.toHaveBeenCalled();
    expect(readEscalation().class).toBe('stale');
  });

  it('does not re-nudge inside the cooldown window', async () => {
    writeEscalation({
      requested_at: 123,
      reason: REASON_MISSING,
      hit: 'PR creation',
      self_heal_attempts: 1,
      self_heal_at: new Date().toISOString(),
    });
    await checkCritiqueEscalation(session, dir);
    expect(notifyAgentMock).not.toHaveBeenCalled();
    expect(readEscalation().self_heal_attempts).toBe(1);
  });

  it('re-nudges once the cooldown has elapsed', async () => {
    writeEscalation({
      requested_at: 123,
      reason: REASON_MISSING,
      hit: 'PR creation',
      self_heal_attempts: 1,
      self_heal_at: new Date(Date.now() - 3_600_000).toISOString(),
    });
    await checkCritiqueEscalation(session, dir);
    expect(notifyAgentMock).toHaveBeenCalledTimes(1);
    expect(readEscalation().self_heal_attempts).toBe(2);
  });

  it('escalates to a human once self-heal attempts are exhausted — it never opens the gate', async () => {
    writeEscalation({
      requested_at: 123,
      reason: REASON_MISSING,
      hit: 'PR creation',
      self_heal_attempts: 3,
      self_heal_at: new Date(Date.now() - 3_600_000).toISOString(),
    });
    await checkCritiqueEscalation(session, dir);

    expect(requestApprovalMock).toHaveBeenCalledTimes(1);
    const opts = requestApprovalMock.mock.calls[0][0] as { title: string; question: string };
    expect(opts.title).toContain('could not self-heal');
    expect(readEscalation().forwarded_at).toBeTruthy();
    expect(eventKinds()).toContain('carded');
  });
});

describe('checkCritiqueEscalation — human path', () => {
  it('cards a FAILED critique (must-fix) immediately, without self-healing', async () => {
    prForSession = { repo: 'shader-slang/slang', pr_number: 12186 };
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, hit: 'PR creation', denials: 3 });
    await checkCritiqueEscalation(session, dir);

    expect(notifyAgentMock).not.toHaveBeenCalled();
    expect(requestApprovalMock).toHaveBeenCalledTimes(1);
    const opts = requestApprovalMock.mock.calls[0][0] as {
      title: string;
      question: string;
      payload: Record<string, unknown>;
    };
    // The card must name the PR — its absence was the original complaint.
    expect(opts.title).toContain('shader-slang/slang#12186');
    expect(opts.question).toContain('https://github.com/shader-slang/slang/pull/12186');
    expect(opts.question).toContain('sess-esc-test');
    expect(opts.payload.prNumber).toBe(12186);
    expect(opts.payload.repo).toBe('shader-slang/slang');
    expect(opts.payload.prUrl).toBe('https://github.com/shader-slang/slang/pull/12186');
    expect(opts.payload.sessionId).toBe('sess-esc-test');
    expect(opts.payload.class).toBe('failed');
    expect(opts.payload.hit).toBe('PR creation');
  });

  it('cards only once (forwarded_at makes it idempotent)', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, hit: 'PR creation' });
    await checkCritiqueEscalation(session, dir);
    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to a human for an unrecognized reason', async () => {
    writeEscalation({ requested_at: 123, reason: 'something nobody has seen before', hit: 'delivery' });
    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).toHaveBeenCalledTimes(1);
  });

  it('ignores already-resolved escalations', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, resolved: 'approved' });
    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).not.toHaveBeenCalled();
  });
});

describe('auto-retraction', () => {
  it('isRequirementCleared is true only when a critique round postdates the request', () => {
    writeState({ last_critique_at: '2026-08-05T12:59:48Z' });
    // requested_at is epoch SECONDS
    expect(isRequirementCleared(session, { requested_at: 1785932550 }, dir)).toBe(true);
    expect(isRequirementCleared(session, { requested_at: 1785999999 }, dir)).toBe(false);
    expect(isRequirementCleared(session, {}, dir)).toBe(false);
  });

  it('retracts a carded escalation once the requirement is satisfied', async () => {
    pendingApprovals = [{ approval_id: 'appr-1', session_id: 'sess-esc-test', status: 'pending' }];
    writeState({ last_critique_at: '2026-08-05T12:59:48Z' });
    writeEscalation({ requested_at: 1785932550, reason: REASON_STALE, hit: 'PR creation', forwarded_at: 'ts' });

    await checkCritiqueEscalation(session, dir);

    expect(deleteApprovalMock).toHaveBeenCalledWith('appr-1');
    expect(readEscalation().resolved).toBe('expired-stale');
    expect(eventKinds()).toContain('expired');
  });

  it('closes out a self-healed escalation that was never carded', async () => {
    writeState({ last_critique_at: '2026-08-05T12:59:48Z' });
    writeEscalation({ requested_at: 1785932550, reason: REASON_STALE, self_heal_attempts: 1 });

    await checkCritiqueEscalation(session, dir);

    expect(deleteApprovalMock).not.toHaveBeenCalled();
    expect(readEscalation().resolved).toBe('self-healed');
    expect(eventKinds()).toContain('self_healed');
  });
});

describe('fail-open ingestion', () => {
  it('records a container-side release exactly once', async () => {
    writeEscalation({
      requested_at: 123,
      reason: REASON_MISSING,
      hit: 'PR creation',
      failed_open_at: '2026-08-05T12:52:47Z',
    });
    await checkCritiqueEscalation(session, dir);
    expect(eventKinds()).toContain('failed_open');
    expect(readEscalation().failed_open_recorded).toBe(true);

    recordEventMock.mockClear();
    await checkCritiqueEscalation(session, dir);
    expect(eventKinds()).not.toContain('failed_open');
  });
});

describe('escalation lifecycle — resolve, consume, re-escalate', () => {
  // Resolution and consumption are two events at two different times: the
  // approval handler marks the file resolved when the human clicks, and the
  // container spends the one-shot grant (stamping failed_open_at) only on its
  // next delivery. A `resolved` fast-return above the fail-open ingest meant
  // the stamp always arrived too late to be recorded, and the resolved file
  // then sat there forever — the in-container gate only opens a NEW escalation
  // when the file is ABSENT, so the session could never escalate again.

  /** What the hook's stamp_failed_open does: merge into the existing file. */
  function stampFailedOpen(at = '2026-08-06T10:00:00Z'): void {
    writeEscalation({ ...readEscalation(), failed_open_at: at, failed_open_why: 'admin bypass consumed (one-shot)' });
  }
  /** What the gate does to workflow-state when it spends a grant. */
  function consumeGrantInContainer(grantId: string): void {
    writeState({
      ...readState(),
      critique_gate_bypass_approved: false,
      critique_gate_bypass_consumed_grant_id: grantId,
      critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000),
    });
    stampFailedOpen();
  }
  function escalationExists(): boolean {
    return fs.existsSync(path.join(dir, 'critique-escalation.json'));
  }
  /**
   * A fresh denial-cap hit, as the hook actually handles it: it opens an
   * escalation ONLY when the file is absent (`if [ -f "$ESC_FILE" ] … exit 2`),
   * otherwise it just keeps denying. Modelling that is the whole point — a
   * stale resolved file is what silently suppresses the next escalation, and a
   * test that simply overwrites the file cannot see the bug.
   */
  function denyAgainAsTheHookWould(requestedAt: number): void {
    if (escalationExists()) return;
    writeEscalation({ requested_at: requestedAt, reason: REASON_FAILED, hit: 'PR creation', denials: 3 });
  }
  function retiredEscalation(): Record<string, unknown> | null {
    const p = path.join(dir, 'critique-escalation.last.json');
    return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>) : null;
  }

  it('ingests a fail-open stamped AFTER the approval resolved the request', async () => {
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-late');
    consumeGrantInContainer('appr-late');
    recordEventMock.mockClear();

    await checkCritiqueEscalation(session, dir);

    expect(eventKinds()).toContain('failed_open');
    expect(retiredEscalation()!.failed_open_recorded).toBe(true);
  });

  it('holds the resolved file while the one-shot grant is still spendable', async () => {
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-live');

    await checkCritiqueEscalation(session, dir);
    // Retiring here would throw away the file the container still has to
    // stamp its release into.
    expect(escalationExists()).toBe(true);

    consumeGrantInContainer('appr-live');
    await checkCritiqueEscalation(session, dir);
    expect(escalationExists()).toBe(false);
  });

  it('request → approve → consume → sweep → deny again raises a NEW card', async () => {
    // 1. REQUEST: the gate hit its denial cap on a must-fix critique.
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', denials: 3 });
    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).toHaveBeenCalledTimes(1);

    // 2. APPROVE: one-shot grant issued, the request is answered.
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-1');
    expect(readEscalation().resolved).toBe('approved');

    // 3. CONSUME: the container spends the grant and stamps the release.
    consumeGrantInContainer('appr-1');

    // 4. SWEEP: the release is recorded and the spent file is retired.
    recordEventMock.mockClear();
    await checkCritiqueEscalation(session, dir);
    expect(eventKinds()).toContain('failed_open');
    expect(escalationExists()).toBe(false);
    expect(retiredEscalation()!.resolved).toBe('approved');

    // 5. DENY AGAIN: the hook can open a new escalation only because the live
    //    path is free again.
    denyAgainAsTheHookWould(2000);
    expect(escalationExists()).toBe(true);

    // 6. A NEW CARD — the approval before it decided one delivery, not the session.
    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).toHaveBeenCalledTimes(2);
  });

  it('holds a REJECTED escalation until the requirement is satisfied', async () => {
    writeEscalation({ requested_at: 1785932550, reason: REASON_FAILED, hit: 'PR creation', forwarded_at: 'ts' });
    await applyBypassRejection(session, 'slack:admin', dir);

    await checkCritiqueEscalation(session, dir);
    // The gate's "an admin REJECTED this" branch matches
    // critique_gate_bypass_rejected_request against the requested_at in THIS
    // file. Retire it early and an immediate retry re-cards the human who just
    // said no.
    expect(escalationExists()).toBe(true);
    expect(requestApprovalMock).not.toHaveBeenCalled();

    // The agent complies. Now it can go, and a genuinely new denial escalates.
    writeState({ ...readState(), last_critique_at: '2026-08-05T12:59:48Z' });
    await checkCritiqueEscalation(session, dir);
    expect(escalationExists()).toBe(false);
  });

  it('retires a self-healed escalation on the sweep after it closes', async () => {
    writeState({ last_critique_at: '2026-08-05T12:59:48Z' });
    writeEscalation({ requested_at: 1785932550, reason: REASON_STALE, self_heal_attempts: 1 });

    await checkCritiqueEscalation(session, dir);
    expect(readEscalation().resolved).toBe('self-healed'); // audit fields land first

    await checkCritiqueEscalation(session, dir);
    expect(escalationExists()).toBe(false);
    expect(retiredEscalation()!.resolved).toBe('self-healed');
  });
});

describe('consume/stamp interleaving — a sweep between the gate’s two writes', () => {
  // The gate does NOT write its consumption and its release stamp atomically,
  // and it cannot: they are two filesystem writes in a process the host does
  // not control.
  //
  //   1. the gate marks the grant consumed in workflow-state.json
  //   2. …a host sweep can land here…
  //   3. the gate stamps failed_open_at into critique-escalation.json
  //
  // reconcileBypassState runs at the top of every sweep, so a sweep in that
  // window used to see consumed_at, call the escalation spent, and retire the
  // still-unstamped file. The gate's stamp then found no file, fabricated a
  // `requested_at: 0` replacement, and the next sweep carded a human for a
  // synthetic escalation while the real release went unrecorded.

  /** The gate's FIRST write. Nothing is stamped yet — that is the whole point. */
  function consumeGrantOnly(grantId: string): void {
    writeState({
      ...readState(),
      critique_gate_bypass_approved: false,
      critique_gate_bypass_consumed_grant_id: grantId,
      critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * The gate's SECOND write, as `stamp_failed_open` now does it: merge into the
   * escalation file when it exists, and ALWAYS append to the release journal.
   * It never creates the escalation file — fabricating one is the corruption.
   */
  function stampRelease(opts: { eventId?: string; grantId?: string | null } = {}): void {
    const eventId = opts.eventId ?? 'rel-1';
    const at = new Date().toISOString();
    fs.appendFileSync(
      path.join(dir, 'critique-releases.jsonl'),
      `${JSON.stringify({
        event_id: eventId,
        at,
        why: 'admin bypass consumed (one-shot)',
        reason: REASON_FAILED,
        hit: 'PR creation',
        grant_id: opts.grantId ?? null,
      })}\n`,
    );
    if (fs.existsSync(path.join(dir, 'critique-escalation.json'))) {
      writeEscalation({
        ...readEscalation(),
        failed_open_at: at,
        failed_open_why: 'admin bypass consumed (one-shot)',
        failed_open_event_id: eventId,
      });
    }
  }

  function escalationExists(): boolean {
    return fs.existsSync(path.join(dir, 'critique-escalation.json'));
  }
  function retired(): Record<string, unknown> | null {
    const p = path.join(dir, 'critique-escalation.last.json');
    return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>) : null;
  }
  function releases(): Array<Record<string, unknown>> {
    return insertedEvents.filter((e) => e.event === 'failed_open');
  }

  it('consume → sweep → stamp → sweep: exactly one failed_open, no new card, and it still retires', async () => {
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', denials: 3, forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-race');
    recordEventMock.mockClear();
    insertedEvents.length = 0;
    requestApprovalMock.mockClear();

    // 1. CONSUME — the grant is spent; the stamp has not been written yet.
    consumeGrantOnly('appr-race');

    // 2. SWEEP lands inside the window. It must NOT retire the file: that
    //    file is where the release the gate is about to record has to land.
    await checkCritiqueEscalation(session, dir);
    expect(escalationExists()).toBe(true);
    expect(releases()).toHaveLength(0);
    expect(requestApprovalMock).not.toHaveBeenCalled();

    // 3. STAMP — the gate's second write, milliseconds later.
    stampRelease({ grantId: 'appr-race' });

    // 4. SWEEP — the release is recorded against the ORIGINAL request and the
    //    now-settled file is finally retired.
    await checkCritiqueEscalation(session, dir);

    expect(releases()).toHaveLength(1);
    expect(releases()[0].requested_at).toBe(1000);
    expect(requestApprovalMock).not.toHaveBeenCalled();
    expect(escalationExists()).toBe(false);
    expect(retired()!.resolved).toBe('approved');
    expect(retired()!.requested_at).toBe(1000);
    expect(ledger.get('appr-race')!.release_recorded_at).toBeTruthy();
  });

  it('holds the file across repeated sweeps while the release stamp is outstanding', async () => {
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-hold');
    consumeGrantOnly('appr-hold');

    for (let i = 0; i < 3; i++) await checkCritiqueEscalation(session, dir);
    expect(escalationExists()).toBe(true);
    expect(releases()).toHaveLength(0);
  });

  it('recovers a release whose escalation file was already gone — via the journal, with no new card', async () => {
    // The residual after the hold above: the orphan recovery below retires the
    // file, and a late stamp then has nowhere to merge. The append-only
    // journal is that release's only route home, and the grant ledger is what
    // re-attaches it to the request that produced it.
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-late');
    consumeGrantOnly('appr-late');
    fs.rmSync(path.join(dir, 'critique-escalation.json'));
    recordEventMock.mockClear();
    insertedEvents.length = 0;
    requestApprovalMock.mockClear();

    stampRelease({ eventId: 'rel-late', grantId: 'appr-late' });
    await checkCritiqueEscalation(session, dir);

    expect(releases()).toHaveLength(1);
    // Attribution survives the file's disappearance: 1000, not a synthetic 0.
    expect(releases()[0].requested_at).toBe(1000);
    // And nothing manufactured a fresh escalation to card a human about.
    expect(requestApprovalMock).not.toHaveBeenCalled();
    expect(escalationExists()).toBe(false);
  });

  it('records a release exactly once when it arrives by BOTH routes', async () => {
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-both');
    consumeGrantOnly('appr-both');
    recordEventMock.mockClear();
    insertedEvents.length = 0;

    // One release, written to the journal AND merged into the file, then swept
    // repeatedly — the shared event id is what keeps it a single row.
    stampRelease({ eventId: 'rel-both', grantId: 'appr-both' });
    await checkCritiqueEscalation(session, dir);
    await checkCritiqueEscalation(session, dir);

    expect(releases()).toHaveLength(1);
  });
});

describe('orphaned release recovery', () => {
  function consumeGrantOnly(grantId: string, agoSecs = 0): void {
    writeState({
      ...readState(),
      critique_gate_bypass_approved: false,
      critique_gate_bypass_consumed_grant_id: grantId,
      critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000) - agoSecs,
    });
  }
  function escalationExists(): boolean {
    return fs.existsSync(path.join(dir, 'critique-escalation.json'));
  }

  it('reports and retires a consumed grant whose release never arrived — it does not leak forever', async () => {
    // Holding until the stamp lands is only safe if the hold is bounded. The
    // in-container gate opens a NEW escalation only when the file is ABSENT,
    // so a file held forever wedges the session shut in both directions —
    // exactly the failure #1109 removed.
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-orphan');
    consumeGrantOnly('appr-orphan');
    // Backdate the host-observed consumption past the recovery window.
    ledger.get('appr-orphan')!.consumed_at = new Date(Date.now() - 3_600_000).toISOString();
    recordEventMock.mockClear();
    insertedEvents.length = 0;

    await checkCritiqueEscalation(session, dir);

    const orphan = insertedEvents.find((e) => e.event === 'release_orphaned');
    expect(orphan).toBeDefined();
    expect(String(orphan!.reason)).toContain('appr-orphan');
    expect(orphan!.requested_at).toBe(1000);
    expect(escalationExists()).toBe(false);
    const last = JSON.parse(fs.readFileSync(path.join(dir, 'critique-escalation.last.json'), 'utf-8')) as Record<
      string,
      unknown
    >;
    expect(last.release_orphaned_at).toBeTruthy();
    expect(last.release_orphan_grant_id).toBe('appr-orphan');
  });

  it('an unparseable consumption stamp orphans immediately rather than holding forever', async () => {
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-bad-ts');
    consumeGrantOnly('appr-bad-ts');
    ledger.get('appr-bad-ts')!.consumed_at = 'not-a-timestamp';
    insertedEvents.length = 0;

    await checkCritiqueEscalation(session, dir);

    expect(insertedEvents.some((e) => e.event === 'release_orphaned')).toBe(true);
    expect(escalationExists()).toBe(false);
  });

  it('a REVOKED grant still retires without a release stamp — it was never spent', async () => {
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-revoked');
    ledger.get('appr-revoked')!.revoked_at = new Date().toISOString();
    insertedEvents.length = 0;

    await checkCritiqueEscalation(session, dir);

    expect(escalationExists()).toBe(false);
    expect(insertedEvents.some((e) => e.event === 'release_orphaned')).toBe(false);
  });

  it('an EXPIRED, unspent grant still retires without a release stamp', async () => {
    writeEscalation({ requested_at: 1000, reason: REASON_FAILED, hit: 'PR creation', forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'appr-expired');
    ledger.get('appr-expired')!.expires_at = new Date(Date.now() - 1000).toISOString();
    insertedEvents.length = 0;

    await checkCritiqueEscalation(session, dir);

    expect(escalationExists()).toBe(false);
    expect(insertedEvents.some((e) => e.event === 'release_orphaned')).toBe(false);
  });
});

describe('admin decision application', () => {
  it('approval writes a ONE-SHOT, TTL-scoped bypass — not a standing grant', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir);
    const state = readState();
    expect(state.critique_gate_bypass_approved).toBe(true);
    expect(state.critique_gate_bypass_request).toBe(123);
    expect(typeof state.critique_gate_bypass_expires_at).toBe('number');
    expect(state.critique_gate_bypass_expires_at as number).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(readEscalation().resolved).toBe('approved');
    expect(readEscalation().resolved_by).toBe('slack:admin');
    expect(eventKinds()).toContain('approved');
  });

  it('rejection is scoped to the request it answered', async () => {
    writeEscalation({ requested_at: 456, reason: REASON_FAILED, forwarded_at: 'ts' });
    await applyBypassRejection(session, 'slack:admin', dir);
    const state = readState();
    expect(state.critique_gate_bypass_rejected).toBe(true);
    // Without this the same "no" answered every later escalation forever.
    expect(state.critique_gate_bypass_rejected_request).toBe(456);
    expect(readEscalation().resolved).toBe('rejected');
  });

  it('approval preserves existing workflow state keys', async () => {
    writeState({ critique_rounds: 4, critique_verdicts: { OUTPUT_REVIEW: 'must-fix' } });
    await applyBypassApproval(session, 'slack:admin', dir);
    const state = readState();
    expect(state.critique_rounds).toBe(4);
    expect((state.critique_verdicts as Record<string, string>).OUTPUT_REVIEW).toBe('must-fix');
    expect(state.critique_gate_bypass_approved).toBe(true);
  });
});

describe('host-authoritative bypass ledger', () => {
  const GRANT = 'appr-grant-1';
  const iso = (msFromNow: number): string => new Date(Date.now() + msFromNow).toISOString();

  function grantExists(id: string): Grant | undefined {
    return ledger.get(id);
  }

  it('an approval records a ledger row keyed on the approval id', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, GRANT);
    const g = grantExists(GRANT)!;
    expect(g.session_id).toBe('sess-esc-test');
    expect(g.granted_by).toBe('slack:admin');
    // ISO-8601 per the repo Timestamps policy, not epoch ints.
    expect(g.granted_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(g.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    // The file carries the grant id and epoch seconds (shell arithmetic).
    expect(readState().critique_gate_bypass_grant_id).toBe(GRANT);
    expect(typeof readState().critique_gate_bypass_expires_at).toBe('number');
  });

  it('a legitimate grant survives reconciliation untouched', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, GRANT);
    recordEventMock.mockClear();
    await reconcileBypassState(session, dir);
    expect(readState().critique_gate_bypass_approved).toBe(true);
    expect(eventKinds()).not.toContain('state_divergence');
  });

  it('revokes a bypass no host grant backs (the forgery case)', async () => {
    writeState({ critique_gate_bypass_approved: true, critique_gate_bypass_grant_id: 'forged' });
    await reconcileBypassState(session, dir);
    expect(readState().critique_gate_bypass_approved).toBe(false);
    expect(eventKinds()).toContain('state_divergence');
  });

  it('revokes a claim carrying no grant id at all', async () => {
    writeState({ critique_gate_bypass_approved: true });
    await reconcileBypassState(session, dir);
    expect(readState().critique_gate_bypass_approved).toBe(false);
    expect(eventKinds()).toContain('state_divergence');
  });

  it('revokes a claim on an already-consumed grant', async () => {
    ledger.set(GRANT, {
      grant_id: GRANT,
      session_id: 'sess-esc-test',
      requested_at: 123,
      granted_at: iso(-1000),
      expires_at: iso(3_600_000),
      granted_by: 'slack:admin',
      consumed_at: iso(-500),
      revoked_at: null,
      revoked_reason: null,
      release_recorded_at: null,
    });
    writeState({ critique_gate_bypass_approved: true, critique_gate_bypass_grant_id: GRANT });
    await reconcileBypassState(session, dir);
    expect(readState().critique_gate_bypass_approved).toBe(false);
    expect(eventKinds()).toContain('state_divergence');
  });

  it('revokes a claim on an expired grant', async () => {
    ledger.set(GRANT, {
      grant_id: GRANT,
      session_id: 'sess-esc-test',
      requested_at: 123,
      granted_at: iso(-7_200_000),
      expires_at: iso(-3_600_000),
      granted_by: 'slack:admin',
      consumed_at: null,
      revoked_at: null,
      revoked_reason: null,
      release_recorded_at: null,
    });
    writeState({ critique_gate_bypass_approved: true, critique_gate_bypass_grant_id: GRANT });
    await reconcileBypassState(session, dir);
    expect(readState().critique_gate_bypass_approved).toBe(false);
  });

  it('revokes a claim on another session’s grant', async () => {
    ledger.set(GRANT, {
      grant_id: GRANT,
      session_id: 'sess-someone-else',
      requested_at: 123,
      granted_at: iso(-1000),
      expires_at: iso(3_600_000),
      granted_by: 'slack:admin',
      consumed_at: null,
      revoked_at: null,
      revoked_reason: null,
      release_recorded_at: null,
    });
    writeState({ critique_gate_bypass_approved: true, critique_gate_bypass_grant_id: GRANT });
    await reconcileBypassState(session, dir);
    expect(readState().critique_gate_bypass_approved).toBe(false);
    expect(eventKinds()).toContain('state_divergence');
  });

  it('clamps an expiry extended beyond what the host granted', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, GRANT);
    const granted = readState().critique_gate_bypass_expires_at as number;
    // Agent extends its own grant by a day.
    writeState({ ...readState(), critique_gate_bypass_expires_at: granted + 86_400 });
    recordEventMock.mockClear();
    await reconcileBypassState(session, dir);
    expect(readState().critique_gate_bypass_expires_at).toBe(granted);
    expect(eventKinds()).toContain('state_divergence');
    // Still live — clamping is not revocation.
    expect(readState().critique_gate_bypass_approved).toBe(true);
  });

  it('does NOT flag a legitimate consumption that carries no grant id (older gate)', async () => {
    // The bash hook and the agent-runner deploy on different cadences, so a
    // gate older than this host can consume without writing the id. Treating
    // that as divergence would fire on every legitimate bypass on the happy
    // path — the exact cross-path parity mistake that produced #1092.
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, GRANT);
    writeState({
      ...readState(),
      critique_gate_bypass_approved: false,
      critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000),
      // note: no critique_gate_bypass_consumed_grant_id
    });
    recordEventMock.mockClear();
    await reconcileBypassState(session, dir);
    expect(eventKinds()).not.toContain('state_divergence');
    expect(grantExists(GRANT)!.consumed_at).toBeTruthy();
  });

  it('DOES flag an unattributed consumption when the session has no grant to spend', async () => {
    writeState({
      critique_gate_bypass_approved: false,
      critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000),
    });
    await reconcileBypassState(session, dir);
    expect(eventKinds()).toContain('state_divergence');
  });

  it('flags consumption of a REVOKED grant', async () => {
    // Existing-and-unspent is not the same as valid: consuming a grant the
    // host already withdrew means the gate honoured stale local state.
    ledger.set(GRANT, {
      grant_id: GRANT,
      session_id: 'sess-esc-test',
      requested_at: 123,
      granted_at: iso(-1000),
      expires_at: iso(3_600_000),
      granted_by: 'slack:admin',
      consumed_at: null,
      revoked_at: iso(-500),
      revoked_reason: 'superseded',
      release_recorded_at: null,
    });
    writeState({
      critique_gate_bypass_approved: false,
      critique_gate_bypass_consumed_grant_id: GRANT,
      critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000),
    });
    await reconcileBypassState(session, dir);
    expect(eventKinds()).toContain('state_divergence');
    expect(ledger.get(GRANT)!.consumed_at).toBeNull();
  });

  it('flags consumption that happened AFTER the grant expired', async () => {
    // Validated against the stamped consumption time, not "now", so a late
    // sweep cannot excuse a consumption outside the validity interval.
    ledger.set(GRANT, {
      grant_id: GRANT,
      session_id: 'sess-esc-test',
      requested_at: 123,
      granted_at: iso(-7_200_000),
      expires_at: iso(-3_600_000),
      granted_by: 'slack:admin',
      consumed_at: null,
      revoked_at: null,
      revoked_reason: null,
      release_recorded_at: null,
    });
    writeState({
      critique_gate_bypass_approved: false,
      critique_gate_bypass_consumed_grant_id: GRANT,
      critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000), // well after expiry
    });
    await reconcileBypassState(session, dir);
    expect(eventKinds()).toContain('state_divergence');
    expect(ledger.get(GRANT)!.consumed_at).toBeNull();
  });

  it('flags a REPLAYED grant — consumed a second time between sweeps', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, GRANT);
    const stamp = (): void => {
      writeState({
        ...readState(),
        critique_gate_bypass_approved: false,
        critique_gate_bypass_consumed_grant_id: GRANT,
        critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000),
      });
    };
    stamp();
    await reconcileBypassState(session, dir); // first, legitimate consumption
    recordEventMock.mockClear();
    stamp(); // agent re-set approved and spent the same grant again
    await reconcileBypassState(session, dir);
    expect(eventKinds()).toContain('state_divergence');
  });

  it('flags a CONSUMED bypass the host never granted — the forgery that SUCCEEDS', async () => {
    // The gate clears `approved` before allowing delivery, so a successful
    // forgery leaves only a consumption stamp. Gating this behind the
    // approved-flag check would make it the one case that never reports.
    writeState({
      critique_gate_bypass_approved: false,
      critique_gate_bypass_consumed_grant_id: 'forged',
      critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000),
    });
    await reconcileBypassState(session, dir);
    expect(eventKinds()).toContain('state_divergence');
  });

  it('marks a legitimately consumed grant spent, and clears the stamp so it cannot be replayed', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, GRANT);
    writeState({
      ...readState(),
      critique_gate_bypass_approved: false,
      critique_gate_bypass_consumed_grant_id: GRANT,
      critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000),
    });
    recordEventMock.mockClear();
    await reconcileBypassState(session, dir);
    expect(grantExists(GRANT)!.consumed_at).toBeTruthy();
    expect(eventKinds()).not.toContain('state_divergence');
    // Stamp cleared — otherwise it would be re-evaluated every sweep and could
    // mark a LATER legitimate grant spent before its owner ever used it.
    expect(readState().critique_gate_bypass_consumed_at).toBeNull();
    expect(readState().critique_gate_bypass_consumed_grant_id).toBeNull();
  });

  it('a stale consumption stamp does not consume the NEXT grant', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, forwarded_at: 'ts' });
    await applyBypassApproval(session, 'slack:admin', dir, 'grant-A');
    writeState({
      ...readState(),
      critique_gate_bypass_approved: false,
      critique_gate_bypass_consumed_grant_id: 'grant-A',
      critique_gate_bypass_consumed_at: Math.floor(Date.now() / 1000),
    });
    await reconcileBypassState(session, dir); // spends A, clears the stamp
    // A second, legitimate approval.
    await applyBypassApproval(session, 'slack:admin', dir, 'grant-B');
    await reconcileBypassState(session, dir);
    expect(grantExists('grant-B')!.consumed_at).toBeNull();
    expect(readState().critique_gate_bypass_approved).toBe(true);
  });

  it('revokes the ledger row when the state write fails (no orphan capability)', async () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, forwarded_at: 'ts' });
    // A directory where the state file should be makes the patch throw.
    fs.mkdirSync(path.join(dir, 'workflow-state.json'), { recursive: true });
    await expect(applyBypassApproval(session, 'slack:admin', dir, GRANT)).rejects.toThrow();
    const g = grantExists(GRANT)!;
    expect(g.revoked_at).toBeTruthy();
    expect(g.revoked_reason).toContain('patch failed');
  });

  it('does nothing when no bypass is claimed', async () => {
    writeState({ critique_rounds: 3 });
    await reconcileBypassState(session, dir);
    expect(recordEventMock).not.toHaveBeenCalled();
  });
});

describe('registered handlers', () => {
  it('the approval handler patches state and notifies the agent', async () => {
    expect(approvalHandler).toBeDefined();
    const notify = vi.fn();
    await approvalHandler!({ session, payload: {}, userId: 'slack:admin', notify });
    expect(notify).toHaveBeenCalledTimes(1);
    const text = String(notify.mock.calls[0][0]);
    expect(text).toContain('resend your delivery');
    expect(text).toContain('ONE-SHOT');
  });

  it('the resolved handler reacts only to critique_gate_bypass rejects', async () => {
    expect(resolvedHandler).toBeDefined();
    await resolvedHandler!({ approval: { action: 'other_action' }, session, outcome: 'reject', userId: 'u' });
    expect(notifyAgentMock).not.toHaveBeenCalled();
    await resolvedHandler!({ approval: { action: 'critique_gate_bypass' }, session, outcome: 'approve', userId: 'u' });
    expect(notifyAgentMock).not.toHaveBeenCalled();
    await resolvedHandler!({ approval: { action: 'critique_gate_bypass' }, session, outcome: 'reject', userId: 'u' });
    expect(notifyAgentMock).toHaveBeenCalledTimes(1);
  });
});
