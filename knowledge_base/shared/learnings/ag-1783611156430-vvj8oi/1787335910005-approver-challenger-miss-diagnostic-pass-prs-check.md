---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787334385332-kimblr
written_at: 2026-08-21T18:11:50.005Z
---

# [approver/challenger-miss] diagnostic-pass PRs: check the pass's own run-gate, not just the trigger-present test

**Symptom.** On slang PR #12671 (add diagnostic E55215 for multisampled texture on CUDA, in the
pre-emit `checkUnsupportedInst` pass) my challenger cleared it to WOULD_APPROVE: all clauses passed,
Devin found 0 bugs, and the diagnostic-bearing pass had a proper trigger-present test that fails on
absence (the standing probe). The independent DECISION_REVIEW critique then flagged a real gap I had
dismissed "by analogy" — which CLAUDE.md explicitly forbids.

**Root cause.** A diagnostic is only as reachable as the pass that emits it. E55215 is emitted ONLY by
`checkUnsupportedInst`, which is gated at `slang-emit.cpp:2745` on `!shouldPerformMinimumOptimizations()`.
`-minimum-slang-optimization` (`slang-options.cpp:516`) is a supported, default-off USER flag. The CUDA
emitter's failure it guards against (`_calcCUDATextureTypeName` returns SLANG_FAIL,
`slang-emit-cuda.cpp:246`) is NOT opt-gated. So on the min-opt path the diagnostic never fires AND the
emitter still fails → the exact ICE / malformed-output the PR set out to fix remains reachable and
undiagnosed. The trigger-present test only exercises the DEFAULT compile path, so it is green while the
gap is live — a test passing does not prove the pass runs on every supported path.

**How to catch it.** For any PR that adds/gates a DIAGNOSTIC in an IR pass, after confirming the
trigger-present test, do one more probe: find the pass's call site and read its run-condition. If the
pass is gated (opt level, target subset, a feature flag, `disable-*-validations`), ask: is the FAILURE
the diagnostic guards against gated the same way? If the failure path is always-run but the diagnostic
is conditionally-run, the bug survives on the ungated path. This is the diagnostic analogue of the
gate/flag "positive control" probe — the run-gate is the flag; the test only proves the default arm.

**Fix / disposition.** This was regression-free (strict improvement to the default path; the min-opt
path was already broken) so it is NOT a BLOCK — no verified defect in the diff. But the gap is on a
supported path with real blast radius and undermines the PR's stated purpose, so it does not clear the
conservative-lean severity bar ⇒ ABSTAIN_POLICY / OPEN_GAP, handing the scope call to a human. Note the
cited precedent `StringTypeNotSupportedOnKernelTarget` (#11297) shares the identical min-opt gate and
merged as-is — which is itself the reason to abstain rather than block: whether the min-opt skip is
acceptable is a maintainer scope judgment, not an approver call. Meta-lesson: a Devin "informational"
note is a challenger lead, not a pre-cleared item — trace it to code before dispositioning it.
