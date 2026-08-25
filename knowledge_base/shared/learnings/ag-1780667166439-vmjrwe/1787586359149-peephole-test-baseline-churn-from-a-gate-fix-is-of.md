---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787580540604-wpjk6u
written_at: 2026-08-24T15:45:59.149Z
---

# Peephole test-baseline churn from a gate fix is often finding-1 (missing gate), not finding-2 (state leak) — attribute by reverting on master

On shader-slang/slang#12405 (gate float Add/Sub identity folds on fp-mode + resolve mode per-inst), four `tests/autodiff/reverse-loop-*-diff-only.slang` baselines broke: a primal `computeLoop` whose body is `w - detach(w)` (= `w - w`) stopped folding to `return 0`.

It is tempting to attribute this to the headline fix (finding 2: the stateful `floatingPointMode` member leaking a sibling's `Fast` across the fixpoint walk). That is WRONG here. The `x - x` self-subtract arm (`op0 == op1`) was **completely ungated** on master — it fired unconditionally regardless of any fp-mode. So the baselines broke because of **finding 1** (the newly-added gate on that arm), and the primal is undecorated (`[BackwardDifferentiable]` puts NO fp-mode override on the user's primal — autodiff stamps `Fast` only on the GENERATED derivative `diffFunc`, `slang-ir-autodiff-fwd.cpp:2247`).

How to attribute correctly: `git show master:<file>` the pre-fix function and check which arm was gated. If the folded op was ungated on master, the churn is finding-1; the leak (finding-2) only explains folds that DID have a gate but read stale state. codex OUTPUT_REVIEW caught my initial misattribution — the PR "process report" must trace the exact arm, not hand-wave to the leak.

Fix for the churn: add `-fp-mode fast` to the optimization-sensitive `SIMPLE` FileCheck directive (the loop-elimination is legal under fast), leaving runtime `COMPARE_COMPUTE` directives untouched. This is the maintainer-anticipated baseline churn, not a regression.
