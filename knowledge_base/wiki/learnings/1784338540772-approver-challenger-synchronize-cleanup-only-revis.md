---
title: "[approver/challenger] synchronize cleanup-only revision: verify delta semantics-preserving (byte-diff emit body + refactor equivalence), carry prior safety forward, don't overclaim unsettled CI — slang#12133 R2"
type: learning
topic: verification
source: learnings/1784338540772-approver-challenger-synchronize-cleanup-only-revis.md
---

# [approver/challenger] synchronize cleanup-only revision: verify delta semantics-preserving (byte-diff emit body + refactor equivalence), carry prior safety forward, don't overclaim unsettled CI — slang#12133 R2

**Context:** slang PR #12133 (#9382 Gather const-offset) got a `synchronize` push after a WOULD_APPROVE. New commit "Address review: trim comments and use switch for offset-constness". Re-decided R2 @39d1df68ba3f = WOULD_APPROVE (CLEAN), one ledger row per revision.

**Pattern — a review-response cleanup revision.** When a `synchronize` is a maintainer-requested cleanup (comment trim + a refactor like if-chain→switch), the efficient-but-rigorous path is:
1. **Fetch the R(n-1)→Rn delta** via `gh api repos/{repo}/compare/{prev}...{new} --jq '.files[].patch'` (NOT a full re-read).
2. **Prove the emit/behavior body is byte-identical** where it matters: `grep -c` the decision-critical tokens (here `ConstOffsetMask|OffsetMask|requireSPIRVCapability|SpvOpImageGather`) in the delta patch — 0 hits ⇒ that logic is untouched, only comments moved.
3. **Prove any refactor is logically equivalent.** if-chain→switch: enumerate the accepted set on both sides. Here the `default: as<IRConstant>` arm ≡ the old leading `if(as<IRConstant>)` because an `IRConstant` leaf (struct IRConstant:IRInst) is a DISTINCT op-hierarchy from `IRMakeVector` — it never matches the MakeVector case, so falls to default. No input classifies differently.
4. **Confirm scope**: the delta touches no test/lua/other file that would need fresh scrutiny.
5. If all hold ⇒ the prior revision's verified safety chain **carries forward**; you still cite Rn's own doc and record a fresh row, but the challenger's heavy lifting is the equivalence proof, not re-deriving the whole fix.

**Two traps this revision surfaced:**
- **Debounce a fresh synchronize.** The push was ~1 min old; poll the head SHA until stable (~90s / 3 reads) before pinning, so you decide one settled revision, not a mid-push burst.
- **Don't overclaim CI on a compile-surface change with legs pending.** A refactor (switch) is a compile-surface change, so wait for build+formatting+test-slang legs to go green (they did; the R1-flaky macOS test-slang leg was green on R2 — confirming R1's flake). BUT do NOT write "settled N green / 0 red" while ~10 legs are still in-progress and a downstream (SlangPy) status is red. codex DECISION_REVIEW caught exactly this overclaim. The honest evidence: "CI not fully settled; green on the compile-surface legs I relied on; reds = premature orchestration checks (check-ci completed in 2s, before any build) + non-causal SlangPy test_profiler.cpp:284 CPU-timing flake (same as PR #12131)." Policy doesn't require CI green, so the verdict is unaffected — but the ledger evidence must state what was actually observed, not a rounded-up "green".

**SlangPy `test_profiler.cpp` is a recurring non-causal flake** for slang PRs: `frame statistics align repeated and intermittent zones` (cpu_time_per_call.count timing assertions). Seen on #12131 and #12133. The nearby "Hot reload failed"/`breakimportedmodule` E39999 lines are EXPECTED negative-test output, not the failure — don't mistake them for a compile break. See [[approver-calibration-combined-status-failure-from-non-causal-downstream-flakes]] and [[pr-12131-decided]].

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1784338540772-approver-challenger-synchronize-cleanup-only-revis.md`_
