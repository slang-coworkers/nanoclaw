// Tests for src/modules/critique-escalation/classify.ts.
//
// The reason strings below are copied VERBATIM from the six `DENIAL_REASON=`
// assignments in container/hooks/gate-critique-on-deliver.sh. That is the
// point of this suite: classification decides whether a human is interrupted,
// so it must be pinned to the exact text the gate actually emits. If someone
// reworks a message in the hook, these tests fail — which is the intended
// coupling, not an accident.
import { describe, expect, it } from 'vitest';

import {
  classifyEscalation,
  isSelfHealable,
  selfHealDirective,
  stageToRerun,
} from './modules/critique-escalation/classify.js';

// ── verbatim from the hook ────────────────────────────────────────────────
const MISSING_STAGES = 'missing critique stages: PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW';
const NO_ROUNDS = 'no critique rounds recorded (critique_rounds=0)';
const NO_VERDICT =
  "OUTPUT_REVIEW ran but no verdict was recorded (missing or unparseable). Re-run /codex-critique with STAGE: OUTPUT_REVIEW and make sure codex returns a '### Verdict' section containing approve or must-fix";
const MUST_FIX =
  'OUTPUT_REVIEW last verdict is "must-fix" (must be "approve"). Re-run /codex-critique with STAGE: OUTPUT_REVIEW after fixing the issues';
const EDITS_SINCE =
  '13 edit(s) recorded since the last critique round — the OUTPUT_REVIEW approve no longer covers the current state. Re-run /codex-critique with STAGE: OUTPUT_REVIEW';
const ARTIFACTS_CHANGED =
  'reviewed artifacts changed since the OUTPUT_REVIEW approve: /workspace/agent/foo.md. Re-run /codex-critique with STAGE: OUTPUT_REVIEW';

describe('classifyEscalation', () => {
  it('classifies the two MISSING reasons', () => {
    expect(classifyEscalation(MISSING_STAGES)).toBe('missing');
    expect(classifyEscalation(NO_ROUNDS)).toBe('missing');
  });

  it('treats an unrecorded verdict as missing — re-running the stage fixes it', () => {
    expect(classifyEscalation(NO_VERDICT)).toBe('missing');
  });

  it('classifies the two STALE reasons', () => {
    expect(classifyEscalation(EDITS_SINCE)).toBe('stale');
    expect(classifyEscalation(ARTIFACTS_CHANGED)).toBe('stale');
  });

  it('classifies a recorded non-approve verdict as FAILED — the only human case', () => {
    expect(classifyEscalation(MUST_FIX)).toBe('failed');
  });

  it('does not mistake the must-fix reason for staleness despite its "Re-run" tail', () => {
    // MUST_FIX also contains "Re-run /codex-critique with STAGE: OUTPUT_REVIEW",
    // which the stale reasons contain too. Order of checks matters here.
    expect(classifyEscalation(MUST_FIX)).not.toBe('stale');
  });

  it('classifies any other recorded verdict as failed', () => {
    expect(classifyEscalation('OUTPUT_REVIEW last verdict is "reject" (must be "approve").')).toBe('failed');
  });

  it('falls back to FAILED for unknown or empty reasons — unknown must reach a human', () => {
    expect(classifyEscalation('')).toBe('failed');
    expect(classifyEscalation('some future reason nobody wrote yet')).toBe('failed');
    expect(classifyEscalation('   ')).toBe('failed');
  });
});

describe('isSelfHealable', () => {
  it('is true for stale and missing, false for failed', () => {
    expect(isSelfHealable('missing')).toBe(true);
    expect(isSelfHealable('stale')).toBe(true);
    expect(isSelfHealable('failed')).toBe(false);
  });

  it("means 17 of prod's first 18 escalations would not have interrupted a human", () => {
    const prod = [...Array<string>(12).fill(MISSING_STAGES), ...Array<string>(5).fill(EDITS_SINCE), MUST_FIX];
    const carded = prod.filter((r) => !isSelfHealable(classifyEscalation(r)));
    expect(prod).toHaveLength(18);
    expect(carded).toHaveLength(1);
  });
});

describe('stageToRerun', () => {
  it('takes the first missing stage when several are listed', () => {
    expect(stageToRerun(MISSING_STAGES)).toBe('PLAN_REVIEW');
  });

  it('reads an explicit STAGE: directive', () => {
    expect(stageToRerun(EDITS_SINCE)).toBe('OUTPUT_REVIEW');
    expect(stageToRerun(MUST_FIX)).toBe('OUTPUT_REVIEW');
  });

  it('defaults to OUTPUT_REVIEW when the reason names no stage', () => {
    expect(stageToRerun(NO_ROUNDS)).toBe('OUTPUT_REVIEW');
    expect(stageToRerun('')).toBe('OUTPUT_REVIEW');
  });
});

describe('selfHealDirective', () => {
  it('names the stage, the blocked surface, and the attempt budget', () => {
    const d = selfHealDirective({
      cls: 'missing',
      reason: MISSING_STAGES,
      hit: 'PR creation',
      attempt: 2,
      maxAttempts: 3,
    });
    expect(d).toContain('PLAN_REVIEW');
    expect(d).toContain('PR creation');
    expect(d).toContain('attempt 2 of 3');
    expect(d).toContain('/codex-critique');
  });

  it('states plainly that waiting will not clear the gate', () => {
    // The old design had a 30-minute fail-open, so waiting DID work and agents
    // could learn that. The directive has to contradict it explicitly.
    const d = selfHealDirective({ cls: 'stale', reason: EDITS_SINCE, hit: 'PR creation', attempt: 1, maxAttempts: 3 });
    expect(d).toContain('will NOT open on its own');
    expect(d).toMatch(/no timeout that lets this/i);
  });

  it('explains staleness differently from a missing round', () => {
    const stale = selfHealDirective({ cls: 'stale', reason: EDITS_SINCE, hit: 'x', attempt: 1, maxAttempts: 3 });
    const missing = selfHealDirective({ cls: 'missing', reason: NO_ROUNDS, hit: 'x', attempt: 1, maxAttempts: 3 });
    expect(stale).toContain('no longer covers the current state');
    expect(missing).toContain('has not been recorded');
  });
});
