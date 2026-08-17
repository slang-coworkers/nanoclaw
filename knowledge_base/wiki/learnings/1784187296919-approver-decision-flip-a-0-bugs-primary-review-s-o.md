---
title: "[approver/decision-flip] A 0-bugs primary review's own 'main concern' gap can be a verified crash — the challenger must escalate it, and a late primary review supersedes a fallback ABSTAIN"
type: learning
topic: review-approval
source: learnings/1784187296919-approver-decision-flip-a-0-bugs-primary-review-s-o.md
---

# [approver/decision-flip] A 0-bugs primary review's own "main concern" gap can be a verified crash — the challenger must escalate it, and a late primary review supersedes a fallback ABSTAIN

**Symptom:** slang#12136 — I first recorded ABSTAIN_POLICY:CHALLENGER_CONCERN (fallback tier: production review had timed out IN_PROGRESS through the exit-22 WAIT window on both heads). Later the production claude-code-action review (github-actions[bot]) COMPLETED at the same recorded head and the orchestrator delivered it. Verdict: "🟡 Has issues — 0 bugs, 8 gaps." A naive parse (Step 2: "any 🔴 => BLOCK; else continue") reads 0 bugs and heads toward APPROVE. That would be a FALSE-SAFE: the review's own stated **main concern** was gap #1 — "the two lazy-load triggers do not cover every path that needs supplement-only declarations" — which is a **deterministic SIGSEGV** proven by red CI (8 test-slang jobs, unit-test-function-reflection.cpp:383, on pre-existing unmodified tests). Final decision: BLOCK (RED_BUG), superseding the ABSTAIN row.

**Two transferable rules:**

1. **A late primary review supersedes a fallback-tier decision for the same commit — re-decide, don't let the old row stand.** When you fall back to CodeRabbit+Devin because the production review timed out, and that production review later lands at the SAME head, treat its arrival as a substantive new chain input: re-harvest it yourself (never decide from the deliverer's paraphrase), re-run the full procedure live_late, and replace the ledger row (record_decision is one-row-per-(repo,pr,commit)). The primary is the tier you fell back FROM; its landing is exactly the signal you flagged as absent.

2. **"0 bugs" in the primary parse is NOT a green light — the challenger (Step 3) must judge the GAPS on their merits, and a gap can be a verified crash that escalates the decision HARDER than the doc verdict.** The claude-code-action reviewer labels a finding a "gap" (not a "bug") when it hasn't itself produced "a concrete crashing input." But a gap that says "triggers miss paths X" is a hypothesis you can TEST. Here the test was free: the PR head's own CI was red. Step-3 challenger investigation "can only add caution" — and caution can mean escalating a 🟡 gap to a 🔴 BLOCK when you verify it crashes, not only clearing or abstaining. The discriminator vs the earlier ABSTAIN on the same PR: the null-deref @19215 had UNPROVEN reachability (5 static traces split, no repro) → ABSTAIN; gap #1 had PROVEN reachability (deterministic multi-platform red CI on pre-existing tests) → BLOCK. Verified reachability is the line between ABSTAIN and BLOCK.

**How to catch it:** On ANY approval where clauses pass under `require_ci_green=false`, pull the actual check-runs at the head — the `ci_green_on_sha` clause is blind to red CI under that policy (same lesson as #12130/#12122). If red, get the failing-job log and confirm the crash signature + PR-causality (is the failing test in the PR's changed set? if not → PR-caused regression on pre-existing tests) BEFORE recording. For lazy-builtin-load PRs specifically: does an interface used only as a GENERIC CONSTRAINT (`<T:IDifferentiable>`, `<T:IFloat>`) or reflection of such a type fire a load trigger? If not and downstream assumes the supplement's shape → crash.

**Fix:** Recorded BLOCK/RED_BUG with the CI job id + crash file:line + PR-causality proof, critique-gated (DECISION+OUTPUT approve). next-action for maintainer: widen the trigger set to fire on IDifferentiable/IFloat constraints + reflection paths, not just [Differentiable] callables / differentiate expressions.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784187296919-approver-decision-flip-a-0-bugs-primary-review-s-o.md`_
