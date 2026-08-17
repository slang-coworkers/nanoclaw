---
title: "[approver/challenger-miss] 'drop a no-op before emit' pass: safe ≠ right — ask if the producer should be fixed (wrong-layer rejection)"
type: learning
topic: review-approval
source: learnings/1784109134516-approver-challenger-miss-drop-a-no-op-before-emit-.md
---

# [approver/challenger-miss] "drop a no-op before emit" pass: safe ≠ right — ask if the producer should be fixed (wrong-layer rejection)

**Symptom.** slang#11323 added a pre-emit pass `eliminateCastToVoid` that drops `kIROp_CastToVoid` (produced by `(void)expr`) because no backend handles it. My challenger proved the removal memory-**safe** (the op provably never has uses) and I held ABSTAIN_POLICY only on procedural grounds (sole-reviewer fallback tier). The maintainer (skiminki-nv) closed it **unmerged** with: *"this is the wrong fix. The correct fix is to never produce `kIROp_CastToVoid` in the first place, since it doesn't do anything at the IR level, and `NoDiscard` handling is already done at the front-end (`slang-check-stmt.cpp` / `maybeDiagnoseDiscardedNoDiscardResult`)."* Verdict = CHANGES_REQUESTED. My hold direction was right (not a false-safe — I didn't approve), but my **rationale entirely missed the reason the PR died**.

**Root cause.** The challenger answered "is removing this op safe?" (yes) but never asked the repo's own reflexive question — *"if this op is an internally-produced no-op that we immediately drop, why is the producer creating it at all? Fix the producer."* This is CLAUDE.md's **"fix root causes not symptoms / interrogate the input shape / consumer-side patching is a smell"** methodology, applied to a PR. Critically, the challenger **already had every fact** to reach the maintainer's conclusion: Q2 established the op is produced by exactly one lowering path, has result type Void, and is **consumed nowhere**. "Produced once, consumed nowhere, dropped before emit" is the textbook signature of a symptom-patch — a pass that exists only to undo an upstream mistake. The challenger stopped at "safe to remove" instead of "shouldn't be produced."

**How to catch it.** When a diff adds a pass/guard/special-case that **removes, drops, skips, or patches an IR inst/shape right before emit** (or in any consumer), run the producer-fix probe BEFORE clearing it:
1. Is the thing being removed **produced by the compiler itself** (not user-meaningful) and **consumed nowhere**? If yes → strong wrong-layer smell.
2. Could the **producer** (lowering/checker/front-end) simply not create it? Check whether the semantic obligation it "handles" is **already enforced upstream** (here: `[NoDiscard]` is a front-end check in `slang-check-stmt.cpp`, so the IR op was pure dead weight).
3. If the principled fix is producer-side, a symptom-patch PR is **REQUEST_CHANGES-shaped even when it's provably safe** — a maintainer who owns the IR will reject it on architecture, not correctness.
This is orthogonal to memory-safety: a change can be 100% safe and still the wrong layer.

**Fix / transfer.** For the "delete/patch X before emit" pattern, the challenger's report must answer *both* "is it safe?" **and** "should the producer be fixed instead?" — and surface the wrong-layer risk as a first-class challenger concern, not just clause/tier procedure. Reviewers `cross-backend-reviewer` / `ir-correctness-reviewer` encode this lens; consult them for emit/IR-pass diffs. (Confirms the standing CLAUDE.md self-review rule "Consumer-side patching… trace and fix the producer instead" applies to approval challenger reasoning, not just authoring.)

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784109134516-approver-challenger-miss-drop-a-no-op-before-emit-.md`_
