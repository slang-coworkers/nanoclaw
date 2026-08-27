import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RunawayCost, RunawayMetrics } from './modules/runaway/detect.js';
import type { Session } from './types.js';

// The runaway card's emitCard lives in modules/runaway/index.ts, which pulls in
// the container runner + session DB at import. Stub those so we can drive the
// pure card-building logic (payload + question) without a live host. Only
// requestApproval is observed. vi.hoisted keeps the spy visible to the hoisted
// vi.mock factory.
const { requestApproval } = vi.hoisted(() => ({
  requestApproval: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));
vi.mock('./modules/approvals/index.js', () => ({
  requestApproval,
  registerApprovalHandler: vi.fn(),
}));
vi.mock('./container-runner.js', () => ({ killContainer: vi.fn() }));
vi.mock('./db/sessions.js', () => ({ updateSession: vi.fn() }));

const { runawayCardDeps } = await import('./modules/runaway/index.js');

const session = { id: 'sess-abc', agent_group_id: 'ag-fixer' } as Session;
const metrics: RunawayMetrics = { turns: 60, outputBytes: 40 };
const WINDOW_S = 600;

function lastCall(): { payload: Record<string, unknown>; question: string; title: string; action: string } {
  return requestApproval.mock.calls.at(-1)![0] as never;
}

describe('runaway card — cost enrichment', () => {
  beforeEach(() => requestApproval.mockClear());

  it('carries spent/cap on the payload and inlines "$spent of $cap" in the question', async () => {
    const cost: RunawayCost = { spentUsd: 512.256, capUsd: 200 };
    await runawayCardDeps.emitCard(session, metrics, WINDOW_S, cost);

    const call = lastCall();
    expect(call.action).toBe('stop_runaway_session');
    expect(call.payload.sessionId).toBe('sess-abc');
    // Rounded to 4dp so the DM and the dashboard print the same figure.
    expect(call.payload.spentUsd).toBe(512.256);
    expect(call.payload.capUsd).toBe(200);
    // Two-decimal, human-facing figure in the DM/chat question text.
    expect(call.question).toContain('spent $512.26 of its $200.00 cap');
  });

  it('omits cost fields and the cost sentence when cost tracking is off', async () => {
    await runawayCardDeps.emitCard(session, metrics, WINDOW_S, null);

    const call = lastCall();
    expect(call.payload).not.toHaveProperty('spentUsd');
    expect(call.payload).not.toHaveProperty('capUsd');
    expect(call.question).not.toContain('spent $');
    // The pre-existing card body is otherwise unchanged.
    expect(call.title).toBe('Possible runaway session');
    expect(call.question).toContain('Approve to STOP it');
  });
});
