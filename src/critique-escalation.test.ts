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
  notify: (t: string) => void;
}) => Promise<void>;
type ResolvedHandler = (event: {
  approval: { action: string };
  session: Session;
  outcome: 'approve' | 'reject';
  userId: string;
}) => void;
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
vi.mock('./db/critique-escalations.js', () => ({
  recordEscalationEvent: (...args: unknown[]) => recordEventMock(...args),
  lookupPrForSession: () => prForSession,
}));

const deleteApprovalMock = vi.fn();
let pendingApprovals: Array<{ approval_id: string; session_id: string; status: string }> = [];
vi.mock('./db/sessions.js', () => ({
  getPendingApprovalsByAction: () => pendingApprovals,
  deletePendingApproval: (...args: unknown[]) => deleteApprovalMock(...args),
}));

const { checkCritiqueEscalation, applyBypassApproval, applyBypassRejection, isRequirementCleared } =
  await import('./modules/critique-escalation/index.js');

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

describe('admin decision application', () => {
  it('approval writes a ONE-SHOT, TTL-scoped bypass — not a standing grant', () => {
    writeEscalation({ requested_at: 123, reason: REASON_FAILED, forwarded_at: 'ts' });
    applyBypassApproval(session, 'slack:admin', dir);
    const state = readState();
    expect(state.critique_gate_bypass_approved).toBe(true);
    expect(state.critique_gate_bypass_request).toBe(123);
    expect(typeof state.critique_gate_bypass_expires_at).toBe('number');
    expect(state.critique_gate_bypass_expires_at as number).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(readEscalation().resolved).toBe('approved');
    expect(readEscalation().resolved_by).toBe('slack:admin');
    expect(eventKinds()).toContain('approved');
  });

  it('rejection is scoped to the request it answered', () => {
    writeEscalation({ requested_at: 456, reason: REASON_FAILED, forwarded_at: 'ts' });
    applyBypassRejection(session, 'slack:admin', dir);
    const state = readState();
    expect(state.critique_gate_bypass_rejected).toBe(true);
    // Without this the same "no" answered every later escalation forever.
    expect(state.critique_gate_bypass_rejected_request).toBe(456);
    expect(readEscalation().resolved).toBe('rejected');
  });

  it('approval preserves existing workflow state keys', () => {
    writeState({ critique_rounds: 4, critique_verdicts: { OUTPUT_REVIEW: 'must-fix' } });
    applyBypassApproval(session, 'slack:admin', dir);
    const state = readState();
    expect(state.critique_rounds).toBe(4);
    expect((state.critique_verdicts as Record<string, string>).OUTPUT_REVIEW).toBe('must-fix');
    expect(state.critique_gate_bypass_approved).toBe(true);
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

  it('the resolved handler reacts only to critique_gate_bypass rejects', () => {
    expect(resolvedHandler).toBeDefined();
    resolvedHandler!({ approval: { action: 'other_action' }, session, outcome: 'reject', userId: 'u' });
    expect(notifyAgentMock).not.toHaveBeenCalled();
    resolvedHandler!({ approval: { action: 'critique_gate_bypass' }, session, outcome: 'approve', userId: 'u' });
    expect(notifyAgentMock).not.toHaveBeenCalled();
    resolvedHandler!({ approval: { action: 'critique_gate_bypass' }, session, outcome: 'reject', userId: 'u' });
    expect(notifyAgentMock).toHaveBeenCalledTimes(1);
  });
});
