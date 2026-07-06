// Tests for src/modules/critique-escalation/ — the host side of the
// graduated critique-gate enforcement (deny ×3 → human approval).
//
// The approvals module and session-manager are mocked: these tests exercise
// the escalation-file → approval-card flow and the state patches the admin's
// decision writes, not the delivery plumbing.
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

const { checkCritiqueEscalation, applyBypassApproval, applyBypassRejection } =
  await import('./modules/critique-escalation/index.js');

const session = { id: 'sess-esc-test', agent_group_id: 'ag-esc-test' } as Session;

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'critique-esc-test-'));
  requestApprovalMock.mockClear();
  notifyAgentMock.mockClear();
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

function readState(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(dir, 'workflow-state.json'), 'utf-8')) as Record<string, unknown>;
}

describe('checkCritiqueEscalation', () => {
  it('does nothing when no escalation file exists', async () => {
    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).not.toHaveBeenCalled();
  });

  it('cards a fresh escalation request exactly once (forwarded_at marks it)', async () => {
    writeEscalation({ requested_at: 123, reason: 'missing critique stages: OUTPUT_REVIEW', hit: 'PR creation' });
    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).toHaveBeenCalledTimes(1);
    const opts = requestApprovalMock.mock.calls[0][0] as { action: string; question: string };
    expect(opts.action).toBe('critique_gate_bypass');
    expect(opts.question).toContain('OUTPUT_REVIEW');
    expect(opts.question).toContain('PR creation');
    expect(readEscalation().forwarded_at).toBeTruthy();

    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).toHaveBeenCalledTimes(1); // idempotent
  });

  it('ignores already-resolved escalations', async () => {
    writeEscalation({ requested_at: 123, reason: 'x', resolved: 'approved' });
    await checkCritiqueEscalation(session, dir);
    expect(requestApprovalMock).not.toHaveBeenCalled();
  });
});

describe('admin decision application', () => {
  it('approval writes the bypass flag and marks the escalation resolved', () => {
    writeEscalation({ requested_at: 123, reason: 'x', forwarded_at: 'ts' });
    applyBypassApproval(session, 'slack:admin', dir);
    expect(readState().critique_gate_bypass_approved).toBe(true);
    expect(readEscalation().resolved).toBe('approved');
    expect(readEscalation().resolved_by).toBe('slack:admin');
  });

  it('rejection writes the rejected flag (gate keeps denying, stops re-escalating)', () => {
    writeEscalation({ requested_at: 123, reason: 'x', forwarded_at: 'ts' });
    applyBypassRejection(session, 'slack:admin', dir);
    expect(readState().critique_gate_bypass_rejected).toBe(true);
    expect(readEscalation().resolved).toBe('rejected');
  });

  it('approval preserves existing workflow state keys', () => {
    fs.writeFileSync(
      path.join(dir, 'workflow-state.json'),
      JSON.stringify({ critique_rounds: 4, critique_verdicts: { OUTPUT_REVIEW: 'must-fix' } }),
    );
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
    // The registered handler derives the dir from the (mocked) sessionDir —
    // exercise the exported apply function above for path behavior; here we
    // verify the handler wiring calls notify with re-send guidance.
    await approvalHandler!({ session, payload: {}, userId: 'slack:admin', notify });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(String(notify.mock.calls[0][0])).toContain('resend your delivery');
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
